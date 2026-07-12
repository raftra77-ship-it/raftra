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
