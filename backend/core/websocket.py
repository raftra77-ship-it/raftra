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
