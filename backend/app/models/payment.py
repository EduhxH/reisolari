from datetime import datetime
from typing import Optional

from bson import ObjectId
from pydantic import BaseModel, Field


class PaymentDocument(BaseModel):
    id: ObjectId | None = Field(default=None, alias="_id")
    listing_id: ObjectId
    buyer_id: ObjectId
    seller_id: ObjectId
    amount_total: int
    currency: str
    application_fee_amount: Optional[int] = None
    stripe_session_id: str
    stripe_payment_intent_id: Optional[str] = None
    status: str = "paid"
    created_at: datetime

    class Config:
        arbitrary_types_allowed = True
