from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ProductPublic(BaseModel):
    id: str
    slug: str
    name: str
    brand: str
    model: str
    description: str
    category: str
    panel_type: str
    power_w: int
    efficiency: float
    cell_count: int
    width_mm: int
    height_mm: int
    depth_mm: int
    weight_kg: float
    warranty_product_years: int
    warranty_power_years: int
    price_cents: int = Field(..., description="Net unit price (ex-VAT) in cents")
    currency: str = "eur"
    stock: int = Field(..., ge=0)
    active: bool = True


def serialize_product(doc: dict) -> ProductPublic:
    return ProductPublic(
        id=str(doc["_id"]),
        slug=doc["slug"],
        name=doc["name"],
        brand=doc["brand"],
        model=doc["model"],
        description=doc["description"],
        category=doc["category"],
        panel_type=doc["panel_type"],
        power_w=doc["power_w"],
        efficiency=doc["efficiency"],
        cell_count=doc.get("cell_count", 108),
        width_mm=doc["width_mm"],
        height_mm=doc["height_mm"],
        depth_mm=doc.get("depth_mm", 30),
        weight_kg=doc["weight_kg"],
        warranty_product_years=doc["warranty_product_years"],
        warranty_power_years=doc["warranty_power_years"],
        price_cents=doc["price_cents"],
        currency=doc.get("currency", "eur"),
        stock=doc.get("stock", 0),
        active=doc.get("active", True),
    )
