"""The creator portal end to end, with RLS actually switched on for the request.

The other two suites each hold one variable still: test_creator_rls.py drives SQL directly
as raftra_app, and test_chat_authz.py drives HTTP with RLS out of the picture. Neither
would have caught the failure that mattered, because that failure is the interaction - the
Python guard says yes, Postgres filters the row away, and the endpoint answers 200 with an
empty list or a misleading 403.

So the get_db override here issues the same two statements database.enter_tenant_scope()
issues on every authenticated request:

    SET LOCAL ROLE raftra_app;
    SELECT set_config('app.user_id', <id>, true);

Every query the handler then makes is subject to the policies. A test that passes here is
evidence about the running system, not about a mock.

The chokepoint under test is _my_handles() (influencer_deal_routes.py:86). It reads
`influencers` by user_id; before the creator policy existed it returned an empty set for
every creator, and that one empty set is what made /deals/mine answer [], /payouts/submit
answer 403 "You can only request payment for your own profile", and _deal_as_creator answer
404 for a deal the creator owned.

    RLS_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/raftra_rls_test \
        python -m pytest test_creator_portal_flow.py -v
"""
import os
import uuid
from urllib.parse import urlsplit

import pytest

DSN = os.getenv("RLS_TEST_DATABASE_URL")
if not DSN:
    pytest.skip("RLS_TEST_DATABASE_URL is not set", allow_module_level=True)
if urlsplit(DSN).hostname not in ("127.0.0.1", "localhost", "::1"):
    pytest.skip("RLS_TEST_DATABASE_URL must be loopback", allow_module_level=True)

import sqlalchemy as sa                                              # noqa: E402
from fastapi import FastAPI                                          # noqa: E402
from fastapi.testclient import TestClient                            # noqa: E402
from sqlalchemy.orm import sessionmaker                              # noqa: E402

import auth                                                          # noqa: E402
import database                                                      # noqa: E402
import influencer_deal_routes                                        # noqa: E402
import models                                                        # noqa: E402
import payout_routes                                                 # noqa: E402

BRAND, CREATOR, OTHER_CREATOR = 6001, 6101, 6102
TEN = uuid.UUID("eeeeeeee-0000-4000-8000-000000000005")
WS = 6010
INF, INF_OTHER = 6110, 6120
# Three deals for the creator, because payout_routes only allows one open request per deal
# (payout_routes.py:167) - reusing one deal across tests would hit that guard rather than
# the behaviour under test. All are "delivered": payouts are refused on any other status
# (payout_routes.py:179), which is a business rule, not an authorisation one.
IDEAL, IDEAL2, IDEAL3, IDEAL_OTHER = 6900, 6902, 6903, 6901
MY_DEALS = {IDEAL, IDEAL2, IDEAL3}
HANDLE, HANDLE_OTHER = "flowcreator", "othercreator"

_engine = sa.create_engine(DSN.replace("postgresql://", "postgresql+psycopg2://", 1))
Session = sessionmaker(bind=_engine)


@pytest.fixture(scope="module", autouse=True)
def seeded():
    s = Session()

    def wipe():
        s.rollback()
        for sql in ("DELETE FROM creator_payout_requests WHERE creator_handle IN :h",
                    "DELETE FROM influencer_deals WHERE id IN :d",
                    "DELETE FROM influencers WHERE id IN :i",
                    "DELETE FROM workspaces WHERE id IN :w",
                    "DELETE FROM tenant_members WHERE user_id IN :u",
                    "DELETE FROM tenants WHERE id IN :t",
                    "DELETE FROM users WHERE id IN :u"):
            s.execute(sa.text(sql), {"h": (HANDLE, HANDLE_OTHER),
                                     "d": (IDEAL, IDEAL2, IDEAL3, IDEAL_OTHER),
                                     "i": (INF, INF_OTHER),
                                     "w": (WS,), "u": (BRAND, CREATOR, OTHER_CREATOR),
                                     "t": (str(TEN),)})
        s.commit()

    wipe()
    s.execute(sa.text("INSERT INTO users (id,email,role,is_active) VALUES "
                      "(:b,'fb@t.invalid','brand',true),(:c,'fc@t.invalid','creator',true),"
                      "(:o,'fo@t.invalid','creator',true)"),
              {"b": BRAND, "c": CREATOR, "o": OTHER_CREATOR})
    s.execute(sa.text("INSERT INTO tenants (id,name) VALUES (:t,'Flow')"), {"t": str(TEN)})
    s.execute(sa.text("INSERT INTO tenant_members (tenant_id,user_id,role) "
                      "VALUES (:t,:b,'owner')"), {"t": str(TEN), "b": BRAND})
    s.execute(sa.text("INSERT INTO workspaces (id,name,user_id,tenant_id) "
                      "VALUES (:w,'Flow WS',:b,:t)"),
              {"w": WS, "b": BRAND, "t": str(TEN)})
    # The creator's handle is stored with the punctuation a real signup leaves behind.
    s.execute(sa.text("INSERT INTO influencers (id,handle,name,user_id,workspace_id) VALUES "
                      "(:i,:h,'Flow Creator',:c,:w),(:i2,:h2,'Other',:o,:w)"),
              {"i": INF, "h": "@FlowCreator ", "c": CREATOR, "w": WS,
               "i2": INF_OTHER, "h2": HANDLE_OTHER, "o": OTHER_CREATOR})
    s.execute(sa.text("INSERT INTO influencer_deals (id,workspace_id,influencer_handle,"
                      "status,amount) VALUES (:d,:w,:h,'delivered',500),"
                      "(:d2,:w,:h,'delivered',500),(:d3,:w,:h,'delivered',500),"
                      "(:do,:w,:h2,'delivered',700)"),
              {"d": IDEAL, "d2": IDEAL2, "d3": IDEAL3, "w": WS, "h": HANDLE,
               "do": IDEAL_OTHER, "h2": HANDLE_OTHER})
    s.commit()
    yield
    wipe()
    s.close()


