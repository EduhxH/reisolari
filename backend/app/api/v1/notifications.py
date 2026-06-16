from fastapi import APIRouter, Depends, Response, status

from app.api.deps import get_database, get_firebase_user, require_object_id
from app.services.notifications import serialize_notification

router = APIRouter()


@router.get("/")
async def my_notifications(user: dict = Depends(get_firebase_user)):
    db = get_database()
    me = user["sub"]
    cursor = db.notifications.find({"user_uid": me}).sort("created_at", -1).limit(50)
    return [serialize_notification(doc) async for doc in cursor]


@router.get("/unread-count")
async def unread_count(user: dict = Depends(get_firebase_user)):
    db = get_database()
    me = user["sub"]
    count = await db.notifications.count_documents({"user_uid": me, "read": False})
    return {"count": count}


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(user: dict = Depends(get_firebase_user)):
    db = get_database()
    me = user["sub"]
    await db.notifications.update_many(
        {"user_uid": me, "read": False}, {"$set": {"read": True}}
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(notification_id: str, user: dict = Depends(get_firebase_user)):
    db = get_database()
    me = user["sub"]
    await db.notifications.update_one(
        {"_id": require_object_id(notification_id, "notification_id"), "user_uid": me},
        {"$set": {"read": True}},
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
