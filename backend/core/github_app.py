"""
GitHub App authentication — the production replacement for the OAuth App flow in
github_connect.py.

Why this exists: the OAuth App stores a long-lived user token in the database, scoped
to every repo that user can reach. A GitHub App instead gets *installed* on specific
repositories, and we mint a fresh installation token per request that expires in an
hour. Nothing long-lived is stored, and the blast radius of a leak is one installation
for one hour instead of somebody's whole GitHub account.

The REST calls that actually do the work (branch, commit, PR) are unchanged — only the
token in the Authorization header comes from somewhere else. See github_connect.py.

Requires, in the GitHub App settings (github.com/settings/apps/<slug>):
  - Permissions: Contents=read/write, Pull requests=read/write, Metadata=read
  - Callback URL: {BACKEND_URL}/api/connectors/github/callback
"""
import os
import time
from typing import Optional

import httpx
import jwt

API = "https://api.github.com"

APP_ID = os.getenv("GITHUB_APP_ID", "").strip()
APP_SLUG = os.getenv("GITHUB_APP_SLUG", "").strip()
CLIENT_ID = os.getenv("GITHUB_APP_CLIENT_ID", "").strip()
CLIENT_SECRET = os.getenv("GITHUB_APP_CLIENT_SECRET", "").strip()
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8005")

REDIRECT_URI = f"{BACKEND_URL}/api/connectors/github/callback"

# GitHub's JWT window is 10 minutes max; 9 leaves room for clock skew.
_JWT_TTL_SECONDS = 9 * 60
# Installation tokens last an hour. Re-mint a minute early so a request never starts
# with a token that expires mid-flight.
_TOKEN_REFRESH_MARGIN = 60

# installation_id -> (token, expires_at_epoch). Process-local; a cold start just
# re-mints, which is cheap.
_token_cache: dict[int, tuple[str, float]] = {}


def is_configured() -> bool:
    """True when the App credentials are present. Callers should fall back to the
    OAuth App path (github_connect) when this is False, so a half-configured
    deployment keeps working instead of hard-failing."""
    return bool(APP_ID and _private_key())


def _private_key() -> str:
    """The PEM, with literal '\\n' escapes turned back into real newlines.

    .env files can't hold multi-line values, so the key is stored one-line with
    escaped newlines; hosting panels (Render et al.) allow real newlines. Accept both
    rather than making the deployment format load-bearing.
    """
    raw = os.getenv("GITHUB_APP_PRIVATE_KEY", "").strip()
    if not raw:
        return ""
    # Strip surrounding quotes if the value was written as "...".
    if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in ("'", '"'):
        raw = raw[1:-1]
    return raw.replace("\\n", "\n")


def app_jwt() -> str:
    """A short-lived JWT identifying the App itself (not any installation).

    Only good for the /app* endpoints — listing installations and exchanging for an
    installation token. It cannot touch repository contents.
    """
    now = int(time.time())
    return jwt.encode(
        # iat is backdated 60s because GitHub rejects tokens whose iat is in its
        # future, and small clock differences between us and GitHub are normal.
        {"iat": now - 60, "exp": now + _JWT_TTL_SECONDS, "iss": APP_ID},
        _private_key(),
        algorithm="RS256",
    )


def _app_headers() -> dict:
    return {
        "Authorization": f"Bearer {app_jwt()}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _install_headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def build_install_url(state: str) -> str:
    """Where to send a user to install the App on their repositories.

    This replaces the OAuth authorize URL. GitHub returns them to our callback with
    ?installation_id=...&state=... once they pick repositories.
    """
    from urllib.parse import urlencode
    return f"https://github.com/apps/{APP_SLUG}/installations/new?{urlencode({'state': state})}"


async def get_installation_token(installation_id: int) -> str:
    """Mint (or reuse) a repo-scoped token for one installation.

    Cached until shortly before expiry so a burst of calls in one auto-apply run
    doesn't hit GitHub once per file.
    """
    cached = _token_cache.get(installation_id)
    if cached and cached[1] - _TOKEN_REFRESH_MARGIN > time.time():
        return cached[0]

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            f"{API}/app/installations/{installation_id}/access_tokens",
            headers=_app_headers(),
        )
    if res.status_code not in (200, 201):
        raise RuntimeError(
            f"Could not mint installation token ({res.status_code}): {res.text[:200]}"
        )

    data = res.json()
    token = data["token"]
    # "2026-08-13T12:00:00Z" -> epoch. Fall back to now+1h if the shape ever changes,
    # so a parse problem degrades to more frequent minting rather than a crash.
    try:
        from datetime import datetime
        expires = datetime.strptime(data["expires_at"], "%Y-%m-%dT%H:%M:%SZ").timestamp()
    except Exception:
        expires = time.time() + 3600

    _token_cache[installation_id] = (token, expires)
    return token


async def list_installation_repos(installation_id: int) -> list[dict]:
    """Repositories this installation can reach.

    The GitHub App equivalent of the OAuth flow's GET /user/repos. The difference is
    the point of the whole migration: this returns only what the user explicitly
    granted, not everything their account can see.
    """
    token = await get_installation_token(installation_id)
    repos: list[dict] = []
    page = 1
    async with httpx.AsyncClient(timeout=30) as client:
        while True:
            res = await client.get(
                f"{API}/installation/repositories",
                headers=_install_headers(token),
                params={"per_page": 100, "page": page},
            )
            if res.status_code != 200:
                raise RuntimeError(
                    f"Could not list installation repos ({res.status_code}): {res.text[:200]}"
                )
            batch = res.json().get("repositories", [])
            repos.extend(batch)
            if len(batch) < 100:
                break
            page += 1
    return repos


async def get_app_metadata() -> dict:
    """The App's own record — handy as a health check that APP_ID and the private key
    actually belong together."""
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.get(f"{API}/app", headers=_app_headers())
    if res.status_code != 200:
        raise RuntimeError(f"App auth failed ({res.status_code}): {res.text[:200]}")
    return res.json()


async def find_installation_id(owner: str) -> Optional[int]:
    """The installation id for a user or org, or None if the App isn't installed there.

    Used when we know the repo owner but haven't stored an installation_id yet.
    """
    async with httpx.AsyncClient(timeout=30) as client:
        for path in (f"{API}/users/{owner}/installation", f"{API}/orgs/{owner}/installation"):
            res = await client.get(path, headers=_app_headers())
            if res.status_code == 200:
                return res.json().get("id")
    return None
