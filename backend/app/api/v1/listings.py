import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.api.deps import get_database, get_firebase_user, require_object_id
from app.core.sanitize import strip_html
from app.schemas.listing import ListingCreate, ListingPublic, ListingUpdate, serialize_listing

router = APIRouter()


@router.post("/", response_model=ListingPublic, status_code=status.HTTP_201_CREATED)
async def create_listing(payload: ListingCreate, user: dict = Depends(get_firebase_user)):
    """Publish a listing owned by the authenticated Firebase seller."""
    db = get_database()
    now = datetime.now(timezone.utc)
    listing_doc = payload.model_dump()
    # XSS hardening: strip HTML from free-text fields before storage.
    listing_doc["title"] = strip_html(listing_doc["title"])
    listing_doc["description"] = strip_html(listing_doc["description"])
    listing_doc.update(
        {
            "owner_id": user["sub"],
            "created_at": now,
            "updated_at": now,
        }
    )
    result = await db.listings.insert_one(listing_doc)
    listing_doc["_id"] = result.inserted_id
    return serialize_listing(listing_doc)


@router.get("/", response_model=list[ListingPublic])
async def list_listings(
    active: Optional[bool] = Query(default=True),
    condition: Optional[str] = Query(default=None),
    category_id: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None, max_length=120),
    sort: str = Query(default="recent"),
    min_price_cents: Optional[int] = Query(default=None, ge=0),
    max_price_cents: Optional[int] = Query(default=None, ge=0),
    owner_id: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=24, ge=1, le=100),
):
    db = get_database()
    query: dict = {}
    if active is not None:
        query["active"] = active
    if condition:
        query["condition"] = condition
    if category_id:
        query["category_id"] = category_id
    if min_price_cents is not None or max_price_cents is not None:
        query["price_cents"] = {}
        if min_price_cents is not None:
            query["price_cents"]["$gte"] = min_price_cents
        if max_price_cents is not None:
            query["price_cents"]["$lte"] = max_price_cents
    if owner_id:
        query["owner_id"] = owner_id
    if search and search.strip():
        pattern = {"$regex": re.escape(search.strip()), "$options": "i"}
        query["$or"] = [{"title": pattern}, {"description": pattern}]

    if sort == "price_asc":
        sort_spec = [("price_cents", 1)]
    elif sort == "price_desc":
        sort_spec = [("price_cents", -1)]
    else:
        # Premium exposure: premium tier first (listing_type desc), then newest.
        sort_spec = [("listing_type", -1), ("created_at", -1)]

    cursor = db.listings.find(query).sort(sort_spec).skip(skip).limit(limit)
    return [serialize_listing(doc) async for doc in cursor]


@router.get("/mine", response_model=list[ListingPublic])
async def list_my_listings(user: dict = Depends(get_firebase_user)):
    db = get_database()
    cursor = db.listings.find({"owner_id": user["sub"]}).sort("created_at", -1)
    return [serialize_listing(doc) async for doc in cursor]


@router.get("/olx")
async def get_olx_listings(
    latitude: Optional[float] = Query(default=None),
    longitude: Optional[float] = Query(default=None),
):
    from app.services.olx_scraper import fetch_olx_ads, get_closest_district
    district_name = "Portugal"
    if latitude is not None and longitude is not None and (latitude != 0 or longitude != 0):
        district = get_closest_district(latitude, longitude)
        district_name = district["name"]
    ads = await fetch_olx_ads(latitude=latitude, longitude=longitude)
    return {
        "district": district_name,
        "ads": ads
    }


@router.get("/{listing_id}", response_model=ListingPublic)
async def get_listing(listing_id: str):
    db = get_database()
    listing = await db.listings.find_one({"_id": require_object_id(listing_id, "listing_id")})
    if listing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found")
    return serialize_listing(listing)


@router.patch("/{listing_id}", response_model=ListingPublic)
async def update_listing(
    listing_id: str,
    payload: ListingUpdate,
    user: dict = Depends(get_firebase_user),
):
    db = get_database()
    listing_object_id = require_object_id(listing_id, "listing_id")
    existing = await db.listings.find_one({"_id": listing_object_id})
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found")
    if existing.get("owner_id") != user["sub"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner can edit this listing")

    update_data = payload.model_dump(exclude_unset=True)
    if "title" in update_data:
        update_data["title"] = strip_html(update_data["title"])
    if "description" in update_data:
        update_data["description"] = strip_html(update_data["description"])
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        await db.listings.update_one({"_id": listing_object_id}, {"$set": update_data})

    updated = await db.listings.find_one({"_id": listing_object_id})
    return serialize_listing(updated)


@router.delete("/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_listing(listing_id: str, user: dict = Depends(get_firebase_user)):
    db = get_database()
    listing_object_id = require_object_id(listing_id, "listing_id")
    existing = await db.listings.find_one({"_id": listing_object_id})
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found")
    if existing.get("owner_id") != user["sub"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner can delete this listing")

    await db.listings.update_one(
        {"_id": listing_object_id},
        {"$set": {"active": False, "updated_at": datetime.now(timezone.utc)}},
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def _set_listing_status(
    listing_id: str, user: dict, *, new_status: str, active: bool
) -> ListingPublic:
    db = get_database()
    oid = require_object_id(listing_id, "listing_id")
    existing = await db.listings.find_one({"_id": oid})
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found")
    if existing.get("owner_id") != user["sub"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas o autor do anúncio pode alterar o estado.",
        )
    await db.listings.update_one(
        {"_id": oid},
        {"$set": {"status": new_status, "active": active, "updated_at": datetime.now(timezone.utc)}},
    )
    updated = await db.listings.find_one({"_id": oid})
    return serialize_listing(updated)


@router.post("/{listing_id}/mark-sold", response_model=ListingPublic)
async def mark_listing_sold(listing_id: str, user: dict = Depends(get_firebase_user)):
    """Mark the listing as sold (archived) — owner only."""
    return await _set_listing_status(listing_id, user, new_status="sold", active=False)


@router.post("/{listing_id}/reactivate", response_model=ListingPublic)
async def reactivate_listing(listing_id: str, user: dict = Depends(get_firebase_user)):
    """Re-list a previously sold/archived listing — owner only."""
    return await _set_listing_status(listing_id, user, new_status="active", active=True)
