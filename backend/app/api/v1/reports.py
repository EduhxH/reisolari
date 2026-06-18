from datetime import datetime, timezone
from typing import Literal, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import get_admin_user, get_database, get_firebase_user, require_object_id
from app.core.config import settings
from app.core.sanitize import strip_html

router = APIRouter()

ReportTarget = Literal["listing", "user"]
ReportReason = Literal["fraude", "proibido", "ofensivo", "spam", "categoria_errada", "ja_vendido", "outro"]
# Distinct open reports that auto-flag a listing for review.
FLAG_THRESHOLD = 3


class ReportCreate(BaseModel):
    target_type: ReportTarget
    target_id: str
    reason: ReportReason
    detail: Optional[str] = Field(default=None, max_length=600)


class ResolvePayload(BaseModel):
    target_type: ReportTarget
    target_id: str
    action: Literal["dismiss", "remove"]


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_report(payload: ReportCreate, user: dict = Depends(get_firebase_user)):
    db = get_database()
    me = user["sub"]

    if payload.target_type == "user":
        if payload.target_id == me:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Não pode denunciar-se a si próprio.")
    else:
        listing = await db.listings.find_one({"_id": require_object_id(payload.target_id, "target_id")})
        if listing is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Anúncio não encontrado")
        if listing.get("owner_id") == me:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Não pode denunciar o seu próprio anúncio.")

    now = datetime.now(timezone.utc)
    detail = strip_html(payload.detail) if payload.detail else None
    await db.reports.update_one(
        {"reporter_uid": me, "target_type": payload.target_type, "target_id": payload.target_id},
        {
            "$set": {
                "reporter_uid": me,
                "target_type": payload.target_type,
                "target_id": payload.target_id,
                "reason": payload.reason,
                "detail": detail,
                "status": "open",
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )

    if payload.target_type == "listing":
        open_count = await db.reports.count_documents(
            {"target_type": "listing", "target_id": payload.target_id, "status": "open"}
        )
        if open_count >= FLAG_THRESHOLD:
            await db.listings.update_one(
                {"_id": require_object_id(payload.target_id)}, {"$set": {"flagged_for_review": True}}
            )
    return {"reported": True}


@router.get("/mine")
async def my_reported_targets(user: dict = Depends(get_firebase_user)):
    """Keys (`type:id`) the user has reported, so the UI can show the reported state."""
    db = get_database()
    return [
        f"{doc['target_type']}:{doc['target_id']}"
        async for doc in db.reports.find({"reporter_uid": user["sub"]})
    ]


@router.get("/admin/check")
async def admin_check(user: dict = Depends(get_firebase_user)):
    return {"is_admin": user["sub"] in settings.admin_uid_set}


@router.get("/admin")
async def list_open_reports(admin: dict = Depends(get_admin_user)):
    """Open reports grouped by target, enriched with target info (moderation queue)."""
    db = get_database()
    groups: dict = {}
    async for report in db.reports.find({"status": "open"}).sort("created_at", -1):
        key = f"{report['target_type']}:{report['target_id']}"
        group = groups.setdefault(
            key,
            {
                "key": key,
                "target_type": report["target_type"],
                "target_id": report["target_id"],
                "count": 0,
                "reasons": [],
                "details": [],
                "last_at": report["created_at"].isoformat(),
            },
        )
        group["count"] += 1
        group["reasons"].append(report["reason"])
        if report.get("detail"):
            group["details"].append(report["detail"])

    result = []
    for group in groups.values():
        info: dict = {}
        if group["target_type"] == "listing":
            try:
                doc = await db.listings.find_one({"_id": ObjectId(group["target_id"])})
            except Exception:
                doc = None
            info = {"title": (doc or {}).get("title"), "active": (doc or {}).get("active", True)}
        else:
            prof = await db.user_profiles.find_one({"_id": group["target_id"]})
            info = {"name": (prof or {}).get("display_name") or "Utilizador"}
        result.append({**group, "info": info})

    result.sort(key=lambda item: item["count"], reverse=True)
    return result


@router.post("/admin/resolve")
async def resolve_reports(payload: ResolvePayload, admin: dict = Depends(get_admin_user)):
    db = get_database()
    now = datetime.now(timezone.utc)
    await db.reports.update_many(
        {"target_type": payload.target_type, "target_id": payload.target_id, "status": "open"},
        {"$set": {"status": "resolved", "resolved_at": now, "resolved_by": admin["sub"], "action": payload.action}},
    )
    if payload.target_type == "listing":
        update = {"flagged_for_review": False}
        if payload.action == "remove":
            update["active"] = False
            update["updated_at"] = now
        await db.listings.update_one({"_id": require_object_id(payload.target_id)}, {"$set": update})
    return {"resolved": True, "action": payload.action}
