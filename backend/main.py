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
async def reconcile_stale_agent_tasks():
    """Fix up any AgentTask left at RUNNING by a previous server instance, so a page opened
    right after a restart never shows a false "Running..." state."""
    from core.agent_status import reconcile_all_stale_running
    reconcile_all_stale_running()


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
import auth, models, database, payments, agent_routes, workspace_routes, connector_routes, publishing_routes, creative_routes

# Create tables in db (in production, use alembic for migrations)
models.Base.metadata.create_all(bind=database.engine)


def _run_light_migrations():
    """create_all() creates missing TABLES but never adds missing COLUMNS to tables that
    already exist. These idempotent ADD COLUMN IF NOT EXISTS statements bring older
    `campaigns` rows in line with the model without needing Alembic. Safe to run every boot."""
    from sqlalchemy import text
    stmts = [
        "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS name VARCHAR",
        "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS objective VARCHAR",
        "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS budget DOUBLE PRECISION DEFAULT 0.0",
        "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS daily_budget DOUBLE PRECISION",
        "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS meta_campaign_id VARCHAR",
        "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1",
        "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS version_group VARCHAR",
        # Google connection: GA4 property + sync stamp live on the Search Console row (one
        # OAuth grant covers both). Without these the /status endpoint raises on every
        # workspace that has already connected Google.
        "ALTER TABLE search_console_connections ADD COLUMN IF NOT EXISTS ga4_property_id VARCHAR",
        "ALTER TABLE search_console_connections ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP",
        # Creative Studio generation metadata (core/creative/). Additive only — `status`
        # keeps its existing review-state meaning and is untouched.
        "ALTER TABLE ad_assets ADD COLUMN IF NOT EXISTS generation_status VARCHAR",
        "ALTER TABLE ad_assets ADD COLUMN IF NOT EXISTS original_prompt TEXT",
        "ALTER TABLE ad_assets ADD COLUMN IF NOT EXISTS optimized_prompt TEXT",
        "ALTER TABLE ad_assets ADD COLUMN IF NOT EXISTS creative_spec JSON",
        "ALTER TABLE ad_assets ADD COLUMN IF NOT EXISTS platform VARCHAR",
        "ALTER TABLE ad_assets ADD COLUMN IF NOT EXISTS placement VARCHAR",
        "ALTER TABLE ad_assets ADD COLUMN IF NOT EXISTS aspect_ratio VARCHAR",
        "ALTER TABLE ad_assets ADD COLUMN IF NOT EXISTS media_type VARCHAR",
        "ALTER TABLE ad_assets ADD COLUMN IF NOT EXISTS provider VARCHAR",
        "ALTER TABLE ad_assets ADD COLUMN IF NOT EXISTS model VARCHAR",
        "ALTER TABLE ad_assets ADD COLUMN IF NOT EXISTS reference_image_url VARCHAR",
        "ALTER TABLE ad_assets ADD COLUMN IF NOT EXISTS error_message TEXT",
        "ALTER TABLE ad_assets ADD COLUMN IF NOT EXISTS created_at TIMESTAMP",
        # Meta Ads: the Facebook Page an ad's creative is published as (required to create
        # any ad) plus a default destination URL.
        "ALTER TABLE meta_ads_connections ADD COLUMN IF NOT EXISTS page_id VARCHAR",
        "ALTER TABLE meta_ads_connections ADD COLUMN IF NOT EXISTS page_name VARCHAR",
        "ALTER TABLE meta_ads_connections ADD COLUMN IF NOT EXISTS default_link_url VARCHAR",
        # Publishing foundation (backend/publishing/) — last_synced_at on existing connections.
        "ALTER TABLE github_connections ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP",
        "ALTER TABLE shopify_connections ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP",
        "ALTER TABLE wordpress_connections ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP",
        # WordPress.com OAuth support + auto-apply (core/wpcom_oauth.py). Existing rows are
        # all Application Password connections, hence the default.
        "ALTER TABLE wordpress_connections ADD COLUMN IF NOT EXISTS auth_type VARCHAR DEFAULT 'app_password'",
        "ALTER TABLE wordpress_connections ADD COLUMN IF NOT EXISTS access_token VARCHAR",
        "ALTER TABLE wordpress_connections ADD COLUMN IF NOT EXISTS wpcom_site_id VARCHAR",
        "ALTER TABLE wordpress_connections ADD COLUMN IF NOT EXISTS api_base VARCHAR",
        "ALTER TABLE wordpress_connections ADD COLUMN IF NOT EXISTS auto_apply BOOLEAN DEFAULT FALSE",
        "ALTER TABLE wordpress_connections ADD COLUMN IF NOT EXISTS seo_plugin VARCHAR",
        "UPDATE wordpress_connections SET auth_type = 'app_password' WHERE auth_type IS NULL",
    ]
    try:
        with database.engine.begin() as conn:
            for s in stmts:
                conn.execute(text(s))
    except Exception as e:
        print(f"Light migration warning (non-fatal): {e}")


_run_light_migrations()

app.include_router(auth.router)
app.include_router(payments.router)
app.include_router(agent_routes.router)
app.include_router(workspace_routes.router)
app.include_router(connector_routes.router)
app.include_router(publishing_routes.router)
app.include_router(creative_routes.router)

# Locally-rendered media (Ken Burns ad videos from core/providers/kenburns_video.py).
# Mounted under /api so the Vite dev proxy forwards it and the same relative URL keeps
# working in production behind a single origin — no BACKEND_URL baked into stored records.
# Supabase storage would be the place for this once SUPABASE_URL/KEY are configured; until
# then serving from disk is what makes a generated video actually playable.
from fastapi.staticfiles import StaticFiles  # noqa: E402
from core.providers.kenburns_video import VIDEO_DIR  # noqa: E402

from core.providers.kenburns_video import MEDIA_ROOT  # noqa: E402

VIDEO_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/api/generated/videos", StaticFiles(directory=str(VIDEO_DIR)), name="generated-videos")

# Reference images uploaded for Creative Studio generation (workspace_routes.upload_asset).
# Filenames are server-generated UUIDs, so nothing user-controlled reaches the filesystem.
_UPLOAD_DIR = MEDIA_ROOT / "uploads"
_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/api/generated/uploads", StaticFiles(directory=str(_UPLOAD_DIR)), name="generated-uploads")
