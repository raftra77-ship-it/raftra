"""Creating your first organisation, with RLS actually switched on.

core.tenancy.ensure_personal_tenant() writes the two rows that start an organisation: a
`tenants` row and the `tenant_members` row that makes the caller its owner. Both tables
carry symmetric RLS clauses - USING and WITH CHECK are each
`IN (SELECT app_my_tenant_ids())` - so a row may only be written for a tenant the caller
already belongs to, and the first membership of a new tenant is never one of those. Under a
scoped session the function therefore failed on its own first statement.

Nothing caught it, for two reasons worth stating because they shaped this file:

  * the function has no callers yet, so no end-to-end test could reach it, and
  * test_creator_rls.py seeds its tenants as `postgres` with raw psycopg2 and then asserts
    SELECT visibility. Seeding is exactly the step that bypasses the policy being broken
    here, so the bug lived underneath a suite of 40 passing tenant-isolation tests.

The fix routes those two inserts through their own short-lived session, which is `postgres`
and so not subject to RLS. That is a deliberate bypass, so the point of this file is as
much the last two tests as the first three: the bypass must not have widened what a caller
can do. Relaxing the policies instead would have, because the only predicate available on
the candidate row is `user_id = app_current_user_id()`, and a policy permitting the
bootstrap by that rule equally permits inserting yourself into somebody else's
organisation - it is the same statement.

    RLS_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5433/raftra_rls_test \
        python -m pytest test_tenant_bootstrap.py -v
"""
import os
import sys
import uuid
from urllib.parse import urlsplit

import pytest

DSN = os.getenv("RLS_TEST_DATABASE_URL")
if not DSN:
    pytest.skip("RLS_TEST_DATABASE_URL is not set", allow_module_level=True)
if urlsplit(DSN).hostname not in ("127.0.0.1", "localhost", "::1"):
    pytest.skip("RLS_TEST_DATABASE_URL must be loopback", allow_module_level=True)

# Before importing `database`: ensure_personal_tenant opens database.SessionLocal() of its
# own, so the application's engine - not just a session this file makes - has to be bound to
# the test database for the function under test to reach it at all.
os.environ["DATABASE_URL"] = DSN
os.environ["ENABLE_RLS"] = "true"

if "database" in sys.modules:
    _already = sys.modules["database"].engine.url
    if _already.host not in ("127.0.0.1", "localhost", "::1") \
            or _already.database != urlsplit(DSN).path.lstrip("/"):
        pytest.skip(f"`database` was already imported and bound to {_already.database}; "
                    "run this file on its own so it can bind the test database",
                    allow_module_level=True)

import psycopg2                                                      # noqa: E402
import sqlalchemy as sa                                              # noqa: E402
from sqlalchemy.orm import sessionmaker                              # noqa: E402

import database                                                      # noqa: E402
import models                                                        # noqa: E402
from core import tenancy                                             # noqa: E402

assert database.engine.url.host in ("127.0.0.1", "localhost", "::1"), \
    "refusing to run: the engine is not loopback"

Session = sessionmaker(bind=database.engine, autocommit=False, autoflush=False)

# High ids so a seeded row can never collide with real data.
BOOTSTRAPPER, OUTSIDER = 7001, 7002
OUTSIDER_TENANT = uuid.UUID("77770000-0000-4000-8000-000000000001")


def _admin():
    # psycopg2 straight, not engine.raw_connection(): that hands back a pooled proxy whose
    # .autocommit does not reach the underlying connection, so the seed never commits and
    # every query in the scoped session below finds an empty database.
    c = psycopg2.connect(DSN)
    c.autocommit = True
    return c


@pytest.fixture(autouse=True)
def seeded():
    """Two users, and one organisation that belongs to the outsider only.

    Seeded as postgres on purpose: the point of the suite is what the POLICIES allow a
    request to do, so the starting state has to exist regardless of them.
    """
    conn = _admin()
    cur = conn.cursor()

    def wipe():
        cur.execute("DELETE FROM tenant_members WHERE user_id IN %(u)s",
                    {"u": (BOOTSTRAPPER, OUTSIDER)})
        # Any tenant this run created for the bootstrapper, plus the seeded one.
        cur.execute("DELETE FROM tenants WHERE id = %(t)s OR name = 'Boot Strapper'",
                    {"t": str(OUTSIDER_TENANT)})
        cur.execute("DELETE FROM users WHERE id IN %(u)s", {"u": (BOOTSTRAPPER, OUTSIDER)})

    wipe()
    cur.execute(
        "INSERT INTO users (id, email, first_name, last_name, role, is_active) VALUES "
        "(%s,'boot@test.example','Boot','Strapper','brand',true),"
        "(%s,'outsider@test.example','Out','Sider','brand',true)",
        (BOOTSTRAPPER, OUTSIDER))
    cur.execute("INSERT INTO tenants (id, name) VALUES (%s,'Outsider Org')",
                (str(OUTSIDER_TENANT),))
    cur.execute("INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (%s,%s,'owner')",
                (str(OUTSIDER_TENANT), OUTSIDER))
    yield
    wipe()
    cur.close()
    conn.close()


