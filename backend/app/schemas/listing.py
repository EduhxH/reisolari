from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator


# Marketplace listing condition (matches the ad-wizard radios, pt-PT).
ListingCondition = Literal["novo", "usado_como_novo", "usado_sinais", "pecas"]
# Exposure tier: clássico (free) vs premium (commission / high exposure).
ListingType = Literal["classico", "premium"]
# Lifecycle: active (listed) vs sold (archived by the owner).
ListingStatus = Literal["active", "sold"]


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
    # Taxonomy (Etapa 1): leaf category + breadcrumb labels for display.
    category_id: Optional[str] = Field(default=None, max_length=120)
    category_path: list[str] = Field(default_factory=list)
    condition: ListingCondition
    # Dynamic technical sheet (Etapa 2), keyed by the category's attribute schema.
    attributes: dict[str, Any] = Field(default_factory=dict)
    # Pricing / business model (Etapa 4).
    price_cents: int = Field(..., ge=0)
    currency: str = Field(default="eur", min_length=3, max_length=3)
    listing_type: ListingType = "classico"
    status: ListingStatus = "active"
    stock: int = Field(default=1, ge=1)
    active: bool = True
    # Location & logistics (Etapa 5). `location` is optional and only the
    # public-safe postal_code/city are exposed; an exact point is derived from
    # the postal code (geocoding) when available.
    location: Optional[GeoJSONPoint] = None
    postal_code: Optional[str] = Field(default=None, max_length=16)
    city: Optional[str] = Field(default=None, max_length=120)
    delivery_pickup: bool = True
    delivery_shipping: bool = False
    roof_polygon: Optional[GeoJSONPolygon] = None
    # Gallery (Etapa 3): ordered image URLs, first is the cover.
    image_urls: list[str] = Field(default_factory=list, max_length=10)

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.lower()


class ListingCreate(ListingBase):
    pass


class ListingUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=3, max_length=120)
    description: Optional[str] = Field(default=None, min_length=10, max_length=4000)
    category_id: Optional[str] = Field(default=None, max_length=120)
    category_path: Optional[list[str]] = None
    condition: Optional[ListingCondition] = None
    attributes: Optional[dict[str, Any]] = None
    price_cents: Optional[int] = Field(default=None, ge=0)
    currency: Optional[str] = Field(default=None, min_length=3, max_length=3)
    listing_type: Optional[ListingType] = None
    status: Optional[ListingStatus] = None
    stock: Optional[int] = Field(default=None, ge=1)
    active: Optional[bool] = None
    location: Optional[GeoJSONPoint] = None
    postal_code: Optional[str] = Field(default=None, max_length=16)
    city: Optional[str] = Field(default=None, max_length=120)
    delivery_pickup: Optional[bool] = None
    delivery_shipping: Optional[bool] = None
    roof_polygon: Optional[GeoJSONPolygon] = None
    image_urls: Optional[list[str]] = Field(default=None, max_length=10)

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str | None) -> str | None:
        return value.lower() if value else value


class ListingPublic(ListingBase):
    id: str
    owner_id: str
    favorites_count: int = 0
    created_at: datetime
    updated_at: datetime


def serialize_listing(doc: dict) -> ListingPublic:
    return ListingPublic(
        id=str(doc["_id"]),
        owner_id=str(doc["owner_id"]),
        title=doc["title"],
        description=doc["description"],
        category_id=doc.get("category_id"),
        category_path=doc.get("category_path", []),
        condition=doc.get("condition", "usado_como_novo"),
        attributes=doc.get("attributes", {}),
        price_cents=doc["price_cents"],
        currency=doc.get("currency", "eur"),
        listing_type=doc.get("listing_type", "classico"),
        status=doc.get("status", "active"),
        stock=doc.get("stock", 1),
        active=doc.get("active", True),
        location=doc.get("location"),
        postal_code=doc.get("postal_code"),
        city=doc.get("city"),
        delivery_pickup=doc.get("delivery_pickup", True),
        delivery_shipping=doc.get("delivery_shipping", False),
        roof_polygon=doc.get("roof_polygon"),
        image_urls=doc.get("image_urls", []),
        favorites_count=doc.get("favorites_count", 0),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )
