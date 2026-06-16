"""Notification creation + real-time delivery.

Persists a notification for a recipient and immediately pushes it to any live
WebSocket connection of that user via the in-process manager.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from app.db.mongo import get_db_client
from app.services.realtime import manager


def serialize_notification(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "type": doc["type"],
        "title": doc["title"],
        "body": doc["body"],
        "data": doc.get("data", {}),
        "read": doc.get("read", False),
        "created_at": doc["created_at"].isoformat(),
    }


async def create_notification(
    user_uid: str,
    type_: str,
    title: str,
    body: str,
    data: Optional[dict[str, Any]] = None,
) -> dict:
    db = get_db_client().solar_p2p
    doc = {
        "user_uid": user_uid,
        "type": type_,
        "title": title,
        "body": body,
        "data": data or {},
        "read": False,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.notifications.insert_one(doc)
    doc["_id"] = result.inserted_id
    await manager.send_to_user(
        user_uid, {"type": "notification", "notification": serialize_notification(doc)}
    )
    return doc
