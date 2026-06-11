from typing import Optional
import stripe
from pydantic import BaseModel
from app.core.config import settings


stripe.api_key = settings.STRIPE_SECRET_KEY


class CheckoutSessionRequest(BaseModel):
    listing_id: str
    amount_cents: int
    currency: str
    seller_stripe_account_id: str
    success_url: str
    cancel_url: str


class CheckoutSessionResponse(BaseModel):
    id: str
    url: str


PLATFORM_FEE_PERCENT = 0.08  # 8%


def create_connect_checkout_session(req: CheckoutSessionRequest) -> Optional[CheckoutSessionResponse]:
    try:
        application_fee_amount = int(req.amount_cents * PLATFORM_FEE_PERCENT)
        if application_fee_amount < 1:
            application_fee_amount = 1

        session = stripe.checkout.Session.create(
            mode="payment",
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": req.currency,
                        "product_data": {"name": f"Solar listing {req.listing_id}"},
                        "unit_amount": req.amount_cents,
                    },
                    "quantity": 1,
                }
            ],
            success_url=req.success_url,
            cancel_url=req.cancel_url,
            payment_intent_data={
                "application_fee_amount": application_fee_amount,
                "transfer_data": {
                    "destination": req.seller_stripe_account_id,
                },
            },
        )
        return CheckoutSessionResponse(id=session["id"], url=session["url"])
    except stripe.error.StripeError:
        return None
