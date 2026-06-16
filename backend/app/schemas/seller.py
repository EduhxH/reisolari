from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class SellerProfilePublic(BaseModel):
    firebase_uid: str
    is_seller: bool = False
    email: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class DraftUpsert(BaseModel):
    step: int = Field(default=0, ge=0, le=4)
    data: dict[str, Any] = Field(default_factory=dict)


class DraftPublic(BaseModel):
    step: int
    data: dict[str, Any]
    updated_at: datetime
