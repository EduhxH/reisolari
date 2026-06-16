from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Response, status

from app.api.deps import get_database, get_firebase_user
from app.schemas.seller import DraftPublic, DraftUpsert, SellerProfilePublic

router = APIRouter()


@router.post("/profile", response_model=SellerProfilePublic)
async def upsert_seller_profile(user: dict = Depends(get_firebase_user)):
    """Mark the authenticated user as a seller (set during the 'Anunciar' onboarding)."""
    db = get_database()
    now = datetime.now(timezone.utc)
    uid = user["sub"]
    await db.seller_profiles.update_one(
        {"_id": uid},
        {
            "$set": {
                "_id": uid,
                "firebase_uid": uid,
                "is_seller": True,
                "email": user.get("email"),
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    doc = await db.seller_profiles.find_one({"_id": uid})
    return SellerProfilePublic(**doc)


@router.get("/profile", response_model=SellerProfilePublic)
async def get_seller_profile(user: dict = Depends(get_firebase_user)):
    db = get_database()
    doc = await db.seller_profiles.find_one({"_id": user["sub"]})
    if doc is None:
        return SellerProfilePublic(firebase_uid=user["sub"], is_seller=False, email=user.get("email"))
    return SellerProfilePublic(**doc)


@router.get("/drafts", response_model=Optional[DraftPublic])
async def get_my_draft(user: dict = Depends(get_firebase_user)):
    """Return the user's in-progress ad draft, or null."""
    db = get_database()
    doc = await db.listing_drafts.find_one({"_id": user["sub"]})
    if doc is None:
        return None
    return DraftPublic(step=doc.get("step", 0), data=doc.get("data", {}), updated_at=doc["updated_at"])


@router.put("/drafts", response_model=DraftPublic)
async def upsert_my_draft(payload: DraftUpsert, user: dict = Depends(get_firebase_user)):
    db = get_database()
    now = datetime.now(timezone.utc)
    uid = user["sub"]
    await db.listing_drafts.update_one(
        {"_id": uid},
        {
            "$set": {
                "_id": uid,
                "seller_uid": uid,
                "step": payload.step,
                "data": payload.data,
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    return DraftPublic(step=payload.step, data=payload.data, updated_at=now)


@router.delete("/drafts", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_draft(user: dict = Depends(get_firebase_user)):
    db = get_database()
    await db.listing_drafts.delete_one({"_id": user["sub"]})
    return Response(status_code=status.HTTP_204_NO_CONTENT)
