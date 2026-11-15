"""Authentication for real: no dependency overrides anywhere in this file.

Every other suite injects an authenticated user with
app.dependency_overrides[auth.get_current_user]. That is the right trade for testing
authorisation, and the wrong one for testing authentication - it skips the entire thing
under test. Here nothing is overridden. Accounts are created through POST
/api/auth/register, tokens come from POST /api/auth/login, and every protected request
carries a real Authorization: Bearer header that auth.get_current_user decodes.

DATABASE_URL is pointed at the local test database *before* `database` is imported, so the
application's own SessionLocal binds there natively rather than being swapped out. If some
other module imported `database` first - module state is process-wide - the engine is
already bound elsewhere and this module skips rather than risk touching it.

ENABLE_RLS is set on purpose. A real /api/auth/me goes through get_current_user, which
calls enter_tenant_scope(), which issues SET LOCAL ROLE raftra_app. So these tests also
exercise the scope switch itself against the real role, which no override-based test can.

    RLS_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/raftra_rls_test \
        python -m pytest test_auth_real.py -v
"""
import os
import sys
from urllib.parse import urlsplit

import pytest

DSN = os.getenv("RLS_TEST_DATABASE_URL")
if not DSN:
    pytest.skip("RLS_TEST_DATABASE_URL is not set", allow_module_level=True)
if urlsplit(DSN).hostname not in ("127.0.0.1", "localhost", "::1"):
    pytest.skip("RLS_TEST_DATABASE_URL must be loopback", allow_module_level=True)

# Before importing database, so the real engine binds to the test database.
os.environ["DATABASE_URL"] = DSN
os.environ["ENABLE_RLS"] = "true"

if "database" in sys.modules:
    _already = sys.modules["database"].engine.url
    if _already.host not in ("127.0.0.1", "localhost", "::1") \
            or _already.database != urlsplit(DSN).path.lstrip("/"):
        pytest.skip(f"`database` was already imported and bound to {_already.database}; "
                    "run this file on its own so it can bind the test database",
                    allow_module_level=True)

import jwt as _jwt                                                   # noqa: E402
import sqlalchemy as sa                                              # noqa: E402
from fastapi import FastAPI                                          # noqa: E402
from fastapi.testclient import TestClient                            # noqa: E402

import auth                                                          # noqa: E402
import database                                                      # noqa: E402
import workspace_routes                                              # noqa: E402

assert database.engine.url.host in ("127.0.0.1", "localhost", "::1"), \
    "refusing to run: the engine is not loopback"

CREATOR_EMAIL = "realauth.creator@example.com"
BRAND_EMAIL = "realauth.brand@example.com"
PASSWORD = "Correct-Horse-Battery-7"

app = FastAPI()
app.include_router(auth.router)
app.include_router(workspace_routes.router)
# No dependency_overrides. Deliberately.
client = TestClient(app, raise_server_exceptions=False)


@pytest.fixture(scope="module", autouse=True)
def clean():
    def wipe():
        with database.engine.begin() as c:
            c.execute(sa.text(
                "DELETE FROM influencers WHERE user_id IN "
                "(SELECT id FROM users WHERE email IN :e)"), {"e": (CREATOR_EMAIL, BRAND_EMAIL)})
            c.execute(sa.text("DELETE FROM auth_events WHERE email IN :e OR user_id IN "
                              "(SELECT id FROM users WHERE email IN :e)"),
                      {"e": (CREATOR_EMAIL, BRAND_EMAIL)})
            c.execute(sa.text("DELETE FROM users WHERE email IN :e"),
                      {"e": (CREATOR_EMAIL, BRAND_EMAIL)})
    wipe()
    yield
    wipe()


state = {}


def _register(email, role, username):
    return client.post("/api/auth/register", json={
        "username": username, "first_name": "Real", "last_name": "Auth",
        "email": email, "password": PASSWORD, "role": role})


# ----------------------------------------------------------------- registration

def test_01_creator_can_register():
    r = _register(CREATOR_EMAIL, "creator", "realauthcreator")
    assert r.status_code == 200, r.text
    with database.engine.begin() as c:
        row = c.execute(sa.text("SELECT id, role, hashed_password FROM users "
                                "WHERE email = :e"), {"e": CREATOR_EMAIL}).fetchone()
    assert row is not None, "register returned 200 but wrote no user"
    state["creator_id"] = row[0]
    assert row[1] == "creator"
    assert row[2] and row[2] != PASSWORD, "the password was not hashed"


def test_02_brand_can_register():
    r = _register(BRAND_EMAIL, "brand", "realauthbrand")
    assert r.status_code == 200, r.text


def test_03_duplicate_email_is_rejected():
    r = _register(CREATOR_EMAIL, "creator", "realauthcreator2")
    assert r.status_code == 400, r.text
    assert "already registered" in r.text.lower()


