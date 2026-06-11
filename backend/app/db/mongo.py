from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, GEOSPHERE
from app.core.config import settings

_client: AsyncIOMotorClient | None = None


def get_db_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.MONGO_URI)
    return _client


async def init_indexes() -> None:
    client = get_db_client()
    db = client.solar_p2p

    await db.users.create_index([("email", ASCENDING)], unique=True)
    await db.listings.create_index([("location", GEOSPHERE)])
    await db.listings.create_index([("roof_polygon", GEOSPHERE)])
    await db.chat_messages.create_index([("room_id", ASCENDING)])
