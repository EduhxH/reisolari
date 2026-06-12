from datetime import datetime
from typing import Optional

from bson import ObjectId
from pydantic import BaseModel, EmailStr, Field


class UserDocument(BaseModel):
    id: ObjectId | None = Field(default=None, alias="_id")
    email: EmailStr
    hashed_password: str
    full_name: Optional[str] = None
    is_seller: bool = False
    gdpr_consent: bool = False
    stripe_account_id: Optional[str] = None
    stripe_onboarding_complete: bool = False
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    class Config:
        arbitrary_types_allowed = True
