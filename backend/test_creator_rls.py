"""Row Level Security, exercised as the real application role against a real Postgres.

These are not mocks. Each probe opens a transaction, switches into `raftra_app` with
SET LOCAL ROLE - the same two statements database.enter_tenant_scope() issues on every
authenticated request - and asks Postgres what that identity can see. The transaction is
rolled back, so a probe never changes anything.

Switching role matters: the connection authenticates as `postgres`, which carries
BYPASSRLS, so a query run without the switch proves nothing at all. Every assertion here
runs after the switch, and `test_the_connection_role_would_bypass_rls` pins that down
explicitly so nobody later mistakes a passing suite for a working policy.

Requires a local Postgres with the schema migrated to head. Point RLS_TEST_DATABASE_URL at
it; without that the module skips rather than inventing a database. It refuses to run
against anything that is not loopback, so it can never touch Supabase.

    createdb raftra_rls_test
    RLS_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/raftra_rls_test \
        python -m pytest test_creator_rls.py -v
"""
import contextlib
import os
import uuid
from urllib.parse import urlsplit

import pytest

psycopg2 = pytest.importorskip("psycopg2")

DSN = os.getenv("RLS_TEST_DATABASE_URL")
if not DSN:
    pytest.skip("RLS_TEST_DATABASE_URL is not set", allow_module_level=True)
if urlsplit(DSN).hostname not in ("127.0.0.1", "localhost", "::1"):
    pytest.skip("RLS_TEST_DATABASE_URL must be loopback", allow_module_level=True)

# Identities. High ids so a seeded row can never collide with real data.
BRAND_A, BRAND_B = 9001, 9002
CREATOR_A, CREATOR_B = 9101, 9102
ADMIN, STRANGER = 9200, 9300
TENANT_A = uuid.UUID("aaaaaaaa-0000-4000-8000-000000000001")
TENANT_B = uuid.UUID("bbbbbbbb-0000-4000-8000-000000000002")
WS_A, WS_B = 9010, 9020
INF_A, INF_B = 9110, 9120
DEAL_ACTIVE_A, DEAL_DRAFT_A, DEAL_ACTIVE_B = 9500, 9501, 9502
APP_A, APP_B = 9600, 9601
SUB_A, SUB_B = 9700, 9701
PAYOUT_A, PAYOUT_B = 9800, 9801
IDEAL_A, IDEAL_B = 9900, 9901
MSG_A, MSG_B = 9950, 9951
ASSET_A, ASSET_B = 9960, 9961
TXN_A, TXN_C = 9970, 9971
PLAN = 9980

# Creator A's handle is stored deliberately badly - leading '@', trailing space, mixed case
# - because every creator policy joins on it. core/marketplace.py normalises with
# clean_handle(); app_norm_handle() has to agree or the policies silently match nothing.
HANDLE_A_RAW = "@CreatorA "
HANDLE_A = "creatora"
HANDLE_B = "creatorb"


def _admin_conn():
    c = psycopg2.connect(DSN)
    c.autocommit = True
    return c


@contextlib.contextmanager
def as_user(user_id, role="raftra_app"):
    """One probe, as the application role, rolled back afterwards."""
    conn = psycopg2.connect(DSN)
    try:
        cur = conn.cursor()
        cur.execute("SET LOCAL ROLE %s" % role)
        if user_id is not None:
            cur.execute("SELECT set_config('app.user_id', %s, true)", (str(user_id),))
        yield cur
    finally:
        conn.rollback()
        conn.close()


def ids(cur, sql, args=None):
    cur.execute(sql, args)
    return sorted(r[0] for r in cur.fetchall())


