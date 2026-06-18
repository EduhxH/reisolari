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
    await db.products.create_index([("slug", ASCENDING)], unique=True)
    await db.products.create_index([("active", ASCENDING), ("category", ASCENDING), ("price_cents", ASCENDING)])
    await db.orders.create_index([("order_number", ASCENDING)], unique=True)
    await db.orders.create_index([("stripe_session_id", ASCENDING)])
    await db.orders.create_index([("customer.email", ASCENDING), ("created_at", DESCENDING)])
    await db.orders.create_index([("firebase_uid", ASCENDING), ("created_at", DESCENDING)])
    await db.categories.create_index([("parent_id", ASCENDING), ("order", ASCENDING)])
    await db.categories.create_index([("path", ASCENDING)])
    await db.chat_rooms.create_index(
        [("listing_id", ASCENDING), ("buyer_uid", ASCENDING), ("seller_uid", ASCENDING)],
        unique=True,
    )
    await db.chat_rooms.create_index([("buyer_uid", ASCENDING), ("last_message_at", DESCENDING)])
    await db.chat_rooms.create_index([("seller_uid", ASCENDING), ("last_message_at", DESCENDING)])
    await db.chat_messages.create_index([("room_id", ASCENDING), ("created_at", ASCENDING)])
    await db.favorites.create_index([("user_uid", ASCENDING), ("listing_id", ASCENDING)], unique=True)
    await db.favorites.create_index([("user_uid", ASCENDING), ("created_at", DESCENDING)])
    await db.notifications.create_index([("user_uid", ASCENDING), ("created_at", DESCENDING)])
    await db.notifications.create_index([("user_uid", ASCENDING), ("read", ASCENDING)])
    await db.ratings.create_index([("rater_uid", ASCENDING), ("rated_uid", ASCENDING)], unique=True)
    await db.ratings.create_index([("rated_uid", ASCENDING), ("created_at", DESCENDING)])
    await db.reports.create_index(
        [("reporter_uid", ASCENDING), ("target_type", ASCENDING), ("target_id", ASCENDING)], unique=True
    )
    await db.reports.create_index([("status", ASCENDING), ("created_at", DESCENDING)])
