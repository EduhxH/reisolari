import logging
import secrets
from datetime import datetime, timezone
from typing import Optional

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.api.deps import (
    get_database,
    get_firebase_user,
    get_optional_firebase_user,
    require_object_id,
)
from app.core.config import settings
from app.db.mongo import get_db_client
from app.schemas.order import (
    OrderCreate,
    OrderCreateResponse,
    OrderPublic,
    serialize_order,
)
from app.services.geocoding import validate_address
from app.services.store_checkout import (
    PricedItem,
    compute_pricing,
    create_checkout_session,
    retrieve_session,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _generate_order_number() -> str:
    return "RS-" + secrets.token_hex(5).upper()


async def _finalize_order(order_number: str, payment_intent_id: str | None = None) -> bool:
    """Idempotently mark an order paid and atomically decrement product stock.

    Safe to call from both the success-redirect sync and the Stripe webhook.
    Returns True when the order exists and is (now or already) paid.
    """
    client = get_db_client()
    db = client.solar_p2p
    now = datetime.now(timezone.utc)

    async with await client.start_session() as session_ctx:
        async with session_ctx.start_transaction():
            order = await db.orders.find_one({"order_number": order_number}, session=session_ctx)
            if order is None:
                return False
            if order.get("status") == "paid":
                return True

            stock_fulfilled = True
            for item in order["items"]:
                result = await db.products.update_one(
                    {"_id": item["product_id"], "stock": {"$gte": item["quantity"]}},
                    {"$inc": {"stock": -item["quantity"]}, "$set": {"updated_at": now}},
                    session=session_ctx,
                )
                if result.matched_count == 0:
                    stock_fulfilled = False

            update: dict = {
                "status": "paid",
                "paid_at": now,
                "stock_fulfilled": stock_fulfilled,
                "updated_at": now,
            }
            if payment_intent_id:
                update["stripe_payment_intent_id"] = payment_intent_id
            await db.orders.update_one({"_id": order["_id"]}, {"$set": update}, session=session_ctx)

    if not stock_fulfilled:
        logger.warning("Order %s paid but stock could not be fully reserved", order_number)
    return True


@router.post("/", response_model=OrderCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    payload: OrderCreate,
    firebase_user: Optional[dict] = Depends(get_optional_firebase_user),
):
    db = get_database()
    now = datetime.now(timezone.utc)

    # Authoritative server-side address validation: reject non-existent addresses.
    address = await validate_address(
        payload.customer.address_line,
        payload.customer.city,
        payload.customer.postal_code,
    )
    if not address.valid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Morada de entrega inválida ou inexistente. Verifique a rua, código postal e cidade.",
        )

    # Merge duplicate product ids and validate each product against the DB.
    quantities: dict[str, int] = {}
    for entry in payload.items:
        quantities[entry.product_id] = quantities.get(entry.product_id, 0) + entry.quantity

    object_ids = [require_object_id(pid, "product_id") for pid in quantities]
    products = {str(doc["_id"]): doc async for doc in db.products.find({"_id": {"$in": object_ids}})}

    order_items: list[dict] = []
    priced: list[PricedItem] = []
    for product_id, quantity in quantities.items():
        product = products.get(product_id)
        if product is None or not product.get("active", True):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Produto indisponível ({product_id}).",
            )
        available = product.get("stock", 0)
        if available < quantity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Stock insuficiente para {product['name']} (disponível: {available}).",
            )
        net = product["price_cents"]
        order_items.append(
            {
                "product_id": product["_id"],
                "slug": product["slug"],
                "name": product["name"],
                "brand": product["brand"],
                "unit_price_net_cents": net,
                "quantity": quantity,
                "line_net_cents": net * quantity,
            }
        )
        priced.append(PricedItem(name=product["name"], unit_price_net_cents=net, quantity=quantity))

    pricing = compute_pricing(priced, region=payload.customer.region)

    # Persist the pending order before talking to Stripe so we always have a record.
    order_number = _generate_order_number()
    order_doc = {
        "order_number": order_number,
        "status": "pending",
        "items": order_items,
        "customer": payload.customer.model_dump(),
        "subtotal_net_cents": pricing.subtotal_net_cents,
        "vat_rate": pricing.vat_rate,
        "vat_cents": pricing.vat_cents,
        "shipping_cents": pricing.shipping_cents,
        "total_cents": pricing.total_cents,
        "currency": "eur",
        "stripe_session_id": None,
        "stripe_payment_intent_id": None,
        "stock_fulfilled": False,
        "paid_at": None,
        "firebase_uid": firebase_user.get("sub") if firebase_user else None,
        "user_email": firebase_user.get("email") if firebase_user else None,
        "shipping_normalized": address.normalized,
        "shipping_lat": address.latitude,
        "shipping_lon": address.longitude,
        "created_at": now,
        "updated_at": now,
    }
    await db.orders.insert_one(order_doc)

    # The client sends the order-page base; the backend appends the order number
    # (which it just generated) plus Stripe's session-id template parameter.
    success_url = f"{payload.success_url.rstrip('/')}/{order_number}?session_id={{CHECKOUT_SESSION_ID}}"
    try:
        session = create_checkout_session(
            order_number=order_number,
            line_items=pricing.stripe_line_items,
            customer_email=payload.customer.email,
            success_url=success_url,
            cancel_url=payload.cancel_url,
        )
    except stripe.error.StripeError as exc:
        await db.orders.update_one(
            {"order_number": order_number},
            {"$set": {"status": "failed", "updated_at": datetime.now(timezone.utc)}},
        )
        message = getattr(exc, "user_message", None) or str(exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Stripe: {message}")

    await db.orders.update_one(
        {"order_number": order_number},
        {"$set": {"stripe_session_id": session.id, "updated_at": datetime.now(timezone.utc)}},
    )
    return OrderCreateResponse(order_number=order_number, checkout_url=session.url)


@router.get("/mine", response_model=list[OrderPublic])
async def list_my_orders(firebase_user: dict = Depends(get_firebase_user)):
    """List the authenticated user's orders (most recent first)."""
    db = get_database()
    cursor = (
        db.orders.find({"firebase_uid": firebase_user["sub"]})
        .sort("created_at", -1)
        .limit(50)
    )
    return [serialize_order(doc) async for doc in cursor]


@router.get("/{order_number}", response_model=OrderPublic)
async def get_order(order_number: str):
    db = get_database()
    order = await db.orders.find_one({"order_number": order_number})
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido não encontrado.")

    # Self-heal: if Stripe already collected payment, finalize without waiting for the webhook.
    if order.get("status") == "pending" and order.get("stripe_session_id"):
        session = retrieve_session(order["stripe_session_id"])
        if session is not None and session.get("payment_status") == "paid":
            await _finalize_order(order_number, payment_intent_id=session.get("payment_intent"))
            order = await db.orders.find_one({"order_number": order_number})

    return serialize_order(order)


@router.post("/webhook")
async def store_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("Stripe-Signature")
    if sig_header is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing Stripe-Signature header")

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=sig_header,
            secret=settings.STRIPE_WEBHOOK_SECRET,
        )
    except (ValueError, stripe.error.SignatureVerificationError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook signature")

    if event["type"] in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        session_obj = event["data"]["object"]
        metadata = session_obj.get("metadata", {}) or {}
        if metadata.get("kind") == "store_order":
            order_number = metadata.get("order_number")
            if session_obj.get("payment_status") == "paid" and order_number:
                await _finalize_order(order_number, payment_intent_id=session_obj.get("payment_intent"))

    return {"status": "ok"}
