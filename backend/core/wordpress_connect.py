"""WordPress connector: publish approved content to a WordPress site.

Uses **Application Passwords** (built into WordPress 5.6+) rather than OAuth, because
that is what self-hosted sites actually support out of the box and it needs no app
registration. The client creates one under:
    WP Admin -> Users -> Profile -> Application Passwords

Everything is published as a DRAFT so the "human review" guarantee is preserved — a
person still hits Publish inside WordPress. We never push live content silently.
"""
import re
import httpx

from .markdown_html import markdown_to_html

TIMEOUT = 30.0


def _api(site_url: str, path: str) -> str:
    return f"{(site_url or '').rstrip('/')}/wp-json/wp/v2/{path.lstrip('/')}"


def _auth(conn):
    return (conn.username, conn.app_password)


async def verify_connection(site_url: str, username: str, app_password: str) -> dict:
    """Confirm the credentials work before we store them.
    Returns {'name': <display name>, 'site': <site title>}; raises on failure."""
    site_url = (site_url or "").strip().rstrip("/")
    if not site_url.startswith("http"):
        site_url = "https://" + site_url
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
        me = await client.get(_api(site_url, "users/me"), auth=(username, app_password))
        if me.status_code == 401:
            raise RuntimeError("WordPress rejected the credentials (check the username and application password).")
        if me.status_code == 404:
            raise RuntimeError("WordPress REST API not found at that URL — is this a WordPress site with the REST API enabled?")
        if me.status_code != 200:
            raise RuntimeError(f"WordPress check failed: HTTP {me.status_code} {me.text[:150]}")
        info = me.json()
        title = ""
        try:
            root = await client.get(f"{site_url}/wp-json")
            if root.status_code == 200:
                title = root.json().get("name", "")
        except Exception:
            pass
    return {"site_url": site_url, "name": info.get("name", ""), "site": title}


async def publish_markdown(conn, title: str, body: str, status: str = "draft") -> dict:
    """Create a WordPress post from markdown. Draft by default — a human publishes it."""
    html = markdown_to_html(body)
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
        res = await client.post(
            _api(conn.site_url, "posts"),
            auth=_auth(conn),
            json={"title": title, "content": html, "status": status},
        )
    if res.status_code not in (200, 201):
        raise RuntimeError(f"WordPress publish failed: HTTP {res.status_code} {res.text[:200]}")
    data = res.json()
    post_id = data.get("id")
    return {
        "post_id": post_id,
        "status": data.get("status"),
        "edit_url": f"{conn.site_url.rstrip('/')}/wp-admin/post.php?post={post_id}&action=edit",
        "link": data.get("link"),
    }