@pytest.fixture(scope="module", autouse=True)
def seeded():
    """Two brands, two creators, an admin and a stranger, with data on both sides."""
    conn = _admin_conn()
    cur = conn.cursor()

    def wipe():
        for sql in (
            "DELETE FROM chat_messages WHERE id IN %(m)s",
            "DELETE FROM deal_deliverable_submissions WHERE id IN %(s)s",
            "DELETE FROM creator_payout_requests WHERE id IN %(p)s",
            "DELETE FROM deal_applications WHERE id IN %(a)s",
            "DELETE FROM influencer_deals WHERE id IN %(d)s",
            "DELETE FROM posted_deals WHERE id IN %(pd)s",
            "DELETE FROM ad_assets WHERE id IN %(as)s",
            "DELETE FROM transactions WHERE id IN %(tx)s",
            "DELETE FROM plans WHERE id IN %(pl)s",
            "DELETE FROM influencers WHERE id IN %(i)s",
            "DELETE FROM workspaces WHERE id IN %(w)s",
            "DELETE FROM tenant_members WHERE user_id IN %(u)s",
            "DELETE FROM tenants WHERE id IN %(t)s",
            "DELETE FROM users WHERE id IN %(u)s",
        ):
            cur.execute(sql, {
                "m": (MSG_A, MSG_B), "s": (SUB_A, SUB_B), "p": (PAYOUT_A, PAYOUT_B),
                "a": (APP_A, APP_B), "d": (IDEAL_A, IDEAL_B),
                "pd": (DEAL_ACTIVE_A, DEAL_DRAFT_A, DEAL_ACTIVE_B),
                "as": (ASSET_A, ASSET_B), "tx": (TXN_A, TXN_C), "pl": (PLAN,),
                "i": (INF_A, INF_B), "w": (WS_A, WS_B),
                "u": (BRAND_A, BRAND_B, CREATOR_A, CREATOR_B, ADMIN, STRANGER),
                "t": (str(TENANT_A), str(TENANT_B)),
            })

    wipe()
    cur.execute(
        "INSERT INTO users (id, email, role, is_active) VALUES "
        "(%s,'branda@test.invalid','brand',true), (%s,'brandb@test.invalid','brand',true),"
        "(%s,'creatora@test.invalid','creator',true),"
        "(%s,'creatorb@test.invalid','creator',true),"
        "(%s,'admin@test.invalid','admin',true),"
        "(%s,'stranger@test.invalid','brand',true)",
        (BRAND_A, BRAND_B, CREATOR_A, CREATOR_B, ADMIN, STRANGER))
    cur.execute("INSERT INTO tenants (id, name) VALUES (%s,'Tenant A'), (%s,'Tenant B')",
                (str(TENANT_A), str(TENANT_B)))
    cur.execute("INSERT INTO tenant_members (tenant_id, user_id, role) VALUES "
                "(%s,%s,'owner'), (%s,%s,'owner')",
                (str(TENANT_A), BRAND_A, str(TENANT_B), BRAND_B))
    cur.execute("INSERT INTO workspaces (id, name, user_id, tenant_id) VALUES "
                "(%s,'Brand A WS',%s,%s), (%s,'Brand B WS',%s,%s)",
                (WS_A, BRAND_A, str(TENANT_A), WS_B, BRAND_B, str(TENANT_B)))
    cur.execute("INSERT INTO influencers (id, handle, name, user_id, workspace_id) VALUES "
                "(%s,%s,'Creator A',%s,%s), (%s,%s,'Creator B',%s,%s)",
                (INF_A, HANDLE_A_RAW, CREATOR_A, WS_A,
                 INF_B, HANDLE_B, CREATOR_B, WS_B))
    cur.execute("INSERT INTO posted_deals (id, workspace_id, campaign_name, status) VALUES "
                "(%s,%s,'A active','ACTIVE'), (%s,%s,'A draft','DRAFT'),"
                "(%s,%s,'B active','ACTIVE')",
                (DEAL_ACTIVE_A, WS_A, DEAL_DRAFT_A, WS_A, DEAL_ACTIVE_B, WS_B))
    cur.execute("INSERT INTO deal_applications (id, deal_id, workspace_id, creator_handle,"
                " status) VALUES (%s,%s,%s,%s,'APPLIED'), (%s,%s,%s,%s,'APPLIED')",
                (APP_A, DEAL_ACTIVE_A, WS_A, HANDLE_A,
                 APP_B, DEAL_ACTIVE_B, WS_B, HANDLE_B))
    cur.execute("INSERT INTO deal_deliverable_submissions (id, application_id, deal_id,"
                " title, status) VALUES (%s,%s,%s,'A work','SUBMITTED'),"
                " (%s,%s,%s,'B work','SUBMITTED')",
                (SUB_A, APP_A, DEAL_ACTIVE_A, SUB_B, APP_B, DEAL_ACTIVE_B))
    cur.execute("INSERT INTO creator_payout_requests (id, creator_handle, account_number,"
                " status) VALUES (%s,%s,'1111','submitted'), (%s,%s,'2222','submitted')",
                (PAYOUT_A, HANDLE_A, PAYOUT_B, HANDLE_B))
    cur.execute("INSERT INTO influencer_deals (id, workspace_id, influencer_handle, status)"
                " VALUES (%s,%s,%s,'ACTIVE'), (%s,%s,%s,'ACTIVE')",
                (IDEAL_A, WS_A, HANDLE_A, IDEAL_B, WS_B, HANDLE_B))
    cur.execute("INSERT INTO chat_messages (id, workspace_id, influencer_id, sender_type,"
                " content) VALUES (%s,%s,%s,'brand','hi A'), (%s,%s,%s,'brand','hi B')",
                (MSG_A, WS_A, INF_A, MSG_B, WS_B, INF_B))
    cur.execute("INSERT INTO ad_assets (id, workspace_id, headline) VALUES "
                "(%s,%s,'A asset'), (%s,%s,'B asset')",
                (ASSET_A, WS_A, ASSET_B, WS_B))
    cur.execute("INSERT INTO transactions (id, owner_id, amount, status) VALUES "
                "(%s,%s,100,'paid'), (%s,%s,200,'paid')",
                (TXN_A, BRAND_A, TXN_C, CREATOR_A))
    cur.execute("INSERT INTO plans (id, name, price_inr) VALUES (%s,'Test Plan',0)",
                (PLAN,))
    yield
    wipe()
    cur.close()
    conn.close()


