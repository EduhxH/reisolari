from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


ListingCondition = Literal["new", "used", "refurbished"]


class GeoJSONPoint(BaseModel):
    type: Literal["Point"] = "Point"
    coordinates: list[float] = Field(..., min_length=2, max_length=2)

    @field_validator("coordinates")
    @classmethod
    def validate_lon_lat(cls, value: list[float]) -> list[float]:
        lon, lat = value
        if not -180 <= lon <= 180 or not -90 <= lat <= 90:
            raise ValueError("Point coordinates must be [longitude, latitude]")
        return value


class GeoJSONPolygon(BaseModel):
    type: Literal["Polygon"] = "Polygon"
    coordinates: list[list[list[float]]]

    @field_validator("coordinates")
    @classmethod
    def validate_polygon(cls, value: list[list[list[float]]]) -> list[list[list[float]]]:
        if not value:
            raise ValueError("Polygon must contain at least one linear ring")
        exterior = value[0]
        if len(exterior) < 4:
            raise ValueError("Polygon exterior ring must contain at least four points")
        if exterior[0] != exterior[-1]:
            raise ValueError("Polygon exterior ring must be closed")
        for point in exterior:
            if len(point) != 2:
                raise ValueError("Polygon coordinates must be [longitude, latitude]")
            lon, lat = point
            if not -180 <= lon <= 180 or not -90 <= lat <= 90:
                raise ValueError("Polygon coordinates are outside valid ranges")
        return value


class ListingBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=120)
    description: str = Field(..., min_length=10, max_length=4000)
    price_cents: int = Field(..., ge=0)
    currency: str = Field(default="eur", min_length=3, max_length=3)
    active: bool = True
    location: GeoJSONPoint
    roof_polygon: Optional[GeoJSONPolygon] = None
    condition: ListingCondition = "used"
    manufacturer: Optional[str] = Field(default=None, max_length=80)
    model: Optional[str] = Field(default=None, max_length=120)
    panel_type: Optional[str] = Field(default="monocrystalline", max_length=80)
    power_w: Optional[int] = Field(default=None, ge=1, le=1000)
    panel_efficiency: float = Field(default=0.205, gt=0, le=0.35)
    performance_ratio: float = Field(default=0.75, gt=0, le=1)
    installed_power_kwp: Optional[float] = Field(default=None, ge=0)
    image_urls: list[str] = Field(default_factory=list, max_length=8)

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.lower()


class ListingCreate(ListingBase):
    pass


class ListingUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=3, max_length=120)
    description: Optional[str] = Field(default=None, min_length=10, max_length=4000)
    price_cents: Optional[int] = Field(default=None, ge=0)
    currency: Optional[str] = Field(default=None, min_length=3, max_length=3)
    active: Optional[bool] = None
    location: Optional[GeoJSONPoint] = None
    roof_polygon: Optional[GeoJSONPolygon] = None
    condition: Optional[ListingCondition] = None
    manufacturer: Optional[str] = Field(default=None, max_length=80)
    model: Optional[str] = Field(default=None, max_length=120)
    panel_type: Optional[str] = Field(default=None, max_length=80)
    power_w: Optional[int] = Field(default=None, ge=1, le=1000)
    panel_efficiency: Optional[float] = Field(default=None, gt=0, le=0.35)
    performance_ratio: Optional[float] = Field(default=None, gt=0, le=1)
    installed_power_kwp: Optional[float] = Field(default=None, ge=0)
    image_urls: Optional[list[str]] = Field(default=None, max_length=8)

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str | None) -> str | None:
        return value.lower() if value else value


class ListingPublic(ListingBase):
    id: str
    owner_id: str
    created_at: datetime
    updated_at: datetime


def serialize_listing(doc: dict) -> ListingPublic:
    return ListingPublic(
        id=str(doc["_id"]),
        owner_id=str(doc["owner_id"]),
        title=doc["title"],
        description=doc["description"],
        price_cents=doc["price_cents"],
        currency=doc.get("currency", "eur"),
        active=doc.get("active", True),
        location=doc["location"],
        roof_polygon=doc.get("roof_polygon"),
        condition=doc.get("condition", "used"),
        manufacturer=doc.get("manufacturer"),
        model=doc.get("model"),
        panel_type=doc.get("panel_type", "monocrystalline"),
        power_w=doc.get("power_w"),
        panel_efficiency=doc.get("panel_efficiency", 0.205),
        performance_ratio=doc.get("performance_ratio", 0.75),
        installed_power_kwp=doc.get("installed_power_kwp"),
        image_urls=doc.get("image_urls", []),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )
