from fastapi import WebSocket
from typing import List, Dict
import json
from datetime import datetime

class ConnectionManager:
    def __init__(self):
        # Store active connections. In a multi-worker setup, we would use Redis PubSub.
        # For now, we'll keep it in-memory but structured for easy transition to Redis.
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast_agent_log(self, agent: str, message: str, status: str = "running"):
        """
        Broadcasts an agent log line to all connected clients (e.g., TerminalFeed on frontend)
        Status can be: queued, running, thinking, completed, failed
        """
        payload = {
            "type": "agent_log",
            "time": datetime.now().strftime("%H:%M:%S"),
            "agent": agent,
            "message": message,
            "status": status
        }
        await self.broadcast(json.dumps(payload))

    async def broadcast_node_update(self, pipeline: str, node: str, status: str):
        """
        Broadcasts the state transition of a LangGraph node.
        """
        payload = {
            "type": "node_update",
            "pipeline": pipeline,
            "node": node,
            "status": status
        }
        await self.broadcast(json.dumps(payload))

    async def broadcast_creative_asset(self, asset: dict):
        """
        Broadcasts a finalized creative asset (strategy, copy, image URL) to the frontend.
        """
        payload = {
            "type": "new_creative_asset",
            "asset": asset
        }
        await self.broadcast(json.dumps(payload))

    async def broadcast_chat_message(self, message: dict):
        """
        Broadcasts a P2P chat message to the frontend.
        """
        payload = {
            "type": "chat_message",
            "message": message
        }
        await self.broadcast(json.dumps(payload))
        
    async def broadcast_notification(self, notification: dict):
        """
        Broadcasts an in-app notification to the frontend.
        """
        payload = {
            "type": "notification",
            "notification": notification
        }
        await self.broadcast(json.dumps(payload))

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                # Connection might have dropped without clean disconnect
                pass

manager = ConnectionManager()


# ─── PER-CHAT-ROOM WEBSOCKET MANAGER ─────────────────────────────────────────
# Keyed by room_key = creator handle (e.g. "samairaa.r")
# Brand and Creator both join the same room → messages appear in real-time.

class ChatRoomManager:
    def __init__(self):
        # room_key → list of websockets
        self.rooms: Dict[str, List[WebSocket]] = {}

    async def join(self, room_key: str, websocket: WebSocket):
        await websocket.accept()
        if room_key not in self.rooms:
            self.rooms[room_key] = []
        self.rooms[room_key].append(websocket)
        print(f"[ChatRoom] {room_key}: +1 connection ({len(self.rooms[room_key])} total)")

    def leave(self, room_key: str, websocket: WebSocket):
        if room_key in self.rooms:
            try:
                self.rooms[room_key].remove(websocket)
            except ValueError:
                pass
            if not self.rooms[room_key]:
                del self.rooms[room_key]
        print(f"[ChatRoom] {room_key}: -1 connection")

    async def send_to_room(self, room_key: str, payload: dict):
        """Send a message to everyone in the room (both brand and creator)."""
        message = json.dumps(payload)
        dead = []
        for ws in self.rooms.get(room_key, []):
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.leave(room_key, ws)

chat_room_manager = ChatRoomManager()
