from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CheckoutCreate(BaseModel):
    listing_id: str
    success_url: str
    cancel_url: str


class CheckoutPublic(BaseModel):
    id: str
    url: str


class StripeOnboardingLink(BaseModel):
    account_id: str
    url: str


class StripeAccountStatus(BaseModel):
    account_id: Optional[str] = None
    charges_enabled: bool = False
    payouts_enabled: bool = False
    details_submitted: bool = False


class PaymentPublic(BaseModel):
    id: str
    listing_id: str
    buyer_id: str
    seller_id: str
    amount_total: int
    currency: str
    application_fee_amount: Optional[int] = None
    stripe_session_id: str
    stripe_payment_intent_id: Optional[str] = None
    status: str = Field(default="paid")
    created_at: datetime


def serialize_payment(doc: dict) -> PaymentPublic:
    return PaymentPublic(
        id=str(doc["_id"]),
        listing_id=str(doc["listing_id"]),
        buyer_id=str(doc["buyer_id"]),
        seller_id=str(doc["seller_id"]),
        amount_total=doc["amount_total"],
        currency=doc["currency"],
        application_fee_amount=doc.get("application_fee_amount"),
        stripe_session_id=doc["stripe_session_id"],
        stripe_payment_intent_id=doc.get("stripe_payment_intent_id"),
        status=doc.get("status", "paid"),
        created_at=doc["created_at"],
    )
