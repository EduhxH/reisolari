from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import auth, listings, simulation, payments, chat
from app.websocket.chat_ws import router as chat_ws_router
from app.core.logging_config import setup_logging
from app.db.mongo import init_indexes

setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await init_indexes()
    except Exception as exc:
        logger.warning("MongoDB index initialization skipped: %s", exc)
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
app.include_router(payments.router, prefix="/api/v1/payments", tags=["payments"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(chat_ws_router, prefix="/ws", tags=["websocket"])
