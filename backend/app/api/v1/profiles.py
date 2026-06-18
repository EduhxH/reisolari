from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.api.deps import get_database, get_firebase_user, get_optional_firebase_user
from app.core.sanitize import strip_html
from app.schemas.listing import serialize_listing
from app.services.notifications import create_notification

router = APIRouter()


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, max_length=80)
    location: Optional[str] = Field(default=None, max_length=120)
    profession: Optional[str] = Field(default=None, max_length=80)
    employer: Optional[str] = Field(default=None, max_length=120)
    bio: Optional[str] = Field(default=None, max_length=1000)
    banner_url: Optional[str] = Field(default=None, max_length=500)
    avatar_url: Optional[str] = Field(default=None, max_length=500)
    # Client passes the Firebase account creation time on first save.
    member_since: Optional[datetime] = None


class RatingCreate(BaseModel):
    stars: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=600)


async def _rating_summary(db, uid: str) -> dict:
    agg = await db.ratings.aggregate(
        [{"$match": {"rated_uid": uid}}, {"$group": {"_id": None, "avg": {"$avg": "$stars"}, "count": {"$sum": 1}}}]
    ).to_list(1)
    if not agg:
        return {"average": 0.0, "count": 0}
    return {"average": round(agg[0]["avg"], 2), "count": agg[0]["count"]}


async def _interacted(db, a: str, b: str) -> bool:
    return (
        await db.chat_rooms.count_documents(
            {"$or": [{"buyer_uid": a, "seller_uid": b}, {"buyer_uid": b, "seller_uid": a}]}
        )
        > 0
    )


def _serialize_own_profile(doc: dict) -> dict:
    member_since = doc.get("member_since") or doc.get("created_at")
    return {
        "uid": doc["_id"],
        "display_name": doc.get("display_name"),
        "location": doc.get("location"),
        "profession": doc.get("profession"),
        "employer": doc.get("employer"),
        "bio": doc.get("bio"),
        "banner_url": doc.get("banner_url"),
        "avatar_url": doc.get("avatar_url"),
        "member_since": member_since.isoformat() if member_since else None,
    }


@router.get("/me")
async def get_my_profile(user: dict = Depends(get_firebase_user)):
    db = get_database()
    doc = await db.user_profiles.find_one({"_id": user["sub"]})
    if doc is None:
        return {"uid": user["sub"], "display_name": None, "location": None, "profession": None,
                "employer": None, "bio": None, "banner_url": None, "avatar_url": None, "member_since": None}
    return _serialize_own_profile(doc)


@router.put("/me")
async def upsert_my_profile(payload: ProfileUpdate, user: dict = Depends(get_firebase_user)):
    db = get_database()
    uid = user["sub"]
    now = datetime.now(timezone.utc)
    update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if k != "member_since"}
    if "bio" in update and update["bio"] is not None:
        update["bio"] = strip_html(update["bio"])
    if "display_name" in update and update["display_name"] is not None:
        update["display_name"] = strip_html(update["display_name"])
    update["updated_at"] = now

    await db.user_profiles.update_one(
        {"_id": uid},
        {"$set": update, "$setOnInsert": {"_id": uid, "created_at": now, "member_since": payload.member_since or now}},
        upsert=True,
    )
    # Backfill member_since for profiles created before this field existed.
    if payload.member_since:
        await db.user_profiles.update_one(
            {"_id": uid, "member_since": {"$exists": False}},
            {"$set": {"member_since": payload.member_since}},
        )
    doc = await db.user_profiles.find_one({"_id": uid})
    return _serialize_own_profile(doc)


