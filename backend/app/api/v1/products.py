from typing import Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import get_database
from app.schemas.product import ProductPublic, serialize_product

router = APIRouter()

SORT_FIELDS = {
    "price_asc": ("price_cents", 1),
    "price_desc": ("price_cents", -1),
    "power_desc": ("power_w", -1),
    "efficiency_desc": ("efficiency", -1),
}


@router.get("/", response_model=list[ProductPublic])
async def list_products(
    category: Optional[str] = Query(default=None),
    panel_type: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    min_power_w: Optional[int] = Query(default=None, ge=0),
    max_price_cents: Optional[int] = Query(default=None, ge=0),
    in_stock: Optional[bool] = Query(default=None),
    sort: str = Query(default="price_asc"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=48, ge=1, le=100),
):
    db = get_database()
    query: dict = {"active": True}
    if category:
        query["category"] = category
    if panel_type:
        query["panel_type"] = panel_type
    if min_power_w is not None:
        query["power_w"] = {"$gte": min_power_w}
    if max_price_cents is not None:
        query["price_cents"] = {"$lte": max_price_cents}
    if in_stock:
        query["stock"] = {"$gt": 0}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"brand": {"$regex": search, "$options": "i"}},
            {"model": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]

    sort_field, sort_dir = SORT_FIELDS.get(sort, SORT_FIELDS["price_asc"])
    cursor = db.products.find(query).sort(sort_field, sort_dir).skip(skip).limit(limit)
    return [serialize_product(doc) async for doc in cursor]


@router.get("/{identifier}", response_model=ProductPublic)
async def get_product(identifier: str):
    db = get_database()
    query: dict
    try:
        query = {"_id": ObjectId(identifier)}
    except (InvalidId, TypeError):
        query = {"slug": identifier}

    product = await db.products.find_one(query)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return serialize_product(product)
