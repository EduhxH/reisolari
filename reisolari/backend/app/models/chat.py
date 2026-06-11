from pydantic import BaseModel
from bson import ObjectId


class ChatMessage(BaseModel):
    room_id: ObjectId
    sender_id: ObjectId
    content: str
    timestamp: float
