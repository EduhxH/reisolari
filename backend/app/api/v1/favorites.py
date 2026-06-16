from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.deps import get_database, get_firebase_user, require_object_id
from app.schemas.listing import serialize_listing
from app.services.notifications import create_notification

router = APIRouter()


class FavoriteCreate(BaseModel):
    listing_id: str


async def _favorite_count(db, listing_oid) -> int:
    return await db.favorites.count_documents({"listing_id": listing_oid})


@router.post("/", status_code=status.HTTP_201_CREATED)
async def add_favorite(payload: FavoriteCreate, user: dict = Depends(get_firebase_user)):
    db = get_database()
    me = user["sub"]
    oid = require_object_id(payload.listing_id, "listing_id")
    listing = await db.listings.find_one({"_id": oid, "active": True})
    if listing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Anúncio não encontrado")

    existing = await db.favorites.find_one({"user_uid": me, "listing_id": oid})
    if existing is None:
        await db.favorites.insert_one(
            {"user_uid": me, "listing_id": oid, "created_at": datetime.now(timezone.utc)}
        )
        await db.listings.update_one({"_id": oid}, {"$inc": {"favorites_count": 1}})
        seller_uid = listing["owner_id"]
        if seller_uid != me:
            # Anonymous heads-up to the seller — no buyer identity is revealed.
            await create_notification(
                seller_uid,
                "favorite",
                "Novo favorito",
                f"Alguém adicionou o seu anúncio “{listing.get('title', '')}” aos favoritos.",
                {"listing_id": str(oid)},
            )
    return {"favorited": True, "count": await _favorite_count(db, oid)}


@router.delete("/{listing_id}")
async def remove_favorite(listing_id: str, user: dict = Depends(get_firebase_user)):
    db = get_database()
    me = user["sub"]
    oid = require_object_id(listing_id, "listing_id")
    result = await db.favorites.delete_one({"user_uid": me, "listing_id": oid})
    if result.deleted_count:
        await db.listings.update_one({"_id": oid}, {"$inc": {"favorites_count": -1}})
    return {"favorited": False, "count": await _favorite_count(db, oid)}


@router.get("/ids")
async def my_favorite_ids(user: dict = Depends(get_firebase_user)):
    """Listing ids the user has favorited (for heart state on cards)."""
    db = get_database()
    me = user["sub"]
    return [str(doc["listing_id"]) async for doc in db.favorites.find({"user_uid": me})]


@router.get("/")
async def my_favorites(user: dict = Depends(get_firebase_user)):
    """The user's favorited listings, most-recent first."""
    db = get_database()
    me = user["sub"]
    fav_ids = [
        doc["listing_id"]
        async for doc in db.favorites.find({"user_uid": me}).sort("created_at", -1)
    ]
    if not fav_ids:
        return []
    docs = {doc["_id"]: doc async for doc in db.listings.find({"_id": {"$in": fav_ids}})}
    return [serialize_listing(docs[oid]) for oid in fav_ids if oid in docs]
