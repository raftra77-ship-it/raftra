"""Session-wide guarantee that a test run cannot reach production.

This exists because adding config.py's loopback check turned two modules red at
collection - test_creative_route_http.py and test_generation.py both import `database`,
which until now resolved DATABASE_URL from backend/.env. That file holds the production
Supabase DSN, so those two modules had been binding a SQLAlchemy engine to production on
every `pytest` run. Nothing connected (create_engine only builds a pool, and
test_creative_route_http overrides get_db with `lambda: None`), but the engine was there,
one stray query away from being used.

So: pin APP_ENV to "test", and if DATABASE_URL is missing or points anywhere other than
loopback, replace it with a placeholder before any test module is imported. The
replacement is announced rather than silent - a test run that quietly rewrites your
configuration is its own kind of trap.

Suites that need a real local database (test_creator_rls, test_creator_portal_flow,
test_auth_real, test_chat_authz, test_influencer_journey) set DATABASE_URL themselves from
RLS_TEST_DATABASE_URL at module import, which happens after this file. Their value is
loopback, so it is left alone.
"""
import os
from urllib.parse import urlsplit

LOOPBACK = {"127.0.0.1", "localhost", "::1"}
PLACEHOLDER = "postgresql://postgres@127.0.0.1:5432/raftra_test_placeholder"

os.environ["APP_ENV"] = "test"

_current = (os.getenv("DATABASE_URL") or "").strip()
_host = ""
if _current:
    try:
        _host = (urlsplit(_current).hostname or "").strip()
    except ValueError:
        _host = ""

if _host not in LOOPBACK:
    if _current:
        print("[conftest] DATABASE_URL pointed at %r, which is not loopback. Replacing it "
              "with a local placeholder for this test session - tests never talk to a "
              "remote database." % (_host or "an unparseable host"))
    else:
        print("[conftest] DATABASE_URL was not set; using a local placeholder for this "
              "test session.")
    os.environ["DATABASE_URL"] = PLACEHOLDER

# Nothing here should wake the embedding model or the schedulers.
os.environ.setdefault("SKIP_EMBEDDING_PRELOAD", "1")
os.environ.setdefault("DISABLE_SCHEDULED_TASKS", "true")
