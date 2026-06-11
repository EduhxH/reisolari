from fastapi import APIRouter, Request, HTTPException, status
from app.core.config import settings
from app.db.mongo import get_db_client
import stripe
from bson import ObjectId

router = APIRouter()

stripe.api_key = settings.STRIPE_SECRET_KEY


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
        amount_total = session_obj.get("amount_total")
        currency = session_obj.get("currency")

        if not listing_id or not buyer_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing metadata")

        client = get_db_client()
        db = client.solar_p2p

        async with await client.start_session() as s:
            async with s.start_transaction():
                listings_coll = db.listings
                payments_coll = db.payments

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
                    "amount_total": amount_total,
                    "currency": currency,
                    "stripe_session_id": session_obj["id"],
                    "status": "paid",
                }
                await payments_coll.insert_one(invoice_doc, session=s)

    return {"status": "ok"}
