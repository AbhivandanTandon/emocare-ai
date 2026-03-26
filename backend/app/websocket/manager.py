import json
import logging
from typing import Dict, Set

from fastapi import WebSocket

logger = logging.getLogger("emocare.ws")


class ConnectionManager:
    def __init__(self):
        # user_id → set of WebSocket connections (multi-tab support)
        self._user_connections: Dict[str, Set[WebSocket]] = {}
        # role-based rooms
        self._role_rooms: Dict[str, Set[WebSocket]] = {"admin": set(), "therapist": set()}

    async def connect(self, websocket: WebSocket, user_id: str, role: str):
        await websocket.accept()
        self._user_connections.setdefault(user_id, set()).add(websocket)
        if role in self._role_rooms:
            self._role_rooms[role].add(websocket)
        logger.info("WS connected: user=%s role=%s", user_id, role)

    def disconnect(self, websocket: WebSocket, user_id: str, role: str):
        if user_id in self._user_connections:
            self._user_connections[user_id].discard(websocket)
            if not self._user_connections[user_id]:
                del self._user_connections[user_id]
        if role in self._role_rooms:
            self._role_rooms[role].discard(websocket)

    async def send_to_user(self, user_id: str, payload: dict):
        dead = set()
        for ws in self._user_connections.get(user_id, set()):
            try:
                await ws.send_text(json.dumps(payload))
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._user_connections.get(user_id, set()).discard(ws)

    async def broadcast_to_role(self, role: str, payload: dict):
        dead = set()
        for ws in self._role_rooms.get(role, set()):
            try:
                await ws.send_text(json.dumps(payload))
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._role_rooms.get(role, set()).discard(ws)

    def active_count(self) -> int:
        return sum(len(v) for v in self._user_connections.values())


manager = ConnectionManager()