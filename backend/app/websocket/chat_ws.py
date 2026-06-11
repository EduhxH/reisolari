from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.db.redis import get_redis
from app.services.chat_service import save_chat_message
import asyncio
import json

router = APIRouter()


@router.websocket("/chat")
async def chat_ws(websocket: WebSocket, room_id: str = Query(...), user_id: str = Query(...)):
    await websocket.accept()
    redis = get_redis()
    channel_name = f"chat:{room_id}"
    pubsub = redis.pubsub()
    await pubsub.subscribe(channel_name)

    async def reader():
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = message["data"]
                    if isinstance(data, bytes):
                        data = data.decode("utf-8")
                    await websocket.send_text(data)
        except Exception:
            await websocket.close()

    reader_task = asyncio.create_task(reader())

    try:
        while True:
            text = await websocket.receive_text()
            msg = {"room_id": room_id, "user_id": user_id, "content": text}
            await redis.publish(channel_name, json.dumps(msg))
            await save_chat_message(room_id, user_id, text)
    except WebSocketDisconnect:
        reader_task.cancel()
        await pubsub.unsubscribe(channel_name)
    except Exception:
        reader_task.cancel()
        await pubsub.unsubscribe(channel_name)
        await websocket.close()
