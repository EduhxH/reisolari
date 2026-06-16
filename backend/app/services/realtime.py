"""In-process real-time fan-out (no external broker).

A single backend instance keeps per-user WebSocket connections in memory and
pushes events (new chat messages, notifications) straight to them. This makes
real-time work with zero infrastructure in dev; for multi-instance production a
Redis/NATS pub-sub layer would sit behind this same interface.
"""

from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._users: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, uid: str, websocket: WebSocket) -> None:
        async with self._lock:
            self._users[uid].add(websocket)

    async def disconnect(self, uid: str, websocket: WebSocket) -> None:
        async with self._lock:
            conns = self._users.get(uid)
            if conns is not None:
                conns.discard(websocket)
                if not conns:
                    self._users.pop(uid, None)

    def is_online(self, uid: str) -> bool:
        return bool(self._users.get(uid))

    async def send_to_user(self, uid: str, payload: dict[str, Any]) -> None:
        """Best-effort push to every live connection of a user; prune dead ones."""
        for websocket in list(self._users.get(uid, ())):
            try:
                await websocket.send_json(payload)
            except Exception:
                await self.disconnect(uid, websocket)


# Module-level singleton shared by REST routers (senders) and the WS endpoint.
manager = ConnectionManager()