def scoped(user_id):
    """A session in a real tenant scope - the same two statements enter_tenant_scope issues."""
    db = Session()
    db.execute(sa.text("SET LOCAL ROLE raftra_app; "
                       "SELECT set_config('app.user_id', :uid, true)"),
               {"uid": str(user_id)})
    return db


# ------------------------------------------------------------------ the bootstrap itself

def test_creates_the_organisation_under_rls():
    """The statement that used to fail: "new row violates row-level security policy"."""
    db = scoped(BOOTSTRAPPER)
    try:
        tenant_id = tenancy.ensure_personal_tenant(db, db.get(models.User, BOOTSTRAPPER))
    finally:
        db.close()
    assert tenant_id is not None

    conn = _admin(); cur = conn.cursor()
    cur.execute("SELECT role FROM tenant_members WHERE tenant_id=%s AND user_id=%s",
                (str(tenant_id), BOOTSTRAPPER))
    row = cur.fetchone()
    cur.close(); conn.close()
    assert row is not None, "the owner membership row was not written"
    assert row[0] == "owner"


def test_is_idempotent():
    """Called twice it must return the same organisation, not make a second one."""
    db = scoped(BOOTSTRAPPER)
    try:
        first = tenancy.ensure_personal_tenant(db, db.get(models.User, BOOTSTRAPPER))
    finally:
        db.close()
    db = scoped(BOOTSTRAPPER)
    try:
        second = tenancy.ensure_personal_tenant(db, db.get(models.User, BOOTSTRAPPER))
    finally:
        db.close()
    assert first == second

    conn = _admin(); cur = conn.cursor()
    cur.execute("SELECT count(*) FROM tenant_members WHERE user_id=%s", (BOOTSTRAPPER,))
    n = cur.fetchone()[0]
    cur.close(); conn.close()
    assert n == 1, f"expected one membership, found {n}"


def test_caller_can_read_its_new_organisation():
    """The caller's own session must see the rows once the function returns, or the request
    that triggered the bootstrap carries on believing the user has no organisation."""
    db = scoped(BOOTSTRAPPER)
    try:
        tenant_id = tenancy.ensure_personal_tenant(db, db.get(models.User, BOOTSTRAPPER))
        visible = [r[0] for r in db.execute(sa.text("SELECT id FROM tenants")).fetchall()]
    finally:
        db.close()
    assert tenant_id in visible
    assert OUTSIDER_TENANT not in visible, "the bootstrap must not expose other organisations"


# ------------------------------------------------------- the bypass must stay narrow

def test_cannot_insert_self_into_someone_elses_organisation():
    """The attack a relaxed policy would have allowed.

    This is the reason the fix is a separate session rather than a looser WITH CHECK: the
    predicate that would permit the bootstrap (`user_id = app_current_user_id()`) is the
    same one that permits this.
    """
    db = scoped(BOOTSTRAPPER)
    try:
        with pytest.raises(sa.exc.ProgrammingError) as e:
            db.execute(sa.text("INSERT INTO tenant_members (tenant_id, user_id, role) "
                               "VALUES (:t, :u, 'owner')"),
                       {"t": str(OUTSIDER_TENANT), "u": BOOTSTRAPPER})
        assert "row-level security" in str(e.value).lower()
    finally:
        db.rollback(); db.close()


def test_bootstrap_does_not_grant_sight_of_other_organisations():
    """After bootstrapping, the caller still sees only their own - the new membership must
    not have been written against anyone else's tenant."""
    db = scoped(BOOTSTRAPPER)
    try:
        tenancy.ensure_personal_tenant(db, db.get(models.User, BOOTSTRAPPER))
        rows = db.execute(sa.text("SELECT tenant_id FROM tenant_members")).fetchall()
    finally:
        db.close()
    seen = {r[0] for r in rows}
    assert OUTSIDER_TENANT not in seen
    assert len(seen) == 1, f"expected exactly one organisation, saw {seen}"
