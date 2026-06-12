from datetime import datetime
from typing import Optional

from bson import ObjectId
from pydantic import BaseModel, Field


class ListingDocument(BaseModel):
    id: ObjectId | None = Field(default=None, alias="_id")
    owner_id: ObjectId
    title: str
    description: str
    price_cents: int
    currency: str = "eur"
    active: bool = True
    location: dict
    roof_polygon: Optional[dict] = None
    condition: str = "used"
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    panel_type: Optional[str] = "monocrystalline"
    power_w: Optional[int] = None
    panel_efficiency: float = 0.205
    performance_ratio: float = 0.75
    installed_power_kwp: Optional[float] = None
    image_urls: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    class Config:
        arbitrary_types_allowed = True
