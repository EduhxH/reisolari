from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, GEOSPHERE
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
    await db.listings.create_index([("owner_id", ASCENDING), ("created_at", DESCENDING)])
    await db.listings.create_index([("active", ASCENDING), ("condition", ASCENDING), ("price_cents", ASCENDING)])
    await db.payments.create_index([("stripe_session_id", ASCENDING)], unique=True)
    await db.payments.create_index([("buyer_id", ASCENDING), ("created_at", DESCENDING)])
    await db.payments.create_index([("seller_id", ASCENDING), ("created_at", DESCENDING)])
    await db.chat_rooms.create_index(
        [("listing_id", ASCENDING), ("buyer_id", ASCENDING), ("seller_id", ASCENDING)],
        unique=True,
    )
    await db.chat_rooms.create_index([("buyer_id", ASCENDING), ("created_at", DESCENDING)])
    await db.chat_rooms.create_index([("seller_id", ASCENDING), ("created_at", DESCENDING)])
    await db.chat_messages.create_index([("room_id", ASCENDING)])
