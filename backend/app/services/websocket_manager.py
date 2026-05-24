import asyncio
from collections import deque
from typing import Any

from fastapi import WebSocket


class WebSocketManager:
    def __init__(self) -> None:
        self.active_connections: set[WebSocket] = set()
        self.recent_events: deque[dict[str, Any]] = deque(maxlen=80)
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self.active_connections.add(websocket)
            snapshot = list(self.recent_events)
        await websocket.send_json({"type": "snapshot", "payload": snapshot})

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self.active_connections.discard(websocket)

    async def broadcast(self, event_type: str, payload: dict[str, Any]) -> None:
        event = {"type": event_type, "payload": payload}
        async with self._lock:
            self.recent_events.append(event)
            connections = list(self.active_connections)
        disconnected: list[WebSocket] = []
        for websocket in connections:
            try:
                await websocket.send_json(event)
            except Exception:
                disconnected.append(websocket)
        for websocket in disconnected:
            await self.disconnect(websocket)

    async def clear_events(self) -> None:
        async with self._lock:
            self.recent_events.clear()


manager = WebSocketManager()
