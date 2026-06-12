from datetime import datetime, timezone

from fastapi import APIRouter, Request, HTTPException, status
from app.core.config import settings
from app.db.mongo import get_db_client
import stripe
from bson import ObjectId
from fastapi import Depends

from app.api.deps import get_current_user, require_object_id
from app.schemas.payment import (
    CheckoutCreate,
    CheckoutPublic,
    StripeAccountStatus,
    StripeOnboardingLink,
)
from app.services.stripe_service import (
    CheckoutSessionRequest,
    create_connect_account,
    create_connect_checkout_session,
    create_connect_onboarding_link,
    retrieve_connect_account_status,
    PLATFORM_FEE_PERCENT,
)

router = APIRouter()

stripe.api_key = settings.STRIPE_SECRET_KEY


@router.post("/checkout", response_model=CheckoutPublic)
async def create_checkout_session(payload: CheckoutCreate, current_user: dict = Depends(get_current_user)):
    db = get_db_client().solar_p2p
    listing_id = require_object_id(payload.listing_id, "listing_id")
    listing = await db.listings.find_one({"_id": listing_id, "active": True})
    if listing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active listing not found")
    if listing["owner_id"] == current_user["_id"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Owners cannot buy their own listings")

    seller = await db.users.find_one({"_id": listing["owner_id"], "is_active": {"$ne": False}})
    if seller is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Seller not found")
    seller_account_id = seller.get("stripe_account_id")
    if not seller_account_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Seller has not connected Stripe")

    session = create_connect_checkout_session(
        CheckoutSessionRequest(
            listing_id=str(listing["_id"]),
            buyer_id=str(current_user["_id"]),
            seller_id=str(seller["_id"]),
            listing_title=listing["title"],
            amount_cents=listing["price_cents"],
            currency=listing.get("currency", "eur"),
            seller_stripe_account_id=seller_account_id,
            success_url=payload.success_url,
            cancel_url=payload.cancel_url,
        )
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Stripe checkout could not be created")
    return CheckoutPublic(id=session.id, url=session.url)


@router.post("/connect/onboarding-link", response_model=StripeOnboardingLink)
async def create_seller_onboarding_link(current_user: dict = Depends(get_current_user)):
    db = get_db_client().solar_p2p
    account_id = current_user.get("stripe_account_id")
    if not account_id:
        account = create_connect_account(current_user["email"])
        if account is None:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Stripe account could not be created")
        account_id = account.id
        await db.users.update_one(
            {"_id": current_user["_id"]},
            {
                "$set": {
                    "is_seller": True,
                    "stripe_account_id": account_id,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )

    refresh_url = f"{settings.FRONTEND_PUBLIC_URL.rstrip('/')}/seller/onboarding/refresh"
    return_url = f"{settings.FRONTEND_PUBLIC_URL.rstrip('/')}/seller/onboarding/complete"
    link = create_connect_onboarding_link(account_id, refresh_url, return_url)
    if link is None:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Stripe onboarding link could not be created")

    return StripeOnboardingLink(account_id=account_id, url=link.url)


@router.get("/connect/status", response_model=StripeAccountStatus)
async def get_seller_connect_status(current_user: dict = Depends(get_current_user)):
    account_id = current_user.get("stripe_account_id")
    if not account_id:
        return StripeAccountStatus()

    account_status = retrieve_connect_account_status(account_id)
    if account_status is None:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Stripe account status unavailable")

    onboarding_complete = account_status.details_submitted and account_status.charges_enabled
    db = get_db_client().solar_p2p
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {
            "$set": {
                "stripe_onboarding_complete": onboarding_complete,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    return StripeAccountStatus(
        account_id=account_status.id,
        charges_enabled=account_status.charges_enabled,
        payouts_enabled=account_status.payouts_enabled,
        details_submitted=account_status.details_submitted,
    )


@router.post("/webhook")
async def stripe_webhook(request: Request):
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

    if event["type"] == "checkout.session.completed":
        session_obj = event["data"]["object"]
        listing_id = session_obj.get("metadata", {}).get("listing_id")
        buyer_id = session_obj.get("metadata", {}).get("buyer_id")
        seller_id = session_obj.get("metadata", {}).get("seller_id")
        amount_total = session_obj.get("amount_total")
        currency = session_obj.get("currency")
        stripe_session_id = session_obj["id"]

        if not listing_id or not buyer_id or not seller_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing metadata")

        client = get_db_client()
        db = client.solar_p2p

        async with await client.start_session() as s:
            async with s.start_transaction():
                listings_coll = db.listings
                payments_coll = db.payments

                existing_payment = await payments_coll.find_one({"stripe_session_id": stripe_session_id}, session=s)
                if existing_payment:
                    return {"status": "already_processed"}

                listing = await listings_coll.find_one({"_id": ObjectId(listing_id)}, session=s)
                if not listing:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found")

                if listing.get("active") is False:
                    return {"status": "already_inactive"}

                await listings_coll.update_one(
                    {"_id": ObjectId(listing_id)},
                    {"$set": {"active": False}},
                    session=s,
                )

                invoice_doc = {
                    "listing_id": ObjectId(listing_id),
                    "buyer_id": ObjectId(buyer_id),
                    "seller_id": ObjectId(seller_id),
                    "amount_total": amount_total,
                    "currency": currency,
                    "application_fee_amount": int(amount_total * PLATFORM_FEE_PERCENT) if amount_total else None,
                    "stripe_session_id": stripe_session_id,
                    "stripe_payment_intent_id": session_obj.get("payment_intent"),
                    "status": "paid",
                    "created_at": datetime.now(timezone.utc),
                }
                await payments_coll.insert_one(invoice_doc, session=s)

    return {"status": "ok"}
