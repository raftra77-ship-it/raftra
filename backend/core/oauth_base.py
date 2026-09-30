"""Where OAuth providers send the user back to, for the workspace connectors.

Every connector built its redirect URI from BACKEND_URL. In production that is the API host
(raftra-api.onrender.com), so connecting Meta or Shopify visibly threw the user out of the
product and onto a hosting provider's domain mid-authorisation - and, on a free Render
instance, onto one that may need a hundred seconds to wake up before it can answer the
callback. auth.py already solved this for sign-in by introducing OAUTH_REDIRECT_BASE and
pointing it at the app's own origin, which proxies /api/* to the backend anyway. The
connectors never picked that up.

Deliberately not a behaviour change by default. A redirect URI is only usable if the exact
string is registered in the provider's own console, so silently switching every connector
would break all six until each console was updated. The resolution order lets that migration
happen one provider at a time:

    CONNECTOR_REDIRECT_BASE   - set this to move the connectors, once the new callback URLs
                                are registered with Meta, Google, GitHub and Shopify
    OAUTH_REDIRECT_BASE       - reuses whatever sign-in already uses
    BACKEND_URL               - the original behaviour, and the fallback

So an untouched deployment keeps exactly the URIs it has registered today.
"""
import os


def connector_redirect_base() -> str:
    """The origin OAuth callbacks should return to, without a trailing slash."""
    for name in ("CONNECTOR_REDIRECT_BASE", "OAUTH_REDIRECT_BASE", "BACKEND_URL"):
        value = (os.getenv(name) or "").strip()
        if value:
            return value.rstrip("/")
    return "http://localhost:8005"


def callback_url(path: str) -> str:
    """Full redirect URI for a connector callback.

    `path` is the route as registered, e.g. "/api/connectors/meta/callback".
    """
    return connector_redirect_base() + "/" + path.lstrip("/")
