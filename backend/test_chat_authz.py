"""Application-layer authorisation on the chat endpoints, over real HTTP.

test_creator_rls.py proves what Postgres permits. This proves what the route permits,
which is a separate gate and the one that was broken: the handlers decided access in
Python with an `if/elif` that had no `else`, and one of them decided nothing at all.

The database here is real - the same local Postgres the RLS suite uses - so the handlers
run their actual queries rather than talking to a mock that agrees with them. Auth is
supplied by overriding the route's dependency, which means enter_tenant_scope() does not
run and RLS is not in play; that is deliberate. This file is about the Python gate on its
own, so a failure here cannot be masked by the database refusing the row anyway.

    RLS_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/raftra_rls_test \
        python -m pytest test_chat_authz.py -v
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
import chat_routes                                                   # noqa: E402
import database                                                      # noqa: E402
import models                                                        # noqa: E402

BRAND, OTHER_BRAND = 8001, 8002
CREATOR, OTHER_CREATOR = 8101, 8102
ADMIN, ODD_ROLE = 8200, 8300
TEN = uuid.UUID("cccccccc-0000-4000-8000-000000000003")
TEN2 = uuid.UUID("dddddddd-0000-4000-8000-000000000004")
WS, WS2 = 8010, 8020
INF, INF2 = 8110, 8120
MSG, MSG2 = 8950, 8951

_engine = sa.create_engine(DSN.replace("postgresql://", "postgresql+psycopg2://", 1))
Session = sessionmaker(bind=_engine)


_session = None


@pytest.fixture(scope="module", autouse=True)
def seeded():
    global _session
    s = _session = Session()
    def wipe():
        # chat_messages goes by workspace, not by seeded id: the send tests insert rows
        # with generated ids, and leaving those behind makes the influencers DELETE fail
        # on the foreign key.
        s.execute(sa.text("DELETE FROM chat_messages WHERE workspace_id IN :v"),
                  {"v": (WS, WS2)})
        for t, col, vals in (("influencers", "id", (INF, INF2)),
                             ("workspaces", "id", (WS, WS2)),
                             ("tenant_members", "user_id",
                              (BRAND, OTHER_BRAND, CREATOR, OTHER_CREATOR, ADMIN, ODD_ROLE)),
                             ("tenants", "id", (str(TEN), str(TEN2))),
                             ("users", "id",
                              (BRAND, OTHER_BRAND, CREATOR, OTHER_CREATOR, ADMIN, ODD_ROLE))):
            s.execute(sa.text(f"DELETE FROM {t} WHERE {col} IN :v"), {"v": tuple(vals)})
        s.commit()

    wipe()
    s.execute(sa.text(
        "INSERT INTO users (id,email,role,is_active) VALUES "
        "(:b,'b@t.invalid','brand',true),(:ob,'ob@t.invalid','brand',true),"
        "(:c,'c@t.invalid','creator',true),(:oc,'oc@t.invalid','creator',true),"
        "(:a,'a@t.invalid','admin',true),(:o,'o@t.invalid','viewer',true)"),
        {"b": BRAND, "ob": OTHER_BRAND, "c": CREATOR, "oc": OTHER_CREATOR,
         "a": ADMIN, "o": ODD_ROLE})
    s.execute(sa.text("INSERT INTO tenants (id,name) VALUES (:t,'T'),(:t2,'T2')"),
              {"t": str(TEN), "t2": str(TEN2)})
    s.execute(sa.text("INSERT INTO tenant_members (tenant_id,user_id,role) VALUES "
                      "(:t,:b,'owner'),(:t2,:ob,'owner')"),
              {"t": str(TEN), "b": BRAND, "t2": str(TEN2), "ob": OTHER_BRAND})
    s.execute(sa.text("INSERT INTO workspaces (id,name,user_id,tenant_id) VALUES "
                      "(:w,'W',:b,:t),(:w2,'W2',:ob,:t2)"),
              {"w": WS, "b": BRAND, "t": str(TEN),
               "w2": WS2, "ob": OTHER_BRAND, "t2": str(TEN2)})
    s.execute(sa.text("INSERT INTO influencers (id,handle,name,user_id,workspace_id) VALUES "
                      "(:i,'c','C',:c,:w),(:i2,'oc','OC',:oc,:w2)"),
              {"i": INF, "c": CREATOR, "w": WS, "i2": INF2, "oc": OTHER_CREATOR, "w2": WS2})
    # created_at explicitly: the column default is a Python-side SQLAlchemy default, so a
    # raw INSERT leaves it NULL and the row stops resembling one the application made.
    # read_at and file_url are left NULL on purpose - that is the normal state of an
    # unread message with no attachment, and the response model has to tolerate it.
    s.execute(sa.text("INSERT INTO chat_messages (id,workspace_id,influencer_id,"
                      "sender_type,content,created_at) VALUES "
                      "(:m,:w,:i,'brand','hello',now()),"
                      "(:m2,:w2,:i2,'brand','other',now())"),
              {"m": MSG, "w": WS, "i": INF, "m2": MSG2, "w2": WS2, "i2": INF2})
    s.commit()
    yield
    wipe()
    s.close()


def client_as(user_id):
    """A client whose requests are authenticated as this seeded user.

    One session for the whole module rather than one per call: a fresh Session per client
    was never closed, so each test left an idle-in-transaction connection holding locks,
    and the module teardown then failed to DELETE the rows those locks covered.
    """
    s = _session
    user = s.get(models.User, user_id)
    app = FastAPI()
    app.include_router(chat_routes.router)
    app.dependency_overrides[auth.get_current_user] = lambda: user
    app.dependency_overrides[database.get_db] = lambda: s
    return TestClient(app, raise_server_exceptions=False)


# ------------------------------------------------------------------ reading history

def test_brand_owning_the_workspace_can_read():
    r = client_as(BRAND).get(f"/api/chat/{WS}/{INF}")
    assert r.status_code == 200, r.text
    assert [m["content"] for m in r.json()] == ["hello"]


def test_creator_owning_the_influencer_can_read():
    r = client_as(CREATOR).get(f"/api/chat/{WS}/{INF}")
    assert r.status_code == 200, r.text
    assert [m["content"] for m in r.json()] == ["hello"]


def test_a_brand_from_another_workspace_is_refused():
    assert client_as(OTHER_BRAND).get(f"/api/chat/{WS}/{INF}").status_code == 403


def test_a_creator_who_does_not_own_the_influencer_is_refused():
    assert client_as(OTHER_CREATOR).get(f"/api/chat/{WS}/{INF}").status_code == 403


def test_a_role_that_is_neither_brand_nor_creator_is_refused():
    """The missing `else`. This role used to skip both checks and read the whole thread."""
    assert client_as(ODD_ROLE).get(f"/api/chat/{WS}/{INF}").status_code == 403


def test_admin_may_read():
    r = client_as(ADMIN).get(f"/api/chat/{WS}/{INF}")
    assert r.status_code == 200, r.text


# ------------------------------------------------------------------ sending

def test_creator_send_is_recorded_as_the_influencer():
    r = client_as(CREATOR).post(f"/api/chat/{WS}/send",
                                json={"influencer_id": INF, "content": "from creator"})
    assert r.status_code == 200, r.text
    assert r.json()["sender_type"] == "influencer"


def test_brand_send_is_recorded_as_the_brand():
    r = client_as(BRAND).post(f"/api/chat/{WS}/send",
                              json={"influencer_id": INF, "content": "from brand"})
    assert r.status_code == 200, r.text
    assert r.json()["sender_type"] == "brand"


def test_a_stranger_cannot_send():
    r = client_as(OTHER_CREATOR).post(f"/api/chat/{WS}/send",
                                      json={"influencer_id": INF, "content": "intrusion"})
    assert r.status_code == 403


def test_an_odd_role_is_no_longer_silently_treated_as_the_influencer():
    """The old `else` branch meant any non-brand role spoke as the creator."""
    r = client_as(ODD_ROLE).post(f"/api/chat/{WS}/send",
                                 json={"influencer_id": INF, "content": "who am i"})
    assert r.status_code == 403


def test_admin_cannot_post_as_a_participant():
    r = client_as(ADMIN).post(f"/api/chat/{WS}/send",
                              json={"influencer_id": INF, "content": "as admin"})
    assert r.status_code == 403


# ------------------------------------------------------------------ read receipts (IDOR)

def test_participant_can_mark_read():
    assert client_as(CREATOR).post(f"/api/chat/read/{MSG}").status_code == 200


def test_outsider_cannot_mark_another_tenants_message_read():
    """Previously unguarded entirely: any account could stamp any message id."""
    assert client_as(OTHER_CREATOR).post(f"/api/chat/read/{MSG}").status_code == 403
    assert client_as(OTHER_BRAND).post(f"/api/chat/read/{MSG}").status_code == 403
    assert client_as(ODD_ROLE).post(f"/api/chat/read/{MSG}").status_code == 403


def test_marking_read_does_not_leak_which_ids_exist():
    """A missing id and a forbidden id must not be distinguishable to an outsider...
    except that 404 precedes the authorisation check, so they still are. Pinned here so
    the behaviour is a decision rather than an accident."""
    missing = client_as(OTHER_CREATOR).post("/api/chat/read/99999999").status_code
    forbidden = client_as(OTHER_CREATOR).post(f"/api/chat/read/{MSG}").status_code
    assert missing == 404 and forbidden == 403
