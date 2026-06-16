from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field

OrderRegion = Literal["continent", "madeira", "azores"]
OrderStatus = Literal["pending", "paid", "cancelled", "failed"]

# Free shipping above this net subtotal, otherwise a flat fee (VAT included).
FREE_SHIPPING_THRESHOLD_CENTS = 75000
FLAT_SHIPPING_CENTS = 3490


class OrderItemInput(BaseModel):
    product_id: str
    quantity: int = Field(..., ge=1, le=200)


class CustomerInfo(BaseModel):
    full_name: str = Field(..., min_length=3, max_length=120)
    email: EmailStr
    phone: str = Field(..., min_length=6, max_length=32)
    address_line: str = Field(..., min_length=4, max_length=200)
    city: str = Field(..., min_length=2, max_length=80)
    postal_code: str = Field(..., min_length=4, max_length=16)
    region: OrderRegion = "continent"


class OrderCreate(BaseModel):
    items: list[OrderItemInput] = Field(..., min_length=1, max_length=50)
    customer: CustomerInfo
    success_url: str
    cancel_url: str


class OrderItemPublic(BaseModel):
    product_id: str
    slug: str
    name: str
    brand: str
    unit_price_net_cents: int
    quantity: int
    line_net_cents: int


class OrderCreateResponse(BaseModel):
    order_number: str
    checkout_url: str


class OrderPublic(BaseModel):
    order_number: str
    status: OrderStatus
    items: list[OrderItemPublic]
    customer: CustomerInfo
    subtotal_net_cents: int
    vat_rate: float
    vat_cents: int
    shipping_cents: int
    total_cents: int
    currency: str = "eur"
    created_at: datetime
    paid_at: Optional[datetime] = None


def serialize_order(doc: dict) -> OrderPublic:
    return OrderPublic(
        order_number=doc["order_number"],
        status=doc.get("status", "pending"),
        items=[
            OrderItemPublic(
                product_id=str(item["product_id"]),
                slug=item["slug"],
                name=item["name"],
                brand=item["brand"],
                unit_price_net_cents=item["unit_price_net_cents"],
                quantity=item["quantity"],
                line_net_cents=item["line_net_cents"],
            )
            for item in doc.get("items", [])
        ],
        customer=CustomerInfo(**doc["customer"]),
        subtotal_net_cents=doc["subtotal_net_cents"],
        vat_rate=doc["vat_rate"],
        vat_cents=doc["vat_cents"],
        shipping_cents=doc["shipping_cents"],
        total_cents=doc["total_cents"],
        currency=doc.get("currency", "eur"),
        created_at=doc["created_at"],
        paid_at=doc.get("paid_at"),
    )
