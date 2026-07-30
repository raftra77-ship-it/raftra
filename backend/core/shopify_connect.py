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
# read_content/write_content cover blog posts and pages. read_themes/write_themes are
# needed for theme-level SEO fixes (title/meta/canonical/OG/Twitter/JSON-LD tags live in
# theme Liquid files, not in Page metafields) — added for that feature; existing connected
# stores must reconnect to pick up the wider scope (Shopify requires re-auth on scope growth).
SCOPE = "read_content,write_content,read_themes,write_themes"
TIMEOUT = 30.0
# Shopify's REST Admin API is limited to ~2 requests/second (leaky bucket). Theme
# duplication makes many sequential asset calls, so each one is throttled to stay under
# that — see duplicate_theme() below.
_RATE_LIMIT_DELAY = 0.55


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


async def list_pages(conn) -> list:
    """The store's Pages (About, Contact, etc.) — the resources whose SEO title/description
    we can update with the current read_content/write_content scope."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        res = await client.get(f"{_base(conn.shop_domain)}/pages.json",
                               headers=_headers(conn.access_token), params={"limit": 250})
    if res.status_code != 200:
        raise RuntimeError(f"Could not list Shopify pages: {res.status_code} {res.text[:200]}")
    out = []
    for p in res.json().get("pages", []):
        out.append({
            "id": p.get("id"),
            "title": p.get("title", ""),
            "handle": p.get("handle", ""),
            "seo_title": p.get("metafields_global_title_tag"),
            "seo_description": p.get("metafields_global_description_tag"),
        })
    return out


async def update_page_seo(conn, page_id: int, title_tag: str, description_tag: str) -> dict:
    """Set the SEO title tag + meta description on a Shopify Page via the Admin API.
    These are the same fields as Shopify admin's 'Edit website SEO' box — reversible there.
    Uses the metafields_global_* convenience fields (supported for pages/products/articles)."""
    payload = {"page": {"id": page_id}}
    if title_tag is not None:
        payload["page"]["metafields_global_title_tag"] = title_tag
    if description_tag is not None:
        payload["page"]["metafields_global_description_tag"] = description_tag
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        res = await client.put(f"{_base(conn.shop_domain)}/pages/{page_id}.json",
                               headers=_headers(conn.access_token), json=payload)
    if res.status_code not in (200, 201):
        raise RuntimeError(f"Shopify SEO update failed: {res.status_code} {res.text[:200]}")
    p = res.json().get("page", {})
    return {
        "page_id": p.get("id"),
        "seo_title": p.get("metafields_global_title_tag"),
        "seo_description": p.get("metafields_global_description_tag"),
        "admin_url": f"https://{conn.shop_domain}/admin/pages/{page_id}",
    }


async def get_granted_scopes(conn) -> list:
    """GET /admin/oauth/access_scopes.json — the scopes actually granted to this connection's
    token, which can be narrower than the app's current SCOPE if the store connected before
    a scope was added (e.g. before read_themes/write_themes existed). Used to detect
    "needs to reconnect" rather than guessing from a failed theme call."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        res = await client.get(f"https://{conn.shop_domain}/admin/oauth/access_scopes.json",
                               headers=_headers(conn.access_token))
    if res.status_code != 200:
        raise RuntimeError(f"Could not read granted scopes: {res.status_code} {res.text[:200]}")
    return [s["handle"] for s in res.json().get("access_scopes", [])]


async def list_themes(conn) -> list:
    """GET /themes.json — every theme on the store, with its role. role == "main" is the
    currently published (live) theme."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        res = await client.get(f"{_base(conn.shop_domain)}/themes.json", headers=_headers(conn.access_token))
    if res.status_code != 200:
        raise RuntimeError(f"Could not list Shopify themes: {res.status_code} {res.text[:200]}")
    return [{"id": str(t["id"]), "name": t.get("name", ""), "role": t.get("role", "")}
            for t in res.json().get("themes", [])]


async def get_main_theme(conn) -> dict:
    """The live theme visitors currently see — the one Auto Apply must NEVER write to."""
    themes = await list_themes(conn)
    main = next((t for t in themes if t["role"] == "main"), None)
    if not main:
        raise RuntimeError("Could not find a published (main) theme on this store.")
    return main


async def list_theme_assets(conn, theme_id: str) -> list:
    """GET /themes/{id}/assets.json — every file path in a theme (Liquid, JSON, CSS, JS,
    images...). Used both to know what to copy when duplicating, and to find SEO-relevant
    template files."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        res = await client.get(f"{_base(conn.shop_domain)}/themes/{theme_id}/assets.json",
                               headers=_headers(conn.access_token))
    if res.status_code != 200:
        raise RuntimeError(f"Could not list assets for theme {theme_id}: {res.status_code} {res.text[:200]}")
    return [{"key": a["key"], "content_type": a.get("content_type")} for a in res.json().get("assets", [])]


