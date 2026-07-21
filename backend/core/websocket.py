from fastapi import WebSocket
from typing import List, Dict, Optional, Set
import contextvars
import json
from datetime import datetime

# The workspace whose pipeline is currently running. Set once at the top of each
# pipeline entrypoint (run_*_pipeline); every broadcast made while that task runs
# is then automatically scoped to that workspace, so we don't have to thread a
# workspace_id argument through all ~40 broadcast call sites. asyncio copies the
# context when child tasks are created, so nested LangGraph nodes inherit it too.
current_workspace_id: "contextvars.ContextVar[Optional[int]]" = contextvars.ContextVar(
    "current_workspace_id", default=None
)


class _Conn:
    __slots__ = ("ws", "user_id", "workspaces")

    def __init__(self, ws: WebSocket, user_id: int, workspaces: Set[int]):
        self.ws = ws
        self.user_id = user_id
        self.workspaces = workspaces


class ConnectionManager:
    def __init__(self):
        # Each connection is bound to the authenticated user and the set of
        # workspace ids they own. A broadcast only reaches connections whose set
        # contains the target workspace, so one tenant never receives another
        # tenant's agent logs, generated ads, chat messages or notifications.
        self.active_connections: List[_Conn] = []

    def register(self, websocket: WebSocket, user_id: int, workspaces: Set[int]):
        # The endpoint accepts the socket and authenticates it before registering,
        # so this just records the authenticated connection.
        self.active_connections.append(_Conn(websocket, user_id, workspaces))

    def disconnect(self, websocket: WebSocket):
        self.active_connections = [c for c in self.active_connections if c.ws is not websocket]

    async def broadcast_agent_log(self, agent: str, message: str, status: str = "running", workspace_id: Optional[int] = None):
        """Broadcast an agent log line to the owning workspace's clients (TerminalFeed).
        Status can be: queued, running, thinking, completed, failed."""
        payload = {
            "type": "agent_log",
            "time": datetime.now().strftime("%H:%M:%S"),
            "agent": agent,
            "message": message,
            "status": status,
        }
        await self.broadcast(json.dumps(payload), workspace_id)

    async def broadcast_node_update(self, pipeline: str, node: str, status: str, workspace_id: Optional[int] = None):
        """Broadcast the state transition of a LangGraph node."""
        payload = {"type": "node_update", "pipeline": pipeline, "node": node, "status": status}
        await self.broadcast(json.dumps(payload), workspace_id)

    async def broadcast_creative_asset(self, asset: dict, workspace_id: Optional[int] = None):
        """Broadcast a finalized creative asset (strategy, copy, image URL)."""
        payload = {"type": "new_creative_asset", "asset": asset}
        # The asset carries its own workspace_id - prefer it so the generated ad
        # only ever reaches the workspace that generated it.
        ws_id = workspace_id if workspace_id is not None else asset.get("workspace_id")
        await self.broadcast(json.dumps(payload), ws_id)

    async def broadcast_chat_message(self, message: dict, user_ids: Optional[Set[int]] = None):
        """Deliver a P2P chat message. Chat spans two tenants (a brand and a creator),
        so it is targeted at the two participant user ids, not a workspace."""
        payload = {"type": "chat_message", "message": message}
        if user_ids is not None:
            await self.send_to_users(json.dumps(payload), user_ids)
        else:
            await self.broadcast(json.dumps(payload))

    async def broadcast_notification(self, notification: dict, user_id: Optional[int] = None):
        """Deliver an in-app notification to a specific user."""
        payload = {"type": "notification", "notification": notification}
        if user_id is not None:
            await self.send_to_users(json.dumps(payload), {user_id})
        else:
            await self.broadcast(json.dumps(payload))

    async def send_to_users(self, message: str, user_ids: Set[int]):
        """Send to every connection whose authenticated user is in user_ids."""
        for conn in list(self.active_connections):
            if conn.user_id not in user_ids:
                continue
            try:
                await conn.ws.send_text(message)
            except Exception:
                pass

    async def broadcast(self, message: str, workspace_id: Optional[int] = None):
        # Resolve the target workspace: explicit arg wins, else the running
        # pipeline's context. If it's still unknown, this is a genuinely global
        # system message (heartbeat/startup) - those never carry tenant data.
        ws_id = workspace_id if workspace_id is not None else current_workspace_id.get()
        for conn in list(self.active_connections):
            if ws_id is not None and ws_id not in conn.workspaces:
                continue
            try:
                await conn.ws.send_text(message)
            except Exception:
                # Connection might have dropped without clean disconnect
                pass


manager = ConnectionManager()
