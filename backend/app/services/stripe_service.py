from typing import Optional
import stripe
from pydantic import BaseModel
from app.core.config import settings


stripe.api_key = settings.STRIPE_SECRET_KEY


class CheckoutSessionRequest(BaseModel):
    listing_id: str
    buyer_id: str
    seller_id: str
    listing_title: str
    amount_cents: int
    currency: str
    seller_stripe_account_id: str
    success_url: str
    cancel_url: str


class CheckoutSessionResponse(BaseModel):
    id: str
    url: str


class StripeAccountCreateResponse(BaseModel):
    id: str


class StripeAccountLinkResponse(BaseModel):
    url: str


class StripeAccountStatusResponse(BaseModel):
    id: str
    charges_enabled: bool
    payouts_enabled: bool
    details_submitted: bool


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
                        "product_data": {"name": req.listing_title},
                        "unit_amount": req.amount_cents,
                    },
                    "quantity": 1,
                }
            ],
            success_url=req.success_url,
            cancel_url=req.cancel_url,
            metadata={
                "listing_id": req.listing_id,
                "buyer_id": req.buyer_id,
                "seller_id": req.seller_id,
            },
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


def create_connect_account(email: str) -> Optional[StripeAccountCreateResponse]:
    try:
        account = stripe.Account.create(
            type="express",
            country="PT",
            email=email,
            capabilities={
                "card_payments": {"requested": True},
                "transfers": {"requested": True},
            },
        )
        return StripeAccountCreateResponse(id=account["id"])
    except stripe.error.StripeError:
        return None


def create_connect_onboarding_link(
    account_id: str,
    refresh_url: str,
    return_url: str,
) -> Optional[StripeAccountLinkResponse]:
    try:
        link = stripe.AccountLink.create(
            account=account_id,
            refresh_url=refresh_url,
            return_url=return_url,
            type="account_onboarding",
        )
        return StripeAccountLinkResponse(url=link["url"])
    except stripe.error.StripeError:
        return None


def retrieve_connect_account_status(account_id: str) -> Optional[StripeAccountStatusResponse]:
    try:
        account = stripe.Account.retrieve(account_id)
        return StripeAccountStatusResponse(
            id=account["id"],
            charges_enabled=bool(account.get("charges_enabled")),
            payouts_enabled=bool(account.get("payouts_enabled")),
            details_submitted=bool(account.get("details_submitted")),
        )
    except stripe.error.StripeError:
        return None
