from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI(title="Raftra Engine API", description="Backend for Raftra Platform")

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.responses import JSONResponse
from fastapi.requests import Request
import traceback

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"Global Exception: {exc}")
    traceback.print_exc()
    return JSONResponse(status_code=500, content={"message": "Internal Server Error", "detail": str(exc)})

@app.get("/")
def read_root():
    return {"status": "Raftra Engine Backend Running"}

# WebSocket streaming endpoint (global: agent logs, notifications)
from core.websocket import manager, chat_room_manager

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Wait/listen for client messages (heartbeats, etc.)
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# ── Real-time 1-on-1 chat room per creator handle ──────────────────────────
# room_key = creator handle without @ (e.g. "samairaa.r")
# Both brand and creator connect here → messages broadcast to both instantly.
@app.websocket("/ws/chat/{room_key}")
async def chat_room_endpoint(room_key: str, websocket: WebSocket):
    await chat_room_manager.join(room_key, websocket)
    # Send an acknowledgement to the connecting client
    try:
        await websocket.send_text('{"type":"connected","room":"' + room_key + '"}')
    except Exception:
        pass
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                import json
                data = json.loads(raw)
                # Broadcast the message to all other members in the room (exclude sender to prevent double message)
                await chat_room_manager.send_to_room(room_key, data, exclude=websocket)
            except Exception:
                pass
    except WebSocketDisconnect:
        chat_room_manager.leave(room_key, websocket)


# Import and include routers here as they are built (Auth, Stripe, Agents, etc.)
from fastapi.staticfiles import StaticFiles
import auth, models, database, payments, agent_routes, workspace_routes, influencer_deal_routes, payout_routes, media_routes, posted_deal_routes, chat_routes, notification_routes

# Create tables in db (in production, use alembic for migrations)
models.Base.metadata.create_all(bind=database.engine)

uploads_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

app.include_router(auth.router)
app.include_router(payments.router)
app.include_router(agent_routes.router)
app.include_router(workspace_routes.router)
app.include_router(influencer_deal_routes.router)
app.include_router(payout_routes.router)
app.include_router(media_routes.router)
app.include_router(posted_deal_routes.router)
app.include_router(chat_routes.router)
app.include_router(notification_routes.router)


