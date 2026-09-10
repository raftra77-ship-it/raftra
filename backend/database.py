import os
from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set in environment.")

try:
    # Supabase uses connection pooling, sometimes requires SSL
    #
    # pool_pre_ping is deliberately OFF. It issues a liveness round trip on every single
    # checkout, and against a remote Supabase that measured 245ms per request - on a
    # dashboard load that fires ~14 requests, roughly 3.4 seconds of doing nothing but
    # asking "are you still there?".
    #
    # What replaces it is a much shorter pool_recycle: connections are discarded after five
    # minutes rather than thirty, which is comfortably under the idle timeouts Supabase's
    # pooler and Postgres apply, so a connection is very unlikely to go stale while parked.
    # Set DB_PRE_PING=true to put the check back if a deployment ever needs it.
    _PRE_PING = os.getenv("DB_PRE_PING", "false").strip().lower() in ("1", "true", "yes", "on")
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=_PRE_PING,
        pool_size=20,
        max_overflow=40,
        pool_timeout=30,
        pool_recycle=int(os.getenv("DB_POOL_RECYCLE_SEC", "300")),
    )
    print("Connected to PostgreSQL (Supabase) successfully.")
except Exception as e:
    print(f"Error connecting to database: {e}")
    raise e

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency for FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Qdrant Database Setup
from qdrant_client import QdrantClient
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")

qdrant_client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)

def get_qdrant_client():
    return qdrant_client



# ─────────────────────────────────────────────────────────── Row Level Security
#
# Tenant isolation is enforced by Postgres policies (see the d47b2e8135ac migration), not
# only by the workspace_id filters written into each query. This is the switch that makes
# those policies apply.
#
# The subtlety worth knowing: RLS is bypassed for superusers, and this app connects to
# Supabase as `postgres`. Policies alone would therefore enforce NOTHING while looking
# correct in the schema. So a request transaction switches into the non-superuser
# `raftra_app` role, at which point the policies bite.
#
# Background jobs (agents, schedulers, Celery) never call this, so they stay as `postgres`
# and bypass RLS on purpose - they act across all workspaces, already scope their own
# queries, and carry no end-user input.

RLS_ROLE = os.getenv("RLS_APP_ROLE", "raftra_app")

# Off by default so deploying this code cannot lock an environment out of its own data
# before the migration has run. Turn on with ENABLE_RLS=true once d47b2e8135ac is applied.
def rls_enabled() -> bool:
    return os.getenv("ENABLE_RLS", "false").strip().lower() in ("1", "true", "yes", "on")


def enter_tenant_scope(db, user_id: int) -> None:
    """Bind this transaction to one user, so RLS policies filter every subsequent query.

    Uses SET LOCAL for both statements: they are scoped to the current transaction and
    revert on commit or rollback, so a pooled connection can never carry one request's
    identity into the next. A no-op unless ENABLE_RLS is set.

    Never raises. If the role or policies are missing (migration not applied, or a
    Postgres that does not have the role), the request continues under the existing
    application-level workspace checks rather than 500ing - but it logs loudly, because
    silently falling back to "no database enforcement" is exactly the failure this whole
    mechanism exists to prevent.
    """
    if not rls_enabled():
        return
    from sqlalchemy import text
    try:
        # set_config(..., true) is the local form, and takes the value as a bind parameter,
        # so a user id can never be interpolated into SQL text.
        #
        # Both statements go in one execute because this runs on EVERY authenticated
        # request, and the database is remote - two executes meant two network round trips
        # per request before the endpoint had done any work of its own. psycopg2 binds
        # parameters client-side, so the pair travels as a single statement and the user id
        # is still never formatted into the SQL here.
        db.execute(text("SET LOCAL ROLE " + RLS_ROLE + "; "
                        "SELECT set_config('app.user_id', :uid, true)"),
                   {"uid": str(int(user_id))})
    except Exception as e:
        db.rollback()
        print(f"[rls] could not enter tenant scope for user {user_id}: {e} "
              f"- falling back to application-level checks for this request.")
