from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import get_database, get_firebase_user, require_object_id
from app.core.sanitize import strip_html
from app.services.chat_safety import WARNING_TEXT, scan_message
from app.services.notifications import create_notification
from app.services.realtime import manager

router = APIRouter()


class RoomCreate(BaseModel):
    listing_id: str


class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


def serialize_message(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "room_id": str(doc["room_id"]),
        "sender_uid": doc["sender_uid"],
        "kind": doc.get("kind", "user"),
        "content": doc["content"],
        "flagged": doc.get("flagged", False),
        "created_at": doc["created_at"].isoformat(),
    }


async def build_room_view(db, room: dict, me: str) -> dict:
    other = room["seller_uid"] if room["buyer_uid"] == me else room["buyer_uid"]
    role = "buyer" if room["buyer_uid"] == me else "seller"
    listing = await db.listings.find_one({"_id": room["listing_id"]})
    last = await db.chat_messages.find_one({"room_id": room["_id"]}, sort=[("created_at", -1)])

    read_at = (room.get("read_at") or {}).get(me)
    unread_query: dict = {"room_id": room["_id"], "sender_uid": {"$nin": [me, "system"]}}
    if read_at:
        unread_query["created_at"] = {"$gt": read_at}
    unread = await db.chat_messages.count_documents(unread_query)

    return {
        "id": str(room["_id"]),
        "listing_id": str(room["listing_id"]),
        "listing": (
            {
                "id": str(listing["_id"]),
                "title": listing.get("title"),
                "price_cents": listing.get("price_cents"),
                "image_url": (listing.get("image_urls") or [None])[0],
                "active": listing.get("active", True),
            }
            if listing
            else None
        ),
        "role": role,
        "counterparty_uid": other,
        "last_message": serialize_message(last) if last else None,
        "unread": unread,
        "created_at": room["created_at"].isoformat(),
    }


@router.post("/rooms", status_code=status.HTTP_201_CREATED)
async def create_or_get_room(payload: RoomCreate, user: dict = Depends(get_firebase_user)):
    """Open (or reuse) the buyer↔seller conversation for a listing."""
    db = get_database()
    me = user["sub"]
    listing = await db.listings.find_one(
        {"_id": require_object_id(payload.listing_id, "listing_id"), "active": True}
    )
    if listing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Anúncio não encontrado")
    seller_uid = listing["owner_id"]
    if seller_uid == me:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não pode abrir uma conversa no seu próprio anúncio.",
        )

    query = {"listing_id": listing["_id"], "buyer_uid": me, "seller_uid": seller_uid}
    room = await db.chat_rooms.find_one(query)
    if room is None:
        now = datetime.now(timezone.utc)
        room = {**query, "created_at": now, "last_message_at": now, "read_at": {}}
        result = await db.chat_rooms.insert_one(room)
        room["_id"] = result.inserted_id
    return await build_room_view(db, room, me)


@router.get("/rooms")
async def list_my_rooms(user: dict = Depends(get_firebase_user)):
    db = get_database()
    me = user["sub"]
    cursor = db.chat_rooms.find({"$or": [{"buyer_uid": me}, {"seller_uid": me}]}).sort(
        "last_message_at", -1
    )
    return [await build_room_view(db, room, me) async for room in cursor]


async def _require_room(db, room_id: str, me: str) -> dict:
    room = await db.chat_rooms.find_one({"_id": require_object_id(room_id, "room_id")})
    if room is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversa não encontrada")
    if me not in (room["buyer_uid"], room["seller_uid"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem acesso a esta conversa")
    return room


@router.get("/rooms/{room_id}/messages")
async def list_room_messages(room_id: str, user: dict = Depends(get_firebase_user)):
    db = get_database()
    me = user["sub"]
    room = await _require_room(db, room_id, me)
    messages = [
        serialize_message(doc)
        async for doc in db.chat_messages.find({"room_id": room["_id"]}).sort("created_at", 1)
    ]
    # Mark this user's view as read up to now.
    await db.chat_rooms.update_one(
        {"_id": room["_id"]}, {"$set": {f"read_at.{me}": datetime.now(timezone.utc)}}
    )
    return messages


@router.post("/rooms/{room_id}/messages", status_code=status.HTTP_201_CREATED)
async def send_message(
    room_id: str, payload: MessageCreate, user: dict = Depends(get_firebase_user)
):
    db = get_database()
    me = user["sub"]
    room = await _require_room(db, room_id, me)

    content = (strip_html(payload.content) or "").strip()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Mensagem vazia"
        )

    scan = scan_message(content)
    now = datetime.now(timezone.utc)
    message = {
        "room_id": room["_id"],
        "sender_uid": me,
        "kind": "user",
        "content": content,
        "flagged": scan["flagged"],
        "categories": scan["categories"],
        "created_at": now,
    }
    result = await db.chat_messages.insert_one(message)
    message["_id"] = result.inserted_id
    await db.chat_rooms.update_one({"_id": room["_id"]}, {"$set": {"last_message_at": now}})

    participants = [room["buyer_uid"], room["seller_uid"]]
    user_payload = {"type": "message", "room_id": str(room["_id"]), "message": serialize_message(message)}
    for uid in participants:
        await manager.send_to_user(uid, user_payload)

    warning = None
    if scan["flagged"]:
        system_message = {
            "room_id": room["_id"],
            "sender_uid": "system",
            "kind": "system",
            "content": WARNING_TEXT,
            "flagged": False,
            "categories": [],
            "created_at": datetime.now(timezone.utc),
        }
        sys_result = await db.chat_messages.insert_one(system_message)
        system_message["_id"] = sys_result.inserted_id
        sys_payload = {
            "type": "message",
            "room_id": str(room["_id"]),
            "message": serialize_message(system_message),
        }
        for uid in participants:
            await manager.send_to_user(uid, sys_payload)
        warning = WARNING_TEXT

    counterparty = room["seller_uid"] if me == room["buyer_uid"] else room["buyer_uid"]
    listing = await db.listings.find_one({"_id": room["listing_id"]})
    listing_title = (listing or {}).get("title", "o seu anúncio")
    await create_notification(
        counterparty,
        "new_message",
        "Nova mensagem",
        f"Tem uma nova mensagem sobre “{listing_title}”.",
        {"room_id": str(room["_id"]), "listing_id": str(room["listing_id"])},
    )

    return {"message": serialize_message(message), "warning": warning}
