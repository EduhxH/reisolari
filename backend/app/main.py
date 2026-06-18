from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1 import (
    auth, listings, simulation, payments, chat, products, orders, categories,
    seller, media, favorites, notifications, profiles, reports, questionnaire,
)
from app.websocket.stream_ws import router as stream_ws_router
from app.core.logging_config import setup_logging
from app.db.mongo import init_indexes
from app.services.catalog import seed_catalog
from app.services.taxonomy import seed_taxonomy

setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await init_indexes()
    except Exception as exc:
        logger.warning("MongoDB index initialization skipped: %s", exc)
    try:
        count = await seed_catalog()
        logger.info("Store catalog seeded (%d products).", count)
    except Exception as exc:
        logger.warning("Store catalog seeding skipped: %s", exc)
    try:
        cat_count = await seed_taxonomy()
        logger.info("Marketplace taxonomy seeded (%d categories).", cat_count)
    except Exception as exc:
        logger.warning("Taxonomy seeding skipped: %s", exc)
    yield


app = FastAPI(title="Solar P2P Marketplace", version="1.0.0", lifespan=lifespan)

origins = ["http://localhost:3000", "https://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(listings.router, prefix="/api/v1/listings", tags=["listings"])
app.include_router(simulation.router, prefix="/api/v1/simulation", tags=["simulation"])
app.include_router(questionnaire.router, prefix="/api/v1/questionnaire", tags=["questionnaire"])
app.include_router(payments.router, prefix="/api/v1/payments", tags=["payments"])
app.include_router(products.router, prefix="/api/v1/products", tags=["products"])
app.include_router(orders.router, prefix="/api/v1/orders", tags=["orders"])
app.include_router(categories.router, prefix="/api/v1/categories", tags=["categories"])
app.include_router(seller.router, prefix="/api/v1/seller", tags=["seller"])
app.include_router(media.router, prefix="/api/v1/media", tags=["media"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(favorites.router, prefix="/api/v1/favorites", tags=["favorites"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["notifications"])
app.include_router(profiles.router, prefix="/api/v1/profiles", tags=["profiles"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["reports"])
app.include_router(stream_ws_router, prefix="/ws", tags=["websocket"])

# Serve uploaded listing images (dev-grade local storage; see app/api/v1/media.py).
app.mount("/media", StaticFiles(directory=str(media.UPLOAD_DIR)), name="media")
