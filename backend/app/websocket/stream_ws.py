"""Unified per-user real-time stream.

One authenticated WebSocket per user carries every push event for them — new
chat messages (in any of their rooms) and notifications. The server knows each
room's participants, so it fans out directly to their user connections; the
client routes events by ``type`` and ``room_id``.
"""

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.services.firebase_auth import verify_firebase_token
from app.services.realtime import manager

router = APIRouter()


@router.websocket("/stream")
async def stream(websocket: WebSocket, token: str = Query(...)):
    try:
        claims = await verify_firebase_token(token)
    except Exception:
        await websocket.close(code=1008)  # policy violation
        return
    uid = claims.get("sub") or claims.get("user_id")
    if not uid:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    await manager.connect(uid, websocket)
    try:
        # The stream is server->client; we only read to detect disconnects.
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(uid, websocket)
    except Exception:
        await manager.disconnect(uid, websocket)
