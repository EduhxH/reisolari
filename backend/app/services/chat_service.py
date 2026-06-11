import time
from bson import ObjectId
from app.db.mongo import get_db_client


async def save_chat_message(room_id: str, sender_id: str, content: str) -> None:
    client = get_db_client()
    db = client.solar_p2p
    doc = {
        "room_id": ObjectId(room_id),
        "sender_id": ObjectId(sender_id),
        "content": content,
        "timestamp": time.time(),
    }
    await db.chat_messages.insert_one(doc)
