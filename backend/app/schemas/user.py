from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: Optional[str] = Field(default=None, max_length=120)
    gdpr_consent: bool = False
    is_seller: bool = False


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, max_length=120)
    is_seller: Optional[bool] = None
    gdpr_consent: Optional[bool] = None


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    full_name: Optional[str] = None
    is_seller: bool = False
    gdpr_consent: bool = False
    stripe_account_id: Optional[str] = None
    stripe_onboarding_complete: bool = False
    is_active: bool = True
    created_at: datetime
    updated_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


def serialize_user(doc: dict) -> UserPublic:
    return UserPublic(
        id=str(doc["_id"]),
        email=doc["email"],
        full_name=doc.get("full_name"),
        is_seller=doc.get("is_seller", False),
        gdpr_consent=doc.get("gdpr_consent", False),
        stripe_account_id=doc.get("stripe_account_id"),
        stripe_onboarding_complete=doc.get("stripe_onboarding_complete", False),
        is_active=doc.get("is_active", True),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )
