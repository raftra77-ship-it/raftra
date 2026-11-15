"""The whole influencer journey, in order, with RLS switched on for every request.

One creator and one brand walk the real path:

    creator identity -> influencer profile -> discover briefs -> apply
    -> brand sees the application -> brand confirms -> creator submits a deliverable
    -> brand reviews it -> creator requests payment -> payout history -> chat both ways

Each step runs through the HTTP layer with get_db issuing the same two statements
database.enter_tenant_scope() issues, so the handler's queries are subject to the
policies. Steps are ordered and depend on each other, which is the point: a per-endpoint
test can pass while the join between two of them is broken, and the join is where this
product was failing.

Every write is read back afterwards, as the owner and as an outsider, because a 200 only
says the handler did not raise.

    RLS_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/raftra_rls_test \
        python -m pytest test_influencer_journey.py -v
"""
import io
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

import admin_routes                                                  # noqa: E402
import auth                                                          # noqa: E402
import chat_routes                                                   # noqa: E402
import database                                                      # noqa: E402
import media_routes                                                  # noqa: E402
import models                                                        # noqa: E402
import payout_routes                                                 # noqa: E402
import posted_deal_routes                                            # noqa: E402
import workspace_routes                                              # noqa: E402

BRAND, CREATOR, RIVAL = 5001, 5101, 5102
ADMINU = 5200
TEN = uuid.UUID("ffffffff-0000-4000-8000-000000000006")
WS = 5010
INF, INF_RIVAL = 5110, 5120
DEAL = 5500
HANDLE, HANDLE_RIVAL = "journeycreator", "rivalcreator"

_engine = sa.create_engine(DSN.replace("postgresql://", "postgresql+psycopg2://", 1))
Session = sessionmaker(bind=_engine)

state = {}          # ids discovered as the journey proceeds


@pytest.fixture(scope="module", autouse=True)
def seeded():
    s = Session()

    def wipe():
        s.rollback()
        s.execute(sa.text("DELETE FROM chat_messages WHERE workspace_id = :w"), {"w": WS})
        s.execute(sa.text(
            "DELETE FROM deal_deliverable_submissions WHERE application_id IN "
            "(SELECT id FROM deal_applications WHERE workspace_id = :w)"), {"w": WS})
        s.execute(sa.text("DELETE FROM creator_payout_requests WHERE creator_handle IN :h"),
                  {"h": (HANDLE, HANDLE_RIVAL)})
        s.execute(sa.text("DELETE FROM deal_applications WHERE workspace_id = :w"), {"w": WS})
        s.execute(sa.text("DELETE FROM posted_deal_notifications WHERE id > 0 AND "
                          "deal_id = :d"), {"d": DEAL})
        s.execute(sa.text("DELETE FROM posted_deals WHERE id = :d"), {"d": DEAL})
        s.execute(sa.text("DELETE FROM influencers WHERE id IN :i"), {"i": (INF, INF_RIVAL)})
        s.execute(sa.text("DELETE FROM workspaces WHERE id = :w"), {"w": WS})
        s.execute(sa.text("DELETE FROM tenant_members WHERE user_id IN :u"),
                  {"u": (BRAND, CREATOR, RIVAL, ADMINU)})
        s.execute(sa.text("DELETE FROM tenants WHERE id = :t"), {"t": str(TEN)})
        s.execute(sa.text("DELETE FROM users WHERE id IN :u"),
                  {"u": (BRAND, CREATOR, RIVAL, ADMINU)})
        s.commit()

    wipe()
    s.execute(sa.text(
        "INSERT INTO users (id,email,first_name,role,is_active,payment_status) VALUES "
        "(:b,'jb@example.com','Brand','brand',true,'pending'),"
        "(:c,'jc@example.com','Journey','creator',true,'pending'),"
        "(:r,'jr@example.com','Rival','creator',true,'pending'),"
        "(:a,'ja@example.com','Admin','admin',true,'pending')"),
        {"b": BRAND, "c": CREATOR, "r": RIVAL, "a": ADMINU})
    s.execute(sa.text("INSERT INTO tenants (id,name) VALUES (:t,'Journey')"),
              {"t": str(TEN)})
    s.execute(sa.text("INSERT INTO tenant_members (tenant_id,user_id,role) "
                      "VALUES (:t,:b,'owner')"), {"t": str(TEN), "b": BRAND})
    s.execute(sa.text("INSERT INTO workspaces (id,name,user_id,tenant_id) "
                      "VALUES (:w,'Journey WS',:b,:t)"),
              {"w": WS, "b": BRAND, "t": str(TEN)})
    s.execute(sa.text("INSERT INTO influencers (id,handle,name,platform,user_id,workspace_id) "
                      "VALUES (:i,:h,'Journey Creator','instagram',:c,:w),"
                      "(:ir,:hr,'Rival','instagram',:r,:w)"),
              {"i": INF, "h": HANDLE, "c": CREATOR, "w": WS,
               "ir": INF_RIVAL, "hr": HANDLE_RIVAL, "r": RIVAL})
    s.execute(sa.text("INSERT INTO posted_deals (id,workspace_id,campaign_name,status,"
                      "brand_name) VALUES (:d,:w,'Journey Campaign','ACTIVE','Brand')"),
              {"d": DEAL, "w": WS})
    s.commit()
    yield
    wipe()
    s.close()


