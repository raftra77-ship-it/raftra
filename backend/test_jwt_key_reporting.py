"""The signing key is assessed and reported, and reporting never stops the process.

This is the half of the signing-key work that is safe to deploy without knowing anything
about the target environment. It answers "is this instance signing tokens with the default
from our own repository?" in two places - the boot log and /api/admin/summary - and takes
no action on the answer.

That separation is the point. Refusing to start on a weak key is the right end state, but
shipping the refusal while nobody knows which state production is in trades a quiet
security hole for an outage. These tests pin the property that makes the diagnostic safe
to ship first: **it must never prevent a boot**, including in production with the worst
possible key.

Each case runs in a subprocess because the assessment happens at import.
"""
import os
import subprocess
import sys

import pytest

BACKEND = os.path.dirname(os.path.abspath(__file__))
PYTHON = sys.executable
LOCAL_DSN = "postgresql://postgres@127.0.0.1:5433/raftra_dev"

PUBLISHED_DEFAULT = "fallback_secret_key_for_raftra_dev"
STRONG = "x" * 64


def boot(app_env, secret):
    """Import auth in a fresh interpreter. Returns (booted, status dict, output)."""
    env = dict(os.environ)
    env["APP_ENV"] = app_env
    env["DATABASE_URL"] = LOCAL_DSN
    env["JWT_SECRET_KEY"] = secret
    env["SKIP_EMBEDDING_PRELOAD"] = "1"
    r = subprocess.run(
        [PYTHON, "-c",
         "import auth, json; print('BOOTED-OK'); print('STATUS=' + json.dumps(auth.auth_config_status()))"],
        cwd=BACKEND, env=env, capture_output=True, text=True, timeout=300)
    out = r.stdout + r.stderr
    status = {}
    for line in r.stdout.splitlines():
        if line.startswith("STATUS="):
            import json
            status = json.loads(line[len("STATUS="):])
    return "BOOTED-OK" in r.stdout, status, out


# ------------------------------------------------- the property that makes this shippable

@pytest.mark.parametrize("app_env", ["production", "development", "test"])
def test_a_weak_key_never_stops_the_boot(app_env):
    """Including production. The refusal is a separate change, made once the state is known."""
    booted, status, out = boot(app_env, PUBLISHED_DEFAULT)
    assert booted, f"reporting must not prevent startup in {app_env}:\n{out[-500:]}"
    assert status.get("jwt_key_ok") is False


# ------------------------------------------------------------------ what it reports

def test_reports_a_published_default_as_not_ok():
    _, status, _ = boot("production", PUBLISHED_DEFAULT)
    assert status["jwt_key_ok"] is False
    assert "published in this repository" in (status["reason"] or "")


def test_reports_a_short_key_as_not_ok():
    _, status, _ = boot("production", "x" * 31)
    assert status["jwt_key_ok"] is False
    assert "31 characters" in (status["reason"] or "")


def test_reports_a_strong_key_as_ok():
    booted, status, _ = boot("production", STRONG)
    assert booted
    assert status["jwt_key_ok"] is True
    assert status["reason"] is None


def test_never_reveals_the_key():
    """An admin endpoint carries this. It may say what is wrong, never what the value is."""
    for secret in (PUBLISHED_DEFAULT, STRONG, "y" * 40):
        _, status, _ = boot("production", secret)
        blob = repr(status)
        assert secret not in blob, "the status leaked the signing key"


def test_warns_on_the_boot_log_when_weak():
    _, _, out = boot("production", PUBLISHED_DEFAULT)
    assert "WARNING: JWT_SECRET_KEY is weak" in out
    assert "secrets.token_urlsafe" in out, "the warning should say how to fix it"


def test_stays_quiet_when_the_key_is_good():
    _, _, out = boot("production", STRONG)
    assert "JWT_SECRET_KEY is weak" not in out
