import os

# Resolves APP_ENV, loads the env files by absolute path instead of by walking up from
# the current directory, and refuses a remote database outside production - all at import,
# before an engine exists. This replaces a bare `load_dotenv()` that found whichever .env
# was nearest, which in this repository is the one holding the production DSN. See
# config.py for the whole story.
from config import settings

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = settings.database_url

# Name the driver explicitly rather than letting SQLAlchemy pick one.
#
# A bare "postgresql://" means "the default Postgres driver", and the default MOVED:
# SQLAlchemy 2.0 resolves it to psycopg2, 2.1 resolves it to psycopg (v3). Only
# psycopg2-binary is installed (see requirements-deploy.txt), so the day 2.1.1 was
# released every deploy began failing at import with
#
#     ModuleNotFoundError: No module named 'psycopg'
#
# on an unchanged URL and an unchanged commit - the dependency is unpinned, so Render
# picked up the new major on its next build while local machines stayed on 2.0.x and saw
# nothing. requirements-deploy.txt now pins <2.1 as well; this line is the belt to that
# braces, so the URL keeps working whenever the pin is eventually lifted.
#
# Only the bare form is rewritten. An explicit "+psycopg", "+asyncpg" or any other driver
# is a deliberate choice and is left exactly as written.
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)
elif DATABASE_URL.startswith("postgres://"):
    # The legacy Heroku-style scheme, which SQLAlchemy dropped entirely in 1.4.
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)

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

    # Pool sized to what the SERVER will actually allow, not to what this process would like.
    #
    # This asked for pool_size=20 + max_overflow=40 — up to 60 connections. Supabase's
    # session-mode pooler caps the whole project at 15:
    #
    #   FATAL: (EMAXCONNSESSION) max clients reached in session mode
    #          — max clients are limited to pool_size: 15
    #
    # and that 15 is shared with every other client of the same project, the deployed Render
    # service included. Asking for 60 does not get 60; it gets connection attempts that block
    # until something frees up or pool_timeout expires, which is why requests intermittently
    # took seconds and sometimes failed outright.
    #
    # 5 + 5 leaves real headroom under the cap for the deployed API and for psql sessions.
    # Both are env-overridable so a deployment on a larger plan can raise them without a code
    # change — and if you move to the transaction-mode pooler (port 6543), which allows far
    # more clients, that is the knob to turn.
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=_PRE_PING,
        pool_size=int(os.getenv("DB_POOL_SIZE", "5")),
        max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "5")),
        pool_timeout=int(os.getenv("DB_POOL_TIMEOUT_SEC", "30")),
        pool_recycle=int(os.getenv("DB_POOL_RECYCLE_SEC", "300")),
    )
    # create_engine() builds a pool; it does not connect. The old message here claimed a
    # successful Supabase connection for any syntactically valid URL, including a local
    # one - which is worse than silence when the question is "which database am I on?".
    # Host and database name only; never the credentials.
    print("[db] %s" % settings.describe())
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


# Whether the scope switch is actually working, as opposed to configured.
#
# enter_tenant_scope() never raises: if the role or the policies are missing it logs and
# lets the request continue under the application-level checks. That is the right call for
# availability and a terrible one for knowing where you stand - the deployment keeps
# serving traffic, ENABLE_RLS still reads "true", and the only trace is a log line on a
# host nobody tails. A deployment can therefore believe it has database-level tenant
# isolation while every request runs unscoped.
#
# These counters make the difference observable. Process-local and approximate by design:
# they are a health signal, not an audit log, and a restart resets them.
_RLS_SCOPED_OK = 0
_RLS_FELL_BACK = 0
_RLS_LAST_ERROR = None


def rls_status() -> dict:
    """Is tenant isolation actually in force, or only switched on?

    Surfaced through /api/admin/summary, because "ENABLE_RLS=true" answers a different
    question from "the database is filtering rows". Counts are since this process started.
    """
    configured = rls_enabled()
    attempted = _RLS_SCOPED_OK + _RLS_FELL_BACK
    return {
        "enabled": configured,
        "role": RLS_ROLE,
        "requests_scoped": _RLS_SCOPED_OK,
        "requests_fell_back": _RLS_FELL_BACK,
        "last_error": _RLS_LAST_ERROR,
        # The state worth alarming on: switched on, has been exercised, and is failing
        # every time - which looks identical to working from outside.
        "silently_unenforced": bool(configured and attempted and not _RLS_SCOPED_OK),
        "detail": (
            "ENABLE_RLS is off; tenant isolation rests on the application-level checks only."
            if not configured else
            "No authenticated request has entered a tenant scope yet since this process "
            "started, so there is nothing to report."
            if not attempted else
            "Every attempt to enter a tenant scope has failed and fallen back to "
            "application-level checks. The database is NOT filtering rows, though "
            "ENABLE_RLS reads true. Check that the %s role and the policies exist." % RLS_ROLE
            if not _RLS_SCOPED_OK else
            "Tenant scope is being entered; the database is filtering rows."
            if not _RLS_FELL_BACK else
            "Mostly working, but some requests fell back - see last_error."
        ),
    }


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
        global _RLS_SCOPED_OK
        _RLS_SCOPED_OK += 1
    except Exception as e:
        db.rollback()
        global _RLS_FELL_BACK, _RLS_LAST_ERROR
        _RLS_FELL_BACK += 1
        _RLS_LAST_ERROR = str(e)[:300]
        print(f"[rls] could not enter tenant scope for user {user_id}: {e} "
              f"- falling back to application-level checks for this request.")