# ----------------------------------------------------------------- the role switch itself

def test_the_connection_role_would_bypass_rls():
    """Without SET LOCAL ROLE every assertion below would be vacuous."""
    conn = _admin_conn()
    cur = conn.cursor()
    cur.execute("SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user")
    assert cur.fetchone()[0] is True, "connection role no longer bypasses RLS"
    cur.execute("SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname='raftra_app'")
    bypass, sup = cur.fetchone()
    assert not bypass and not sup, "raftra_app must not be able to bypass RLS"
    conn.close()


def test_handle_normalisation_matches_python_clean_handle():
    """core/marketplace.py: value.replace('@','').strip().lower()"""
    from core.marketplace import clean_handle
    conn = _admin_conn()
    cur = conn.cursor()
    for raw in ("@CreatorA ", "CREATORA", " creatora ", "@creatora"):
        cur.execute("SELECT app_norm_handle(%s)", (raw,))
        assert cur.fetchone()[0] == clean_handle(raw) == "creatora"
    conn.close()


# ----------------------------------------------------------------- 1. creator vs creator

@pytest.mark.parametrize("table,column", [
    ("influencers", "id"),
    ("influencer_deals", "id"),
    ("deal_applications", "id"),
    ("deal_deliverable_submissions", "id"),
    ("creator_payout_requests", "id"),
    ("chat_messages", "id"),
])
def test_creator_a_cannot_see_creator_b(table, column):
    mine = {"influencers": INF_A, "influencer_deals": IDEAL_A, "deal_applications": APP_A,
            "deal_deliverable_submissions": SUB_A, "creator_payout_requests": PAYOUT_A,
            "chat_messages": MSG_A}[table]
    theirs = {"influencers": INF_B, "influencer_deals": IDEAL_B,
              "deal_applications": APP_B, "deal_deliverable_submissions": SUB_B,
              "creator_payout_requests": PAYOUT_B, "chat_messages": MSG_B}[table]
    with as_user(CREATOR_A) as cur:
        seen = ids(cur, "SELECT %s FROM %s WHERE %s IN (%%s,%%s)"
                        % (column, table, column), (mine, theirs))
    assert mine in seen, f"creator A cannot see their own {table} row"
    assert theirs not in seen, f"LEAK: creator A can see creator B's {table} row"


