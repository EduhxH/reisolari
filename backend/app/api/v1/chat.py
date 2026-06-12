from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.deps import get_current_user, get_database, require_object_id

router = APIRouter()


class ChatRoomCreate(BaseModel):
    listing_id: str


class ChatRoomPublic(BaseModel):
    id: str
    listing_id: str
    buyer_id: str
    seller_id: str
    created_at: datetime


class ChatMessagePublic(BaseModel):
    id: str
    room_id: str
    sender_id: str
    content: str
    timestamp: float


def serialize_room(doc: dict) -> ChatRoomPublic:
    return ChatRoomPublic(
        id=str(doc["_id"]),
        listing_id=str(doc["listing_id"]),
        buyer_id=str(doc["buyer_id"]),
        seller_id=str(doc["seller_id"]),
        created_at=doc["created_at"],
    )


def serialize_message(doc: dict) -> ChatMessagePublic:
    return ChatMessagePublic(
        id=str(doc["_id"]),
        room_id=str(doc["room_id"]),
        sender_id=str(doc["sender_id"]),
        content=doc["content"],
        timestamp=doc["timestamp"],
    )


@router.post("/rooms", response_model=ChatRoomPublic, status_code=status.HTTP_201_CREATED)
async def create_or_get_listing_room(payload: ChatRoomCreate, current_user: dict = Depends(get_current_user)):
    db = get_database()
    listing_id = require_object_id(payload.listing_id, "listing_id")
    listing = await db.listings.find_one({"_id": listing_id, "active": True})
    if listing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active listing not found")
    if listing["owner_id"] == current_user["_id"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Owners cannot open buyer rooms")

    query = {
        "listing_id": listing["_id"],
        "buyer_id": current_user["_id"],
        "seller_id": listing["owner_id"],
    }
    existing = await db.chat_rooms.find_one(query)
    if existing:
        return serialize_room(existing)

    room_doc = {**query, "created_at": datetime.now(timezone.utc)}
    result = await db.chat_rooms.insert_one(room_doc)
    room_doc["_id"] = result.inserted_id
    return serialize_room(room_doc)


@router.get("/rooms/{room_id}/messages", response_model=list[ChatMessagePublic])
async def list_room_messages(room_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    room_object_id = require_object_id(room_id, "room_id")
    room = await db.chat_rooms.find_one({"_id": room_object_id})
    if room is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    if current_user["_id"] not in {room["buyer_id"], room["seller_id"]}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only participants can read this room")

    cursor = db.chat_messages.find({"room_id": room_object_id}).sort("timestamp", 1)
    return [serialize_message(doc) async for doc in cursor]
