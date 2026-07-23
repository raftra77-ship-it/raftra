"""Shopify connector: publish approved content to a Shopify store's blog.

Shopify OAuth is per-shop, so the shop domain (e.g. my-store.myshopify.com) must be known
before we can build the authorize URL — unlike GitHub/Google where one URL serves everyone.

Articles are created UNPUBLISHED so a human still presses publish inside Shopify. We never
push live content silently.

Requires (founder, one-time, in the Shopify Partner app settings):
  - App URL / Allowed redirection URL: {BACKEND_URL}/api/connectors/shopify/callback
  - SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET in the environment
"""
import os
import re
import httpx

from .markdown_html import markdown_to_html

SHOPIFY_CLIENT_ID = os.getenv("SHOPIFY_CLIENT_ID", "")
SHOPIFY_CLIENT_SECRET = os.getenv("SHOPIFY_CLIENT_SECRET", "")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8005")

REDIRECT_URI = f"{BACKEND_URL}/api/connectors/shopify/callback"
API_VERSION = "2024-10"
# read_content/write_content cover blog posts and pages.
SCOPE = "read_content,write_content"
TIMEOUT = 30.0


def is_configured() -> bool:
    return bool(SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET)


def normalize_shop(shop: str) -> str:
    """Accept 'store', 'store.myshopify.com' or a full URL -> 'store.myshopify.com'."""
    s = (shop or "").strip().lower()
    s = re.sub(r"^https?://", "", s).strip("/")
    s = s.split("/")[0]
    if not s:
        raise ValueError("Shop domain is required (e.g. my-store.myshopify.com)")
    if not s.endswith(".myshopify.com"):
        s = f"{s}.myshopify.com"
    if not re.fullmatch(r"[a-z0-9][a-z0-9\-]*\.myshopify\.com", s):
        raise ValueError(f"'{shop}' is not a valid Shopify shop domain")
    return s


def build_authorize_url(shop: str, state: str) -> str:
    from urllib.parse import urlencode
    shop = normalize_shop(shop)
    params = urlencode({
        "client_id": SHOPIFY_CLIENT_ID,
        "scope": SCOPE,
        "redirect_uri": REDIRECT_URI,
        "state": state,
    })
    return f"https://{shop}/admin/oauth/authorize?{params}"


async def exchange_code(shop: str, code: str) -> str:
    shop = normalize_shop(shop)
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        res = await client.post(
            f"https://{shop}/admin/oauth/access_token",
            json={"client_id": SHOPIFY_CLIENT_ID, "client_secret": SHOPIFY_CLIENT_SECRET, "code": code},
        )
    if res.status_code != 200:
        raise RuntimeError(f"Shopify token exchange failed: {res.status_code} {res.text[:200]}")
    token = res.json().get("access_token")
    if not token:
        raise RuntimeError("Shopify did not return an access token.")
    return token


def _headers(token: str) -> dict:
    return {"X-Shopify-Access-Token": token, "Content-Type": "application/json"}


def _base(shop: str) -> str:
    return f"https://{shop}/admin/api/{API_VERSION}"


async def fetch_shop_info(shop: str, token: str) -> dict:
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        res = await client.get(f"{_base(shop)}/shop.json", headers=_headers(token))
    if res.status_code != 200:
        return {"name": shop}
    s = res.json().get("shop", {})
    return {"name": s.get("name", shop), "domain": s.get("domain"), "email": s.get("email")}


async def list_blogs(conn) -> list:
    """Blogs available on the store (a store usually has at least 'News')."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        res = await client.get(f"{_base(conn.shop_domain)}/blogs.json", headers=_headers(conn.access_token))
    if res.status_code != 200:
        raise RuntimeError(f"Could not list Shopify blogs: {res.status_code} {res.text[:200]}")
    return [{"id": b["id"], "title": b.get("title", ""), "handle": b.get("handle", "")}
            for b in res.json().get("blogs", [])]


async def publish_markdown(conn, title: str, body: str, published: bool = False) -> dict:
    """Create a blog article from markdown. Unpublished by default — a human publishes it."""
    blog_id = getattr(conn, "blog_id", None)
    if not blog_id:
        blogs = await list_blogs(conn)
        if not blogs:
            raise RuntimeError("This Shopify store has no blog to publish to — create one in Shopify first.")
        blog_id = blogs[0]["id"]

    html = markdown_to_html(body)
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        res = await client.post(
            f"{_base(conn.shop_domain)}/blogs/{blog_id}/articles.json",
            headers=_headers(conn.access_token),
            json={"article": {"title": title, "body_html": html, "published": published}},
        )
    if res.status_code not in (200, 201):
        raise RuntimeError(f"Shopify publish failed: {res.status_code} {res.text[:200]}")
    a = res.json().get("article", {})
    return {
        "article_id": a.get("id"),
        "blog_id": blog_id,
        "published": a.get("published_at") is not None,
        "admin_url": f"https://{conn.shop_domain}/admin/articles/{a.get('id')}",
    }
