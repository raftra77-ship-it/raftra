from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI(title="Raftra Engine API", description="Backend for Raftra Platform")

# CORS middleware for React frontend.
# Allowed browser origins are configurable via the CORS_ORIGINS env var (comma-separated).
# Defaults to the local dev frontend; in production set CORS_ORIGINS to your real domain(s).
_cors_env = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
ALLOWED_ORIGINS = [o.strip() for o in _cors_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting on /api/* (protects login, forgot-password, etc. from brute force / abuse).
# Uses Redis; if REDIS_URL is unset or Redis is down, the middleware fails open (lets
# requests through) so it can never take the app down.
from middleware import RateLimitMiddleware
app.add_middleware(RateLimitMiddleware, max_requests=100, window_seconds=60)

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

@app.on_event("startup")
async def preload_embedding_model():
    """
    Loads the RAG embedding model (bge-small-en-v1.5) once at boot.
    Without this, loading it takes ~2 minutes the first time it's needed - and that
    delay landed on whichever user's request happened to trigger it first, making
    that one generation look like it had hung.
    """
    from core.embeddings import get_embedding_model
    print("Pre-loading embedding model (bge-small-en-v1.5)...")
    get_embedding_model()
    print("Embedding model ready.")


@app.on_event("startup")
async def start_monthly_scheduler():
    """Start the in-process monthly SEO/GEO audit scheduler (no Redis needed)."""
    try:
        from core.scheduler import start_scheduler
        start_scheduler()
    except Exception as e:
        print(f"Failed to start monthly scheduler: {e}")

# WebSocket streaming endpoint
from core.websocket import manager

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    # Authenticate the socket with the same JWT used for HTTP. Browsers can't set
    # headers on a WebSocket, and we avoid putting the token in the URL (it can leak
    # into access logs), so the client sends {"type":"auth","token":"..."} as its
    # first frame. Without this, any anonymous client could connect and receive
    # every tenant's agent logs and generated content.
    import jwt as _jwt
    import json as _json
    from auth import SECRET_KEY, ALGORITHM
    import database, models

    await websocket.accept()
    try:
        raw = await websocket.receive_text()
        msg = _json.loads(raw)
        token = msg.get("token")
        payload = _jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except Exception:
        await websocket.close(code=1008)  # policy violation
        return

    # Bind this connection to exactly the workspaces this user owns. Broadcasts are
    # filtered against this set, so a client only ever receives its own tenant's data.
    db = database.SessionLocal()
    try:
        workspace_ids = {
            w.id for w in db.query(models.Workspace).filter(models.Workspace.user_id == user_id).all()
        }
    finally:
        db.close()

    manager.register(websocket, user_id, workspace_ids)
    try:
        while True:
            # Wait/listen for client messages (heartbeats, etc.)
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Import and include routers here as they are built (Auth, Stripe, Agents, etc.)
# Import and include routers here as they are built (Auth, Stripe, Agents, etc.)
import auth, models, database, payments, agent_routes, workspace_routes, connector_routes

# Create tables in db (in production, use alembic for migrations)
models.Base.metadata.create_all(bind=database.engine)

app.include_router(auth.router)
app.include_router(payments.router)
app.include_router(agent_routes.router)
app.include_router(workspace_routes.router)
app.include_router(connector_routes.router)