def test_creator_a_cannot_read_creator_b_bank_details():
    with as_user(CREATOR_A) as cur:
        cur.execute("SELECT account_number FROM creator_payout_requests")
        assert [r[0] for r in cur.fetchall()] == ["1111"]


# ----------------------------------------------------------------- 2. creator vs brand

def test_creator_cannot_see_a_brands_private_workspace():
    with as_user(CREATOR_A) as cur:
        assert ids(cur, "SELECT id FROM workspaces") == []
        assert ids(cur, "SELECT id FROM ad_assets") == []
        assert ids(cur, "SELECT id FROM posted_deals WHERE status <> 'ACTIVE'") == []


def test_creator_sees_active_briefs_but_not_drafts():
    """The public marketplace clause, and its limit."""
    with as_user(CREATOR_A) as cur:
        seen = ids(cur, "SELECT id FROM posted_deals")
    assert DEAL_ACTIVE_A in seen and DEAL_ACTIVE_B in seen
    assert DEAL_DRAFT_A not in seen, "LEAK: a DRAFT brief is visible to a creator"


def test_creator_cannot_write_a_brief():
    with as_user(CREATOR_A) as cur:
        with pytest.raises(psycopg2.errors.InsufficientPrivilege):
            cur.execute("INSERT INTO posted_deals (id, workspace_id, campaign_name, status)"
                        " VALUES (99999, %s, 'forged', 'ACTIVE')", (WS_A,))


# ----------------------------------------------------------------- 3. brand vs brand

@pytest.mark.parametrize("table,mine,theirs", [
    ("ad_assets", ASSET_A, ASSET_B),
    ("posted_deals", DEAL_DRAFT_A, DEAL_ACTIVE_B),
    ("influencers", INF_A, INF_B),
    ("deal_applications", APP_A, APP_B),
    ("chat_messages", MSG_A, MSG_B),
])
def test_brand_a_cannot_see_brand_b(table, mine, theirs):
    with as_user(BRAND_A) as cur:
        seen = ids(cur, "SELECT id FROM %s WHERE id IN (%%s,%%s)" % table, (mine, theirs))
    assert mine in seen, f"brand A lost access to its own {table} row"
    assert theirs not in seen, f"LEAK: brand A can see brand B's {table} row"


def test_a_brand_cannot_read_a_rivals_active_brief():
    """The marketplace arm is for creators. An ungated `status = 'ACTIVE'` would hand
    Brand A Brand B's live campaign briefs - name, product, budget, requirements."""
    with as_user(BRAND_A) as cur:
        assert DEAL_ACTIVE_B not in ids(cur, "SELECT id FROM posted_deals")
        cur.execute("SELECT app_is_creator()")
        assert cur.fetchone()[0] is False
    with as_user(CREATOR_A) as cur:
        assert DEAL_ACTIVE_B in ids(cur, "SELECT id FROM posted_deals")


def test_brand_workspace_isolation_is_unchanged():
    with as_user(BRAND_A) as cur:
        assert ids(cur, "SELECT id FROM workspaces") == [WS_A]
    with as_user(BRAND_B) as cur:
        assert ids(cur, "SELECT id FROM workspaces") == [WS_B]


# ----------------------------------------------------------------- 4. creator's own work

def test_creator_sees_own_deals_and_applications():
    with as_user(CREATOR_A) as cur:
        assert ids(cur, "SELECT id FROM influencer_deals") == [IDEAL_A]
        assert ids(cur, "SELECT id FROM deal_applications") == [APP_A]
        assert ids(cur, "SELECT id FROM influencers") == [INF_A]


