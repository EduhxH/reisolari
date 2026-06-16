from datetime import datetime
from typing import Any, Optional

from bson import ObjectId
from pydantic import BaseModel, Field


class ListingDocument(BaseModel):
    """Persistence shape for a marketplace listing (taxonomy-driven)."""

    id: ObjectId | None = Field(default=None, alias="_id")
    owner_id: ObjectId
    title: str
    description: str
    category_id: Optional[str] = None
    category_path: list[str] = Field(default_factory=list)
    condition: str = "usado_como_novo"
    attributes: dict[str, Any] = Field(default_factory=dict)
    price_cents: int
    currency: str = "eur"
    listing_type: str = "classico"
    stock: int = 1
    active: bool = True
    location: Optional[dict] = None
    postal_code: Optional[str] = None
    city: Optional[str] = None
    delivery_pickup: bool = True
    delivery_shipping: bool = False
    roof_polygon: Optional[dict] = None
    image_urls: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    class Config:
        arbitrary_types_allowed = True