def test_04_an_unknown_role_is_rejected():
    r = _register("realauth.other@example.com", "superuser", "realauthother")
    assert r.status_code == 400, r.text


# ----------------------------------------------------------------- login

def _login(email, password, role=None):
    body = {"identifier": email, "password": password}
    if role:
        body["role"] = role
    return client.post("/api/auth/login", json=body)


def test_05_login_with_valid_credentials_issues_a_token():
    r = _login(CREATOR_EMAIL, PASSWORD)
    assert r.status_code == 200, r.text
    tok = r.json().get("access_token")
    assert tok, r.json()
    state["creator_token"] = tok


def test_06_the_token_is_a_valid_signed_jwt_carrying_the_identity():
    payload = _jwt.decode(state["creator_token"], auth.SECRET_KEY,
                          algorithms=[auth.ALGORITHM])
    assert int(payload["sub"]) == state["creator_id"]
    assert payload.get("role") == "creator", payload
    assert "exp" in payload


def test_07_a_tampered_token_does_not_verify():
    bad = state["creator_token"][:-4] + "AAAA"
    with pytest.raises(Exception):
        _jwt.decode(bad, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])


def test_08_wrong_password_is_401():
    r = _login(CREATOR_EMAIL, "not-the-password")
    assert r.status_code == 401, r.text
    assert "password" in r.text.lower()


def test_09_unknown_account_is_401():
    r = _login("nobody.here@example.com", PASSWORD)
    assert r.status_code == 401, r.text


def test_10_signing_in_from_the_wrong_side_of_the_product_is_403():
    """A creator account picked from the Brand tab. Credentials are right, the account
    is the other kind - auth.py:251 answers 403 rather than issuing a misleading token."""
    r = _login(CREATOR_EMAIL, PASSWORD, role="brand")
    assert r.status_code == 403, r.text


def test_11_signing_in_from_the_matching_tab_succeeds():
    r = _login(CREATOR_EMAIL, PASSWORD, role="creator")
    assert r.status_code == 200, r.text


# ----------------------------------------------------------------- the real token

def bearer(tok):
    return {"Authorization": f"Bearer {tok}"}


def test_12_auth_me_with_a_real_jwt():
    r = client.get("/api/auth/me", headers=bearer(state["creator_token"]))
    assert r.status_code == 200, r.text
    assert r.json()["email"] == CREATOR_EMAIL
    assert r.json()["role"] == "creator"


def test_13_no_token_is_rejected():
    r = client.get("/api/auth/me")
    assert r.status_code == 401, r.text


def test_14_a_garbage_token_is_rejected():
    r = client.get("/api/auth/me", headers=bearer("not.a.jwt"))
    assert r.status_code == 401, r.text


def test_15_a_token_signed_with_the_wrong_key_is_rejected():
    forged = _jwt.encode({"sub": str(state["creator_id"]), "role": "admin"},
                         "the-wrong-secret", algorithm=auth.ALGORITHM)
    r = client.get("/api/auth/me", headers=bearer(forged))
    assert r.status_code == 401, r.text


def test_16_a_token_for_a_deleted_user_is_rejected():
    forged = auth.create_access_token({"sub": "99999999", "role": "creator"})
    r = client.get("/api/auth/me", headers=bearer(forged))
    assert r.status_code == 401, r.text


# ----------------------------------------------------------------- dashboard access

def test_17_creator_reaches_their_dashboard_data_with_the_real_token():
    """This request runs the whole chain for real: decode the JWT, load the user,
    enter_tenant_scope() -> SET LOCAL ROLE raftra_app, then query under the policies."""
    r = client.get("/api/workspaces/influencer/me",
                   headers=bearer(state["creator_token"]))
    assert r.status_code == 200, r.text


def test_18_the_same_endpoint_without_a_token_is_rejected():
    r = client.get("/api/workspaces/influencer/me")
    assert r.status_code == 401, r.text


def test_19_enable_rls_really_was_on_for_those_requests():
    """If ENABLE_RLS were off, test_17 would have proved nothing about the policies."""
    assert database.rls_enabled() is True


def test_20_the_role_claim_drives_the_frontend_redirect():
    """App.tsx:98 RequireAuth reads payload.role and sends a creator to
    /creator-dashboard and a brand to /dashboard. The redirect itself is frontend code and
    is not executed here; what the backend owes it is a correct role claim, per account."""
    creator = _jwt.decode(state["creator_token"], auth.SECRET_KEY,
                          algorithms=[auth.ALGORITHM])
    brand_tok = _login(BRAND_EMAIL, PASSWORD).json()["access_token"]
    brand = _jwt.decode(brand_tok, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
    assert creator["role"] == "creator" and brand["role"] == "brand"
    assert creator["sub"] != brand["sub"]