@router.get("/summary")
async def profiles_summary(uids: str = Query(..., max_length=4000)):
    """Batch seller cards (name, avatar, rating) for a comma-separated uid list."""
    db = get_database()
    uid_list = [u for u in uids.split(",") if u][:60]
    if not uid_list:
        return {}
    profiles = {doc["_id"]: doc async for doc in db.user_profiles.find({"_id": {"$in": uid_list}})}
    ratings: dict = {}
    async for row in db.ratings.aggregate(
        [
            {"$match": {"rated_uid": {"$in": uid_list}}},
            {"$group": {"_id": "$rated_uid", "avg": {"$avg": "$stars"}, "count": {"$sum": 1}}},
        ]
    ):
        ratings[row["_id"]] = {"average": round(row["avg"], 2), "count": row["count"]}
    return {
        uid: {
            "uid": uid,
            "display_name": profiles.get(uid, {}).get("display_name") or "Utilizador Reisolari",
            "avatar_url": profiles.get(uid, {}).get("avatar_url"),
            "rating": ratings.get(uid, {"average": 0.0, "count": 0}),
        }
        for uid in uid_list
    }


@router.get("/{uid}")
async def get_public_profile(uid: str, viewer: Optional[dict] = Depends(get_optional_firebase_user)):
    db = get_database()
    viewer_uid = viewer["sub"] if viewer else None
    doc = await db.user_profiles.find_one({"_id": uid}) or {}

    listings = [
        serialize_listing(item).model_dump(mode="json")
        async for item in db.listings.find({"owner_id": uid, "active": True}).sort("created_at", -1)
    ]

    my_rating = None
    can_rate = False
    if viewer_uid and viewer_uid != uid:
        existing = await db.ratings.find_one({"rater_uid": viewer_uid, "rated_uid": uid})
        if existing:
            my_rating = {"stars": existing["stars"], "comment": existing.get("comment")}
        can_rate = await _interacted(db, viewer_uid, uid)

    member_since = doc.get("member_since") or doc.get("created_at")
    return {
        "uid": uid,
        "display_name": doc.get("display_name") or "Utilizador Reisolari",
        "location": doc.get("location"),
        "profession": doc.get("profession"),
        "employer": doc.get("employer"),
        "bio": doc.get("bio"),
        "banner_url": doc.get("banner_url"),
        "avatar_url": doc.get("avatar_url"),
        "member_since": member_since.isoformat() if member_since else None,
        "rating": await _rating_summary(db, uid),
        "listings": listings,
        "my_rating": my_rating,
        "can_rate": can_rate,
        "is_self": viewer_uid == uid,
    }


@router.post("/{uid}/ratings", status_code=status.HTTP_201_CREATED)
async def rate_user(uid: str, payload: RatingCreate, user: dict = Depends(get_firebase_user)):
    db = get_database()
    me = user["sub"]
    if uid == me:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Não pode avaliar-se a si próprio.")
    if not await _interacted(db, me, uid):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Só pode avaliar utilizadores com quem já interagiu numa conversa.",
        )
    now = datetime.now(timezone.utc)
    comment = strip_html(payload.comment) if payload.comment else None
    await db.ratings.update_one(
        {"rater_uid": me, "rated_uid": uid},
        {
            "$set": {"rater_uid": me, "rated_uid": uid, "stars": payload.stars, "comment": comment, "updated_at": now},
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    await create_notification(
        uid, "rating", "Nova avaliação", f"Recebeu uma avaliação de {payload.stars}★.", {"profile_uid": me}
    )
    return await _rating_summary(db, uid)


@router.get("/{uid}/ratings")
async def list_user_ratings(uid: str):
    db = get_database()
    out = []
    async for rating in db.ratings.find({"rated_uid": uid}).sort("created_at", -1).limit(50):
        rater = await db.user_profiles.find_one({"_id": rating["rater_uid"]}) or {}
        created = rating.get("created_at") or rating.get("updated_at")
        out.append(
            {
                "id": str(rating["_id"]),
                "rater_uid": rating["rater_uid"],
                "rater_name": rater.get("display_name") or "Utilizador",
                "rater_avatar": rater.get("avatar_url"),
                "stars": rating["stars"],
                "comment": rating.get("comment"),
                "created_at": created.isoformat() if created else None,
            }
        )
    return out