def test_creator_can_submit_a_deliverable():
    with as_user(CREATOR_A) as cur:
        cur.execute("INSERT INTO deal_deliverable_submissions "
                    "(id, application_id, deal_id, title, status) "
                    "VALUES (99001, %s, %s, 'new work', 'SUBMITTED')",
                    (APP_A, DEAL_ACTIVE_A))
        assert ids(cur, "SELECT id FROM deal_deliverable_submissions") == [SUB_A, 99001]


def test_creator_cannot_submit_against_another_creators_application():
    with as_user(CREATOR_A) as cur:
        with pytest.raises(psycopg2.errors.InsufficientPrivilege):
            cur.execute("INSERT INTO deal_deliverable_submissions "
                        "(id, application_id, deal_id, title) "
                        "VALUES (99002, %s, %s, 'stolen')", (APP_B, DEAL_ACTIVE_B))


# ----------------------------------------------------------------- 5. payouts

def test_creator_can_submit_and_read_own_payout_request():
    with as_user(CREATOR_A) as cur:
        cur.execute("INSERT INTO creator_payout_requests (id, creator_handle, upi_id,"
                    " status) VALUES (99003, %s, 'a@upi', 'submitted')", (HANDLE_A,))
        assert ids(cur, "SELECT id FROM creator_payout_requests") == [PAYOUT_A, 99003]


def test_creator_cannot_file_a_payout_under_another_handle():
    with as_user(CREATOR_A) as cur:
        with pytest.raises(psycopg2.errors.InsufficientPrivilege):
            cur.execute("INSERT INTO creator_payout_requests (id, creator_handle, status)"
                        " VALUES (99004, %s, 'submitted')", (HANDLE_B,))


def test_brand_cannot_read_creator_bank_details():
    """Payout review is admin work; grant_admin.py says so explicitly."""
    with as_user(BRAND_A) as cur:
        assert ids(cur, "SELECT id FROM creator_payout_requests") == []


# ----------------------------------------------------------------- 6. chat, both ways

def test_chat_is_visible_to_both_participants():
    with as_user(BRAND_A) as cur:
        assert MSG_A in ids(cur, "SELECT id FROM chat_messages")
    with as_user(CREATOR_A) as cur:
        assert MSG_A in ids(cur, "SELECT id FROM chat_messages")


def test_both_participants_can_send():
    with as_user(CREATOR_A) as cur:
        cur.execute("INSERT INTO chat_messages (id, workspace_id, influencer_id,"
                    " sender_type, content) VALUES (99005,%s,%s,'influencer','from creator')",
                    (WS_A, INF_A))
    with as_user(BRAND_A) as cur:
        cur.execute("INSERT INTO chat_messages (id, workspace_id, influencer_id,"
                    " sender_type, content) VALUES (99006,%s,%s,'brand','from brand')",
                    (WS_A, INF_A))


# ----------------------------------------------------------------- 7. outsiders

def test_stranger_sees_nothing():
    with as_user(STRANGER) as cur:
        for t in ("chat_messages", "influencers", "deal_applications",
                  "creator_payout_requests", "influencer_deals", "ad_assets"):
            assert ids(cur, "SELECT id FROM %s" % t) == [], f"LEAK: stranger read {t}"


def test_stranger_cannot_update_someone_elses_message():
    """The database backstop for the mark_message_read IDOR."""
    with as_user(STRANGER) as cur:
        cur.execute("UPDATE chat_messages SET read_at = now() WHERE id = %s", (MSG_A,))
        assert cur.rowcount == 0, "LEAK: a stranger updated another tenant's message"


def test_creator_b_cannot_update_creator_a_message():
    with as_user(CREATOR_B) as cur:
        cur.execute("UPDATE chat_messages SET read_at = now() WHERE id = %s", (MSG_A,))
        assert cur.rowcount == 0


def test_unauthenticated_scope_sees_nothing():
    """No app.user_id set at all - a request that never reached enter_tenant_scope."""
    with as_user(None) as cur:
        assert ids(cur, "SELECT id FROM chat_messages") == []
        assert ids(cur, "SELECT id FROM creator_payout_requests") == []


# ----------------------------------------------------------------- 8. admin and bad roles