def scoped_client(user_id):
    """A client whose every request runs inside a real tenant scope."""
    app = FastAPI()
    app.include_router(influencer_deal_routes.router)
    app.include_router(payout_routes.router)

    holder = Session()
    user = holder.get(models.User, user_id)

    def get_db():
        db = Session()
        try:
            # Exactly database.enter_tenant_scope(), issued as one statement the way the
            # real one is, so the role switch and the identity share a transaction.
            db.execute(sa.text("SET LOCAL ROLE raftra_app; "
                               "SELECT set_config('app.user_id', :uid, true)"),
                       {"uid": str(user_id)})
            yield db
        finally:
            db.rollback()
            db.close()

    app.dependency_overrides[auth.get_current_user] = lambda: user
    app.dependency_overrides[database.get_db] = get_db
    return TestClient(app, raise_server_exceptions=False)


# ------------------------------------------------------------------ the chokepoint

def test_my_handles_resolves_under_rls():
    """Everything else depends on this one query seeing the creator's own row."""
    db = Session()
    db.execute(sa.text("SET LOCAL ROLE raftra_app; "
                       "SELECT set_config('app.user_id', :u, true)"), {"u": str(CREATOR)})
    user = models.User(id=CREATOR)
    handles = influencer_deal_routes._my_handles(db, user)
    db.rollback()
    db.close()
    assert handles == {HANDLE}, (
        "_my_handles() is empty under RLS - the creator portal cannot work. "
        f"got {handles!r}")


def test_a_creator_cannot_see_another_creators_handle():
    db = Session()
    db.execute(sa.text("SET LOCAL ROLE raftra_app; "
                       "SELECT set_config('app.user_id', :u, true)"), {"u": str(CREATOR)})
    handles = influencer_deal_routes._my_handles(db, models.User(id=CREATOR))
    db.rollback()
    db.close()
    assert HANDLE_OTHER not in handles


# ------------------------------------------------------------------ /api/deals/mine

def test_deals_mine_returns_the_creators_own_deals():
    r = scoped_client(CREATOR).get("/api/deals/mine")
    assert r.status_code == 200, r.text
    ids = {d["id"] for d in r.json()}
    assert ids == MY_DEALS, f"expected the creator's own deals, got {ids}"


def test_deals_mine_excludes_another_creators_deal():
    r = scoped_client(CREATOR).get("/api/deals/mine")
    assert IDEAL_OTHER not in [d["id"] for d in r.json()]


def test_the_other_creator_sees_only_their_own():
    r = scoped_client(OTHER_CREATOR).get("/api/deals/mine")
    assert r.status_code == 200, r.text
    assert [d["id"] for d in r.json()] == [IDEAL_OTHER]


# ------------------------------------------------------------------ payouts

def test_creator_can_submit_a_payout_request():
    """This answered 403 'You can only request payment for your own profile' for every
    creator, because the handle set it checked against was empty."""
    r = scoped_client(CREATOR).post("/api/payouts/submit", json={
        "creator_handle": HANDLE, "deal_id": IDEAL, "upi_id": "flow@upi"})
    assert r.status_code == 200, r.text


def test_creator_cannot_submit_under_another_handle():
    r = scoped_client(CREATOR).post("/api/payouts/submit", json={
        "creator_handle": HANDLE_OTHER, "deal_id": IDEAL_OTHER, "upi_id": "x@upi"})
    assert r.status_code == 403, r.text


def test_payout_history_shows_only_my_requests():
    a = scoped_client(CREATOR).post("/api/payouts/submit", json={
        "creator_handle": HANDLE, "deal_id": IDEAL2, "upi_id": "flow@upi"})
    b = scoped_client(OTHER_CREATOR).post("/api/payouts/submit", json={
        "creator_handle": HANDLE_OTHER, "deal_id": IDEAL_OTHER, "upi_id": "o@upi"})
    assert a.status_code == 200, a.text
    assert b.status_code == 200, b.text

    r = scoped_client(CREATOR).get("/api/payouts/mine")
    assert r.status_code == 200, r.text
    handles = {row.get("creator_handle") for row in r.json()}
    assert handles <= {HANDLE}, f"another creator's payout leaked: {handles}"


def test_the_write_actually_reached_the_database():
    """A 200 is not evidence. Read the row back as the owner, outside the request."""
    r = scoped_client(CREATOR).post("/api/payouts/submit", json={
        "creator_handle": HANDLE, "deal_id": IDEAL3, "upi_id": "proof@upi"})
    assert r.status_code == 200, r.text
    db = Session()
    n = db.execute(sa.text("SELECT count(*) FROM creator_payout_requests "
                           "WHERE creator_handle = :h AND upi_id = 'proof@upi'"),
                   {"h": HANDLE}).scalar()
    db.close()
    assert n >= 1, "the endpoint answered 200 but wrote nothing"