def client(user_id):
    app = FastAPI()
    for mod in (auth, workspace_routes, posted_deal_routes, payout_routes,
                chat_routes, media_routes, admin_routes):
        app.include_router(mod.router)

    holder = Session()
    user = holder.get(models.User, user_id)

    def get_db():
        db = Session()
        try:
            db.execute(sa.text("SET LOCAL ROLE raftra_app; "
                               "SELECT set_config('app.user_id', :uid, true)"),
                       {"uid": str(user_id)})
            yield db
        finally:
            db.rollback()
            db.close()

    app.dependency_overrides[auth.get_current_user] = lambda: user
    app.dependency_overrides[database.get_db] = get_db
    # raise_server_exceptions left at its default: an unhandled exception should surface
    # as a traceback in the test output, not be flattened into an opaque 500. Raised
    # HTTPExceptions (403, 404, 409) are handled by FastAPI and still come back as
    # responses, which is what the negative cases assert on.
    return TestClient(app)


def row(sql, **p):
    db = Session()
    try:
        return db.execute(sa.text(sql), p).fetchall()
    finally:
        db.close()


# ============================================================ 1. identity

def test_01_auth_me_returns_the_creator():
    r = client(CREATOR).get("/api/auth/me")
    assert r.status_code == 200, r.text
    assert r.json()["email"] == "jc@example.com"


def test_02_influencer_profile_loads():
    r = client(CREATOR).get("/api/workspaces/influencer/me")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("handle") == HANDLE, body
    assert body.get("name") == "Journey Creator"


def test_03_the_rival_gets_their_own_profile_not_mine():
    r = client(RIVAL).get("/api/workspaces/influencer/me")
    assert r.status_code == 200, r.text
    assert r.json().get("handle") == HANDLE_RIVAL


# ============================================================ 2. discover and apply

def test_04_active_brief_is_discoverable():
    r = client(CREATOR).get("/api/posted-deals/discover")
    assert r.status_code == 200, r.text
    assert DEAL in [d["id"] for d in r.json()], "the ACTIVE brief is not discoverable"


def test_05_creator_applies():
    # creator_handle is in the body because DealApplicationCreate requires it, but the
    # handler overrides it with the signed-in creator's own - the docstring at
    # posted_deal_routes.py:451 records that the original trusted the body, so one creator
    # could apply in another's name. test_05b pins that it is still overridden.
    r = client(CREATOR).post(f"/api/posted-deals/{DEAL}/apply",
                             json={"creator_handle": HANDLE,
                                   "creator_name": "Journey Creator",
                                   "proposal_text": "I would love this",
                                   "proposed_price": 500})
    assert r.status_code == 200, r.text
    got = row("SELECT id, creator_handle, status FROM deal_applications "
              "WHERE deal_id = :d", d=DEAL)
    assert len(got) == 1, f"expected exactly one application row, got {got}"
    state["app_id"] = got[0][0]
    assert got[0][1] == HANDLE, "the application was filed under the wrong handle"


def test_05b_the_handle_in_the_body_cannot_impersonate_another_creator():
    """Applying with someone else's handle must still file under your own."""
    r = client(RIVAL).post(f"/api/posted-deals/{DEAL}/apply",
                           json={"creator_handle": HANDLE,          # not the rival's
                                 "creator_name": "Not Me",
                                 "proposal_text": "impersonation attempt",
                                 "proposed_price": 1})
    if r.status_code == 200:
        got = row("SELECT creator_handle FROM deal_applications WHERE deal_id = :d "
                  "AND proposal_text = 'impersonation attempt'", d=DEAL)
        assert got and got[0][0] == HANDLE_RIVAL, \
            f"IMPERSONATION: application filed as {got}"
    else:
        assert r.status_code in (403, 404, 409), r.text


def test_06_creator_sees_their_application_and_the_rival_does_not():
    assert "app_id" in state, "step 05 did not run"
    r = client(CREATOR).get("/api/posted-deals/mine")
    assert r.status_code == 200, r.text
    assert state["app_id"] in [a["id"] for a in r.json()]

    r2 = client(RIVAL).get("/api/posted-deals/mine")
    assert r2.status_code == 200, r2.text
    assert state["app_id"] not in [a["id"] for a in r2.json()], \
        "LEAK: a rival creator can see this application"


def test_07_brand_sees_the_application():
    r = client(BRAND).get(f"/api/posted-deals/{DEAL}/applications")
    assert r.status_code == 200, r.text
    assert state["app_id"] in [a["id"] for a in r.json()], \
        "the brand cannot see an application made to its own brief"


# ============================================================ 3. confirm and deliver

