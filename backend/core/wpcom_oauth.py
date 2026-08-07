"""WordPress.com OAuth2 — the second way to connect a WordPress site.

Why this exists alongside Application Passwords (core/wordpress_connect.py):
Application Passwords are a WordPress *core* feature, so they only work on self-hosted
installs. WordPress.com "Simple" sites (the free/Personal/Premium plans) run a different
stack: they serve no /wp-json/ on their own domain at all, and have no Application
Passwords screen. Their REST API is proxied at

    https://public-api.wordpress.com/wp/v2/sites/<blog_id>/...

behind an OAuth2 bearer token. That proxy speaks the *same* wp/v2 shape as self-hosted
WordPress (verified: same id/title/content/slug/link fields, and context=edit challenges
with 401), which is why wordpress_connect.py can drive both with one set of functions —
only the base URL and the auth header differ.

Unlike Google, WordPress.com access tokens do not expire and there is no refresh token;
a token lives until the user revokes it, so there is no refresh path to maintain.

Requires (founder, one-time, at https://developer.wordpress.com/apps/):
  - Create an application; type "Web".
  - Register the redirect URI  {BACKEND_URL}/api/connectors/wordpress/oauth/callback
  - Put the resulting client id/secret in WPCOM_CLIENT_ID / WPCOM_CLIENT_SECRET.
"""
import os
from urllib.parse import urlencode

import httpx

WPCOM_CLIENT_ID = os.getenv("WPCOM_CLIENT_ID", "")
WPCOM_CLIENT_SECRET = os.getenv("WPCOM_CLIENT_SECRET", "")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8005")

AUTHORIZE_URI = "https://public-api.wordpress.com/oauth2/authorize"
TOKEN_URI = "https://public-api.wordpress.com/oauth2/token"
API_ROOT = "https://public-api.wordpress.com"

REDIRECT_URI = f"{BACKEND_URL}/api/connectors/wordpress/oauth/callback"

TIMEOUT = 30.0


def is_configured() -> bool:
    return bool(WPCOM_CLIENT_ID and WPCOM_CLIENT_SECRET)


def api_base(blog_id: str) -> str:
    """The wp/v2 root for one connected WordPress.com site."""
    return f"{API_ROOT}/wp/v2/sites/{blog_id}"


def build_authorize_url(state: str, blog: str | None = None) -> str:
    """Consent URL. No `scope` is requested on purpose: the default grants access to the
    single site the user picks on WordPress.com's own screen, whereas `scope=global` would
    hand us every site on their account. Least privilege, and the user chooses the site."""
    params = {
        "client_id": WPCOM_CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "state": state,
    }
    if blog:
        # Pre-selects the site in the consent screen when we already know which one the
        # user typed, so they don't have to find it in a list.
        params["blog"] = blog
    return f"{AUTHORIZE_URI}?{urlencode(params)}"


async def exchange_code(code: str) -> dict:
    """Trade the callback code for an access token.
    Returns {access_token, blog_id, blog_url}; raises RuntimeError on failure."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        res = await client.post(TOKEN_URI, data={
            "client_id": WPCOM_CLIENT_ID,
            "client_secret": WPCOM_CLIENT_SECRET,
            "redirect_uri": REDIRECT_URI,
            "code": code,
            "grant_type": "authorization_code",
        })
    if res.status_code != 200:
        raise RuntimeError(f"WordPress.com token exchange failed: HTTP {res.status_code} {res.text[:200]}")
    data = res.json()
    if not data.get("access_token"):
        raise RuntimeError("WordPress.com did not return an access token.")
    return {
        "access_token": data["access_token"],
        "blog_id": str(data.get("blog_id") or ""),
        "blog_url": data.get("blog_url") or "",
    }


async def site_info(blog_id_or_host: str, access_token: str | None = None) -> dict:
    """Site name/URL via the v1.1 endpoint. Works unauthenticated for public sites, which
    is what the pre-connect probe uses; pass a token for private ones."""
    headers = {"Authorization": f"Bearer {access_token}"} if access_token else {}
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        res = await client.get(f"{API_ROOT}/rest/v1.1/sites/{blog_id_or_host}", headers=headers)
    if res.status_code != 200:
        raise RuntimeError(f"Could not read the WordPress.com site: HTTP {res.status_code}")
    data = res.json()
    return {
        "blog_id": str(data.get("ID") or ""),
        "name": data.get("name") or "",
        "url": data.get("URL") or "",
        # jetpack=false means a Simple site (must use this OAuth path); true means Atomic or
        # a self-hosted Jetpack site, which also exposes /wp-json/ and Application Passwords.
        "is_simple": not data.get("jetpack"),
    }


async def current_user(access_token: str) -> dict:
    """Who the token belongs to — shown as `display_name` on the connection."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        res = await client.get(f"{API_ROOT}/rest/v1.1/me",
                               headers={"Authorization": f"Bearer {access_token}"})
    if res.status_code != 200:
        raise RuntimeError(f"Could not read the WordPress.com account: HTTP {res.status_code}")
    data = res.json()
    return {"name": data.get("display_name") or data.get("username") or "", "id": data.get("ID")}