def test_admin_can_see_both_sides():
    with as_user(ADMIN) as cur:
        assert {MSG_A, MSG_B} <= set(ids(cur, "SELECT id FROM chat_messages"))
        assert {PAYOUT_A, PAYOUT_B} <= set(ids(cur, "SELECT id FROM creator_payout_requests"))
        assert {INF_A, INF_B} <= set(ids(cur, "SELECT id FROM influencers"))


def test_admin_is_decided_by_the_database_not_the_caller():
    """app_is_admin() reads users.role; a non-admin cannot claim it."""
    with as_user(CREATOR_A) as cur:
        cur.execute("SELECT app_is_admin()")
        assert cur.fetchone()[0] is False
    with as_user(ADMIN) as cur:
        cur.execute("SELECT app_is_admin()")
        assert cur.fetchone()[0] is True


def test_a_user_id_that_does_not_exist_grants_nothing():
    with as_user(987654) as cur:
        cur.execute("SELECT app_is_admin()")
        assert cur.fetchone()[0] is False
        assert ids(cur, "SELECT id FROM creator_payout_requests") == []


# ----------------------------------------------------------------- 9. users table

def test_users_is_self_only_and_no_longer_deny_all():
    with as_user(CREATOR_A) as cur:
        assert ids(cur, "SELECT id FROM users") == [CREATOR_A]
    with as_user(BRAND_A) as cur:
        assert ids(cur, "SELECT id FROM users") == [BRAND_A]
    with as_user(ADMIN) as cur:
        assert {BRAND_A, CREATOR_A, CREATOR_B} <= set(ids(cur, "SELECT id FROM users"))


# ------------------------------------------------- billing: the other two deny-all tables

def test_transactions_are_self_only():
    """GET /api/payments/transactions runs under tenant scope, so with no policy the
    billing history was empty for everyone."""
    with as_user(BRAND_A) as cur:
        assert ids(cur, "SELECT id FROM transactions") == [TXN_A]
    with as_user(CREATOR_A) as cur:
        assert ids(cur, "SELECT id FROM transactions") == [TXN_C]
    with as_user(CREATOR_B) as cur:
        assert ids(cur, "SELECT id FROM transactions") == []


def test_admin_sees_all_transactions():
    with as_user(ADMIN) as cur:
        assert {TXN_A, TXN_C} <= set(ids(cur, "SELECT id FROM transactions"))


def test_plans_are_readable_by_everyone_but_writable_only_by_admin():
    """Global reference data. The pricing page needs it; nobody else may change it."""
    for who in (BRAND_A, CREATOR_A, STRANGER):
        with as_user(who) as cur:
            assert PLAN in ids(cur, "SELECT id FROM plans")
    with as_user(CREATOR_A) as cur:
        with pytest.raises(psycopg2.errors.InsufficientPrivilege):
            cur.execute("INSERT INTO plans (id,name,price_inr) VALUES (99100,'Forged',0)")
    with as_user(ADMIN) as cur:
        cur.execute("INSERT INTO plans (id,name,price_inr) VALUES (99101,'By admin',1)")


def test_admin_user_listing_is_possible_again():
    """admin_routes.py:33 lists every user under tenant scope. With users deny-all it
    returned nothing to an administrator."""
    with as_user(ADMIN) as cur:
        seen = set(ids(cur, "SELECT id FROM users"))
    assert {BRAND_A, BRAND_B, CREATOR_A, CREATOR_B, ADMIN} <= seen


def test_no_table_is_rls_enabled_without_a_policy():
    """The ensure_rls trap: RLS on with no policy is deny-all and looks like a bug."""
    conn = _admin_conn()
    cur = conn.cursor()
    cur.execute("""SELECT c.relname FROM pg_class c
                   JOIN pg_namespace n ON n.oid = c.relnamespace
                   WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity
                     AND c.relname NOT IN ('alembic_version', 'deals')
                     AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid)
                   ORDER BY 1""")
    offenders = [r[0] for r in cur.fetchall()]
    conn.close()
    assert offenders == [], f"RLS enabled with no policy (deny-all) on: {offenders}"