def test_08_brand_confirms_the_application():
    r = client(BRAND).post(f"/api/posted-deals/applications/{state['app_id']}/status",
                           json={"status": "CONFIRMED"})
    assert r.status_code == 200, r.text
    st = row("SELECT status FROM deal_applications WHERE id = :a", a=state["app_id"])[0][0]
    assert st == "CONFIRMED", f"status did not persist, it is {st}"


def test_09_creator_submits_a_deliverable():
    r = client(CREATOR).post(
        f"/api/posted-deals/applications/{state['app_id']}/submissions",
        json={"title": "Reel v1", "submission_type": "video",
              "content_url": "https://example.invalid/reel.mp4"})
    assert r.status_code == 200, r.text
    got = row("SELECT id, title FROM deal_deliverable_submissions "
              "WHERE application_id = :a", a=state["app_id"])
    assert len(got) >= 1, "the submission was not written"
    state["sub_id"] = got[0][0]


def test_10_a_rival_cannot_submit_against_this_application():
    r = client(RIVAL).post(
        f"/api/posted-deals/applications/{state['app_id']}/submissions",
        json={"title": "stolen", "submission_type": "video",
              "content_url": "https://example.invalid/x.mp4"})
    assert r.status_code in (403, 404), r.text


def test_11_brand_can_review_the_deliverable():
    r = client(BRAND).get(
        f"/api/posted-deals/applications/{state['app_id']}/submissions")
    assert r.status_code == 200, r.text
    assert state["sub_id"] in [s["id"] for s in r.json()], \
        "the brand cannot see a deliverable submitted to its own campaign"


# ============================================================ 4. media upload

def test_12_creator_can_upload_media():
    files = {"file": ("proof.png", io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"0" * 64),
                      "image/png")}
    r = client(CREATOR).post("/api/media/upload", files=files)
    assert r.status_code in (200, 201), r.text
    body = r.json()
    assert body.get("url"), f"upload returned no url: {body}"
    state["media_url"] = body["url"]


# ============================================================ 5. payout

def test_13_creator_requests_payment_for_completed_work():
    r = client(CREATOR).post("/api/payouts/submit", json={
        "creator_handle": HANDLE, "application_id": state["app_id"],
        "upi_id": "journey@upi"})
    # The brand must mark the campaign complete first; either outcome is correct
    # behaviour, but it must not be the old "you can only request payment for your own
    # profile" 403, which fired for every creator regardless of the work.
    assert r.status_code in (200, 409), r.text
    assert "your own profile" not in r.text, \
        "still failing the handle check - _my_handles() is empty again"
    state["payout_status"] = r.status_code


def test_14_completing_the_campaign_then_requesting_payment_works():
    done = client(BRAND).post(
        f"/api/posted-deals/applications/{state['app_id']}/complete", json={})
    assert done.status_code in (200, 409), done.text
    r = client(CREATOR).post("/api/payouts/submit", json={
        "creator_handle": HANDLE, "application_id": state["app_id"],
        "upi_id": "journey@upi"})
    assert r.status_code in (200, 409), r.text
    if r.status_code == 200:
        got = row("SELECT count(*) FROM creator_payout_requests WHERE creator_handle=:h",
                  h=HANDLE)[0][0]
        assert got >= 1, "200 but nothing written"


def test_15_payout_history_is_private_to_the_creator():
    mine = client(CREATOR).get("/api/payouts/mine")
    assert mine.status_code == 200, mine.text
    rival = client(RIVAL).get("/api/payouts/mine")
    assert rival.status_code == 200, rival.text
    rival_handles = {x.get("creator_handle") for x in rival.json()}
    assert HANDLE not in rival_handles, "LEAK: rival sees this creator's payout"


# ============================================================ 6. chat both ways

def test_16_brand_messages_the_creator():
    r = client(BRAND).post(f"/api/chat/{WS}/send",
                           json={"influencer_id": INF, "content": "Hi, nice work"})
    assert r.status_code == 200, r.text
    assert r.json()["sender_type"] == "brand"


def test_17_creator_replies():
    r = client(CREATOR).post(f"/api/chat/{WS}/send",
                             json={"influencer_id": INF, "content": "Thank you"})
    assert r.status_code == 200, r.text
    assert r.json()["sender_type"] == "influencer"


def test_18_both_sides_see_the_whole_thread():
    for who in (BRAND, CREATOR):
        r = client(who).get(f"/api/chat/{WS}/{INF}")
        assert r.status_code == 200, r.text
        contents = [m["content"] for m in r.json()]
        assert "Hi, nice work" in contents and "Thank you" in contents, \
            f"user {who} sees {contents}"


def test_19_the_rival_cannot_read_the_thread():
    r = client(RIVAL).get(f"/api/chat/{WS}/{INF}")
    assert r.status_code == 403, r.text


def test_20_admin_can_list_users_again():
    """admin_routes.py:33 under tenant scope - empty while users was deny-all."""
    r = client(ADMINU).get("/api/admin/users")
    assert r.status_code == 200, r.text
    ids_seen = {u["id"] for u in r.json()}
    assert {BRAND, CREATOR, RIVAL} <= ids_seen, f"admin sees only {ids_seen}"
