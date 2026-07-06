from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI(title="Raftra Engine API", description="Backend for Raftra Platform")

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "Raftra Engine Backend Running"}

# WebSocket streaming endpoint
from core.websocket import manager

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Wait/listen for client messages (heartbeats, etc.)
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Import and include routers here as they are built (Auth, Stripe, Agents, etc.)
# Import and include routers here as they are built (Auth, Stripe, Agents, etc.)
import auth, models, database, payments, agent_routes, workspace_routes

# Create tables in db (in production, use alembic for migrations)
models.Base.metadata.create_all(bind=database.engine)

app.include_router(auth.router)
app.include_router(payments.router)
app.include_router(agent_routes.router)
app.include_router(workspace_routes.router)
