"""The signing key is assessed and reported, and the reporting itself is harmless.

The signing-key work shipped in two parts. This file covers the first: detect whether the
key is usable and say so, in the boot log and in /api/admin/summary, taking no action on
the answer.

The refusal is the second part and lives in test_jwt_secret_guard.py. It went out
separately, once the deployed instance was confirmed to set JWT_SECRET_KEY to a value over
the 32-character floor - a refusal deployed blind trades a quiet security hole for an
outage, which is a bad bargain in either direction.

So what is pinned here is that the reporting is accurate, that it never reveals the key,
and that OUTSIDE production it never prevents a boot. That last one matters because the
suite itself imports auth: a refusal reaching development or test would take every other
test down with it. Production is deliberately absent from these cases - it refuses now,
and the other file owns that.

Each case runs in a subprocess because the assessment happens at import.
"""
import json
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
         "import auth, json; print('BOOTED-OK'); "
         "print('STATUS=' + json.dumps(auth.auth_config_status()))"],
        cwd=BACKEND, env=env, capture_output=True, text=True, timeout=300)
    status = {}
    for line in r.stdout.splitlines():
        if line.startswith("STATUS="):
            status = json.loads(line[len("STATUS="):])
    return "BOOTED-OK" in r.stdout, status, r.stdout + r.stderr


# ----------------------------------------- reporting must not break the environments that run it

@pytest.mark.parametrize("app_env", ["development", "test"])
def test_a_weak_key_does_not_stop_the_boot_outside_production(app_env):
    """Local work must not require a generated key, and the suite imports auth."""
    booted, status, out = boot(app_env, PUBLISHED_DEFAULT)
    assert booted, f"reporting must not prevent startup in {app_env}:\n{out[-500:]}"
    assert status.get("jwt_key_ok") is False


def test_a_strong_key_boots_everywhere_including_production():
    """The configured production state. If this ever fails, the guard is too eager."""
    for app_env in ("production", "development", "test"):
        booted, status, out = boot(app_env, STRONG)
        assert booted, f"a 64-character key must boot in {app_env}:\n{out[-500:]}"
        assert status["jwt_key_ok"] is True


# ------------------------------------------------------------------ what it reports

def test_reports_a_published_default_as_not_ok():
    _, status, _ = boot("development", PUBLISHED_DEFAULT)
    assert status["jwt_key_ok"] is False
    assert "published in this repository" in (status["reason"] or "")


def test_reports_a_short_key_as_not_ok():
    _, status, _ = boot("development", "x" * 31)
    assert status["jwt_key_ok"] is False
    assert "31 characters" in (status["reason"] or "")


def test_reports_a_strong_key_as_ok():
    booted, status, _ = boot("development", STRONG)
    assert booted
    assert status["jwt_key_ok"] is True
    assert status["reason"] is None


def test_never_reveals_the_key():
    """An admin endpoint carries this. It may say what is wrong, never what the value is."""
    for secret in (PUBLISHED_DEFAULT, STRONG, "y" * 40):
        _, status, _ = boot("development", secret)
        assert secret not in repr(status), "the status leaked the signing key"


def test_warns_on_the_boot_log_when_weak():
    _, _, out = boot("development", PUBLISHED_DEFAULT)
    assert "WARNING: JWT_SECRET_KEY is weak" in out
    assert "secrets.token_urlsafe" in out, "the warning should say how to fix it"


def test_stays_quiet_when_the_key_is_good():
    _, _, out = boot("development", STRONG)
    assert "JWT_SECRET_KEY is weak" not in out