async def get_theme_asset(conn, theme_id: str, key: str) -> dict:
    """GET one theme file's content. Text files come back as {"value": str}; binary files
    (images, fonts) come back as {"attachment": base64 str} — both are returned as-is so the
    caller can round-trip either kind without us needing to know which up front."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        res = await client.get(f"{_base(conn.shop_domain)}/themes/{theme_id}/assets.json",
                               headers=_headers(conn.access_token), params={"asset[key]": key})
    if res.status_code != 200:
        raise RuntimeError(f"Could not read '{key}' from theme {theme_id}: {res.status_code} {res.text[:200]}")
    asset = res.json().get("asset", {})
    if "value" in asset:
        return {"value": asset["value"]}
    if "attachment" in asset:
        return {"attachment": asset["attachment"]}
    return {"value": ""}


async def put_theme_asset(conn, theme_id: str, key: str, *, value: str = None, attachment: str = None) -> None:
    """Write one file into a theme — creates it if missing, overwrites if present. Exactly
    one of value (text) / attachment (base64, for binary files) must be given."""
    payload = {"asset": {"key": key}}
    if value is not None:
        payload["asset"]["value"] = value
    elif attachment is not None:
        payload["asset"]["attachment"] = attachment
    else:
        raise ValueError("put_theme_asset requires either value or attachment.")
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        res = await client.put(f"{_base(conn.shop_domain)}/themes/{theme_id}/assets.json",
                               headers=_headers(conn.access_token), json=payload)
    if res.status_code not in (200, 201):
        raise RuntimeError(f"Could not write '{key}' to theme {theme_id}: {res.status_code} {res.text[:200]}")


async def create_empty_theme(conn, name: str) -> dict:
    """POST /themes.json with no src — Shopify creates a new theme from its default
    (Dawn-based) starter. We immediately overwrite its assets with the live theme's own
    files (see duplicate_theme), so what it started from doesn't matter. role defaults to
    "unpublished" — it is never the live theme."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        res = await client.post(f"{_base(conn.shop_domain)}/themes.json",
                                headers=_headers(conn.access_token), json={"theme": {"name": name}})
    if res.status_code not in (200, 201):
        raise RuntimeError(f"Could not create a new theme: {res.status_code} {res.text[:200]}")
    t = res.json().get("theme", {})
    return {"id": str(t["id"]), "name": t.get("name", ""), "role": t.get("role", "")}


async def duplicate_theme(conn, source_theme_id: str, new_name: str,
                          on_progress=None) -> str:
    """The actual "duplicate" operation: create an empty theme, then copy every asset from
    the source theme into it, one at a time, rate-limited to stay under Shopify's REST API
    limit. Returns the new theme's id. Slow by nature (can be 100+ files) — callers should
    run this as a background task, not block a request on it.

    `on_progress(copied, total)` is called after each file, if given, so a caller can persist
    progress (e.g. into ShopifyThemeDraft) for the frontend to poll.
    """
    import asyncio
    new_theme = await create_empty_theme(conn, new_name)
    new_id = new_theme["id"]

    assets = await list_theme_assets(conn, source_theme_id)
    total = len(assets)
    for i, asset in enumerate(assets):
        key = asset["key"]
        await asyncio.sleep(_RATE_LIMIT_DELAY)
        content = await get_theme_asset(conn, source_theme_id, key)
        await asyncio.sleep(_RATE_LIMIT_DELAY)
        await put_theme_asset(conn, new_id, key, **content)
        if on_progress:
            on_progress(i + 1, total)

    return new_id


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
