"""The signing key is checked at import, and in production the check is fatal.

auth.py used to print a warning and carry on:

    WARNING: JWT_SECRET_KEY is weak/default. Set a strong random value ... before production.

The comment above it said "Refuse to run silently with a guessable signing key", which is
not what the code did. A warning on a deployed instance is read by nobody - the server came
up and served traffic. That key signs access tokens, password-reset tokens and the OAuth
`state` parameter, and the default it falls back to is committed in auth.py itself, so
anyone who can read this repository could mint a token for any user id, role 'admin'
included.

Each case runs in a subprocess because the guard fires at import time, which cannot be
re-triggered inside one interpreter. They pass JWT_SECRET_KEY explicitly rather than relying
on its absence: backend/.env is gitignored but present on a developer's machine and does
carry a strong key, so "unset" is not a reproducible state here - config loads that file
before auth reads the variable.
"""
import os
import subprocess
import sys

import pytest

BACKEND = os.path.dirname(os.path.abspath(__file__))
PYTHON = sys.executable
# Loopback, so config.py's own non-production host check is satisfied and the only thing
# under test is the key.
LOCAL_DSN = "postgresql://postgres@127.0.0.1:5433/raftra_dev"

PUBLISHED_DEFAULT = "fallback_secret_key_for_raftra_dev"
STRONG = "x" * 64


def boot(app_env, secret):
    """Import auth in a fresh interpreter. Returns (booted, combined output)."""
    env = dict(os.environ)
    env["APP_ENV"] = app_env
    env["DATABASE_URL"] = LOCAL_DSN
    env["JWT_SECRET_KEY"] = secret
    # Keep the import cheap and side-effect free; auth imports database, not main.
    env["SKIP_EMBEDDING_PRELOAD"] = "1"
    r = subprocess.run([PYTHON, "-c", "import auth; print('BOOTED-OK')"],
                       cwd=BACKEND, env=env, capture_output=True, text=True, timeout=300)
    return "BOOTED-OK" in r.stdout, r.stdout + r.stderr


# ------------------------------------------------------------------ production: fatal

@pytest.mark.parametrize("secret,because", [
    (PUBLISHED_DEFAULT, "published in this repository"),
    ("", "published in this repository"),
    ("x" * 31, "the minimum is 32"),
])
def test_production_refuses_a_weak_key(secret, because):
    booted, out = boot("production", secret)
    assert not booted, "production started with an unusable signing key"
    assert "JWT_SECRET_KEY is not usable in production" in out
    assert because in out, f"the error should say why; got:\n{out[-400:]}"


def test_production_accepts_a_strong_key():
    """The guard must not be so eager that it blocks a correctly configured deploy."""
    booted, out = boot("production", STRONG)
    assert booted, f"production refused a 64-character key:\n{out[-600:]}"
    assert "JWT_SECRET_KEY" not in out


def test_the_error_says_how_to_fix_it():
    """Whoever hits this is reading a crashed boot log, so the fix belongs in the message."""
    _, out = boot("production", PUBLISHED_DEFAULT)
    assert "secrets.token_urlsafe" in out
    assert "deployment environment" in out


# ------------------------------------------------------- everywhere else: warn only

@pytest.mark.parametrize("app_env", ["development", "test"])
def test_other_environments_still_start(app_env):
    """Local work must not need a generated key - and the suite itself imports auth, so a
    fatal check outside production would take every other test down with it."""
    booted, out = boot(app_env, PUBLISHED_DEFAULT)
    assert booted, f"{app_env} refused to start:\n{out[-600:]}"
    assert "WARNING: JWT_SECRET_KEY is weak" in out
    assert "would refuse to start" in out, "the warning should say what production does"
