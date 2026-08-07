"""WordPress connector: publish approved content to a WordPress site.

Uses **Application Passwords** (built into WordPress 5.6+) rather than OAuth, because
that is what self-hosted sites actually support out of the box and it needs no app
registration. The client creates one under:
    WP Admin -> Users -> Profile -> Application Passwords

Everything is published as a DRAFT so the "human review" guarantee is preserved — a
person still hits Publish inside WordPress. We never push live content silently.
"""
import ipaddress
import re
from urllib.parse import urlsplit, urlunsplit

import httpx

from .markdown_html import markdown_to_html

TIMEOUT = 30.0

# Paths people paste straight out of the browser while sitting in wp-admin. The REST root
# is built off the SITE root, so these have to come off before we append /wp-json/.
_ADMIN_PATH_RE = re.compile(r"/(wp-admin|wp-login\.php|wp-json)(/.*)?$", re.IGNORECASE)


def _api(site_url: str, path: str) -> str:
    return f"{(site_url or '').rstrip('/')}/wp-json/wp/v2/{path.lstrip('/')}"


def _auth(conn):
    return (conn.username, conn.app_password)


# ─────────────────────────────────────────────── transport (self-hosted vs WordPress.com)
# A connection is driven either by an Application Password (self-hosted WordPress, Basic
# auth against the site's own /wp-json/) or by a WordPress.com OAuth token (Bearer auth
# against public-api.wordpress.com's wp/v2 proxy). Both speak the SAME wp/v2 request and
# response shape, so every function below is written once and only the base URL and the
# auth mechanism change here. See core/wpcom_oauth.py.

AUTH_APP_PASSWORD = "app_password"
AUTH_WPCOM_OAUTH = "wpcom_oauth"


def is_wpcom(conn) -> bool:
    return getattr(conn, "auth_type", AUTH_APP_PASSWORD) == AUTH_WPCOM_OAUTH


def _base(conn) -> str:
    """The wp/v2 root for this connection."""
    if is_wpcom(conn):
        from . import wpcom_oauth
        # api_base is stored at connect time so a future change of WordPress.com's proxy
        # host doesn't silently repoint existing connections.
        return (getattr(conn, "api_base", None) or wpcom_oauth.api_base(conn.wpcom_site_id)).rstrip("/")
    return f"{(conn.site_url or '').rstrip('/')}/wp-json/wp/v2"


def _request_kwargs(conn) -> dict:
    """Auth kwargs for httpx: Bearer header for WordPress.com, Basic for a self-hosted site."""
    if is_wpcom(conn):
        return {"headers": {"Authorization": f"Bearer {conn.access_token}"}}
    return {"auth": (conn.username, conn.app_password)}


async def _request(conn, method: str, path: str, **kwargs) -> httpx.Response:
    """One request against whichever WordPress this connection points at."""
    url = f"{_base(conn)}/{path.lstrip('/')}"
    kw = {**_request_kwargs(conn), **kwargs}
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
        return await client.request(method, url, **kw)


def describe(conn) -> str:
    """Human label for error messages, so a failure names the right system."""
    return "WordPress.com" if is_wpcom(conn) else "WordPress"


def _is_local_host(netloc: str) -> bool:
    """True for hosts where forcing https would break a legitimate setup (dev machines, LAN
    boxes). Public hosts get upgraded, so an application password is never sent in clear."""
    host = (netloc or "").rsplit("@", 1)[-1].split(":")[0].strip("[]").lower()
    if host in ("localhost", "127.0.0.1", "::1") or host.endswith((".local", ".test", ".localhost")):
        return True
    try:
        return ipaddress.ip_address(host).is_private
    except ValueError:
        return False


def _is_blocked_host(netloc: str) -> bool:
    """Link-local addresses are never a customer's WordPress site, but they ARE the cloud
    metadata endpoint (169.254.169.254 on AWS/GCP/Azure). Since this connector fetches a
    user-supplied URL from the server and surfaces part of the response body in its error
    messages, an unblocked link-local address would be a server-side request forgery read
    primitive. Ordinary localhost/LAN addresses stay allowed — people do self-host."""
    host = (netloc or "").rsplit("@", 1)[-1].split(":")[0].strip("[]").lower()
    if host in ("metadata.google.internal", "metadata"):
        return True
    try:
        return ipaddress.ip_address(host).is_link_local
    except ValueError:
        return False


def normalize_site_url(site_url: str) -> str:
    """Turn whatever the user pasted into the bare site root we can hang /wp-json/ off."""
    raw = (site_url or "").strip()
    if not raw:
        return ""
    if not re.match(r"^https?://", raw, re.IGNORECASE):
        raw = "https://" + raw
    parts = urlsplit(raw)
    if _is_blocked_host(parts.netloc):
        raise RuntimeError("That address is not a reachable WordPress site.")
    scheme = parts.scheme.lower()
    # An application password is a live credential; never put one on the wire over plaintext
    # http to a public host just because that is what the user happened to type.
    if scheme == "http" and not _is_local_host(parts.netloc):
        scheme = "https"
    path = _ADMIN_PATH_RE.sub("", parts.path or "").rstrip("/")
    return urlunsplit((scheme, parts.netloc, path, "", "")).rstrip("/")


async def _diagnose_missing_rest_api(client: httpx.AsyncClient, site_url: str) -> str:
    """Called when /wp-json/ 404s, to work out WHY and return an error the user can act on.

    The common cause is a WordPress.com-hosted site. WordPress.com "Simple" sites serve no
    /wp-json/ on their own domain at all — their REST API lives on public-api.wordpress.com
    behind OAuth2, and Application Passwords (a wp-core feature) do not exist there. Business
    and Commerce plans run on Atomic, which *does* expose /wp-json/ — so the plan decides
    this, not the domain, and we ask WordPress.com rather than pattern-matching the host.
    """
    host = urlsplit(site_url).netloc.rsplit("@", 1)[-1].split(":")[0].lower()
    try:
        info = await client.get(f"https://public-api.wordpress.com/rest/v1.1/sites/{host}")
        if info.status_code == 200 and not info.json().get("jetpack"):
            name = info.json().get("name") or host
            return (
                f"'{name}' is a WordPress.com-hosted site. WordPress.com Simple sites do not "
                "expose /wp-json/ and do not support Application Passwords — their REST API is "
                "on public-api.wordpress.com behind OAuth. To connect, use a self-hosted "
                "WordPress site, or upgrade this site to a WordPress.com Business/Commerce plan "
                "(those run on Atomic, which does expose /wp-json/)."
            )
    except Exception:
        pass
    return (
        "WordPress REST API not found at that URL. Check the address is your site's home page "
        "(not /wp-admin), and that the REST API is not disabled by a security plugin."
    )


async def verify_connection(site_url: str, username: str, app_password: str) -> dict:
    """Confirm the credentials work before we store them.
    Returns {'name': <display name>, 'site': <site title>}; raises on failure."""
    site_url = normalize_site_url(site_url)
    if not site_url:
        raise RuntimeError("Enter your WordPress site URL.")
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
        try:
            me = await client.get(_api(site_url, "users/me"), auth=(username, app_password))
        except httpx.RequestError as e:
            raise RuntimeError(f"Could not reach {site_url} ({e.__class__.__name__}).")
        if me.status_code == 401:
            raise RuntimeError("WordPress rejected the credentials (check the username and application password).")
        if me.status_code == 404:
            raise RuntimeError(await _diagnose_missing_rest_api(client, site_url))
        if me.status_code != 200:
            raise RuntimeError(f"WordPress check failed: HTTP {me.status_code} {me.text[:150]}")
        try:
            info = me.json()
        except ValueError:
            # A soft 404: the site answered 200 with an HTML page instead of REST JSON.
            raise RuntimeError(await _diagnose_missing_rest_api(client, site_url))
        title = ""
        try:
            root = await client.get(f"{site_url}/wp-json")
            if root.status_code == 200:
                title = root.json().get("name", "")
        except Exception:
            pass
    return {"site_url": site_url, "name": info.get("name", ""), "site": title}


async def list_pages(conn) -> list:
    """Pages (About, Contact, etc.) whose title/content this connection can edit. Uses
    context=edit to get real (unrendered) fields. Returns [{id, title, slug, link}]."""
    res = await _request(conn, "GET", "pages", params={"per_page": 100, "context": "edit"})
    if res.status_code != 200:
        raise RuntimeError(f"Could not list {describe(conn)} pages: {res.status_code} {res.text[:200]}")
    out = []
    for p in res.json():
        title = p.get("title") or {}
        out.append({
            "id": p.get("id"),
            "title": title.get("raw") or title.get("rendered", ""),
            "slug": p.get("slug", ""),
            "link": p.get("link", ""),
        })
    return out


async def get_page_content(conn, page_id: int) -> dict:
    """Raw (editable) title + content for one WP page — the source an on-page fix edits."""
    res = await _request(conn, "GET", f"pages/{page_id}", params={"context": "edit"})
    if res.status_code != 200:
        raise RuntimeError(f"Could not read {describe(conn)} page {page_id}: {res.status_code} {res.text[:200]}")
    data = res.json()
    title = data.get("title") or {}
    content = data.get("content") or {}
    return {"title": title.get("raw", ""), "content": content.get("raw", "")}


async def update_page_content(conn, page_id: int, title: str, content: str) -> dict:
    """Update a WP page's title and/or content directly — this IS a live write (WordPress
    pages have no pull-request concept). The caller must have already gotten human review
    (e.g. via a dry_run preview) before calling this. Deliberately does NOT touch any
    SEO-plugin meta field (title tag / meta description) — those require a specific plugin
    (Yoast, RankMath, ...) whose presence we can't assume; only WP core's own title/content
    fields are ever written here.
    """
    res = await _request(conn, "POST", f"pages/{page_id}", json={"title": title, "content": content})
    if res.status_code not in (200, 201):
        raise RuntimeError(f"{describe(conn)} page update failed: {res.status_code} {res.text[:200]}")
    data = res.json()
    return {
        "page_id": data.get("id"),
        "link": data.get("link"),
        "edit_url": edit_url(conn, page_id, kind="page"),
    }


def edit_url(conn, post_id: int, kind: str = "post") -> str:
    """Where a human goes to review the change. WordPress.com Simple sites have no
    /wp-admin of their own — their editor lives on wordpress.com under the site slug."""
    if is_wpcom(conn):
        host = urlsplit(conn.site_url or "").netloc or (conn.site_url or "")
        return f"https://wordpress.com/{kind}/{host}/{post_id}"
    return f"{(conn.site_url or '').rstrip('/')}/wp-admin/post.php?post={post_id}&action=edit"


# ─────────────────────────────────────────────────────── SEO plugin (Yoast / Rank Math)
# WordPress core has no meta-description or canonical field, so those can only be written
# through whichever SEO plugin the site runs. We detect the plugin from the REST namespaces
# the site advertises, then write its post-meta keys.
#
# Critically, we do NOT assume the write worked: a plugin only accepts meta over REST if it
# registered those keys with show_in_rest, which varies by plugin version. So every write is
# read back and verified, and anything that did not persist is reported as skipped rather
# than being counted as applied. That keeps the "we never claim a fix we did not make"
# guarantee that the rest of this pipeline relies on.

SEO_PLUGIN_META = {
    "yoast": {
        "label": "Yoast SEO",
        "title": "_yoast_wpseo_title",
        "description": "_yoast_wpseo_metadesc",
        "canonical": "_yoast_wpseo_canonical",
    },
    "rankmath": {
        "label": "Rank Math",
        "title": "rank_math_title",
        "description": "rank_math_description",
        "canonical": "rank_math_canonical_url",
    },
}

_PLUGIN_NAMESPACES = {"yoast/v1": "yoast", "rankmath/v1": "rankmath"}


async def detect_seo_plugin(conn) -> str | None:
    """Return 'yoast' | 'rankmath' | None, from the namespaces at the site's REST root.

    WordPress.com Simple sites always return None: they cannot install plugins, and their
    proxy exposes no namespace index. Their metadata fixes stay reported as skipped.
    """
    if is_wpcom(conn):
        return None
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
            res = await client.get(f"{(conn.site_url or '').rstrip('/')}/wp-json",
                                   auth=(conn.username, conn.app_password))
        if res.status_code != 200:
            return None
        namespaces = res.json().get("namespaces") or []
    except Exception:
        return None
    for ns in namespaces:
        if ns in _PLUGIN_NAMESPACES:
            return _PLUGIN_NAMESPACES[ns]
    return None


async def read_page_seo_meta(conn, page_id: int, plugin: str) -> dict:
    """Current SEO-plugin meta for a page, in the same generic names update_page_seo_meta
    takes. Used to snapshot what a write is about to overwrite, so undo can restore it."""
    keys = SEO_PLUGIN_META.get(plugin)
    if not keys:
        return {}
    res = await _request(conn, "GET", f"pages/{page_id}", params={"context": "edit"})
    if res.status_code != 200:
        return {}
    meta = res.json().get("meta") or {}
    return {name: meta.get(keys[name]) for name in ("title", "description", "canonical")
            if meta.get(keys[name])}


async def update_page_seo_meta(conn, page_id: int, plugin: str, fields: dict) -> dict:
    """Write title/description/canonical into the SEO plugin's post meta, then read back to
    confirm each one actually persisted.

    `fields` uses generic names ('title', 'description', 'canonical'). Returns
    {applied: [...], skipped: [...]} in those same generic names.
    """
    keys = SEO_PLUGIN_META.get(plugin)
    if not keys:
        return {"applied": [], "skipped": sorted(k for k, v in fields.items() if v)}

    wanted = {name: value for name, value in fields.items() if value and name in keys}
    if not wanted:
        return {"applied": [], "skipped": []}

    meta_payload = {keys[name]: value for name, value in wanted.items()}
    res = await _request(conn, "POST", f"pages/{page_id}", json={"meta": meta_payload})
    if res.status_code not in (200, 201):
        # The plugin rejected the write outright — honest failure, nothing applied.
        return {"applied": [], "skipped": sorted(wanted)}

    # Read back: a meta key the plugin never registered with show_in_rest is silently
    # dropped by WordPress, which still answers 200. Only what survives counts as applied.
    check = await _request(conn, "GET", f"pages/{page_id}", params={"context": "edit"})
    persisted = (check.json().get("meta") or {}) if check.status_code == 200 else {}
    applied, skipped = [], []
    for name, value in wanted.items():
        (applied if persisted.get(keys[name]) == value else skipped).append(name)
    return {"applied": sorted(applied), "skipped": sorted(skipped)}


# ─────────────────────────────────────────────────────────── Gutenberg block markup
# Modern WordPress stores post bodies as annotated blocks:
#     <!-- wp:paragraph --><p>text</p><!-- /wp:paragraph -->
# Raw HTML without those annotations still renders, but the editor lumps it into a single
# "Classic" block and themes with block-level typography (every default theme since
# Twenty Twenty-Two, and all of WordPress.com's) style it inconsistently — which is why
# applied content came out looking unstyled next to the rest of the site. Wrapping the
# model's semantic HTML in block comments makes it real, individually editable blocks that
# inherit the theme's fonts and spacing.

_BLOCK_FOR_TAG = {
    "p": "paragraph", "ul": "list", "ol": "list", "blockquote": "quote",
    "figure": "image", "pre": "code", "table": "table", "hr": "separator",
}


def to_gutenberg_blocks(html: str) -> str:
    """Wrap top-level semantic HTML in Gutenberg block comments. Idempotent: content that
    already contains block annotations is returned untouched, so re-applying a fix does not
    nest blocks inside blocks."""
    if not html or "<!-- wp:" in html:
        return html

    out, pos = [], 0
    # Only top-level elements become blocks; anything inside them is the block's own markup.
    pattern = re.compile(r"<(h[1-6]|p|ul|ol|blockquote|figure|pre|table|hr)\b[^>]*>",
                         re.IGNORECASE)
    while pos < len(html):
        m = pattern.search(html, pos)
        if not m:
            break
        tag = m.group(1).lower()
        if tag == "hr":
            end = m.end()
        else:
            close = re.compile(rf"</{tag}\s*>", re.IGNORECASE)
            cm = close.search(html, m.end())
            if not cm:
                break
            end = cm.end()

        loose = html[pos:m.start()].strip()
        if loose:
            # Stray text between elements is still content; keep it as a paragraph rather
            # than dropping it on the floor.
            out.append(f"<!-- wp:paragraph --><p>{loose}</p><!-- /wp:paragraph -->")

        element = html[m.start():end]
        if tag.startswith("h"):
            block = f'<!-- wp:heading {{"level":{tag[1]}}} -->{element}<!-- /wp:heading -->'
        else:
            name = _BLOCK_FOR_TAG.get(tag, "html")
            attrs = ' {"ordered":true}' if tag == "ol" else ""
            block = f"<!-- wp:{name}{attrs} -->{element}<!-- /wp:{name} -->"
        out.append(block)
        pos = end

    tail = html[pos:].strip()
    if tail:
        out.append(f"<!-- wp:paragraph --><p>{tail}</p><!-- /wp:paragraph -->")
    return "\n\n".join(out) if out else html


_JSONLD_START = "<!-- raftra:jsonld:start -->"
_JSONLD_END = "<!-- raftra:jsonld:end -->"


def inject_jsonld(content: str, jsonld_json: str) -> str:
    """Embed (or replace) an Organization JSON-LD <script> block in a page's content.
    WordPress core has no site-wide JSON-LD location without a plugin, so this writes it
    straight into the page body between marker comments — idempotent, so re-applying
    replaces the previous block instead of duplicating it. Note: WordPress's REST API
    strips <script> tags via wp_kses for users without the unfiltered_html capability
    (non-Administrators) — the connected Application Password must belong to an Admin."""
    block = f'{_JSONLD_START}\n<script type="application/ld+json">\n{jsonld_json}\n</script>\n{_JSONLD_END}'
    if _JSONLD_START in content:
        return re.sub(re.escape(_JSONLD_START) + r".*?" + re.escape(_JSONLD_END), block, content, flags=re.DOTALL)
    return content.rstrip() + "\n\n" + block


async def publish_markdown(conn, title: str, body: str, status: str = "draft") -> dict:
    """Create a WordPress post from markdown. Draft by default — a human publishes it."""
    html = markdown_to_html(body)
    res = await _request(conn, "POST", "posts",
                         json={"title": title, "content": html, "status": status})
    if res.status_code not in (200, 201):
        raise RuntimeError(f"{describe(conn)} publish failed: HTTP {res.status_code} {res.text[:200]}")
    data = res.json()
    post_id = data.get("id")
    return {
        "post_id": post_id,
        "status": data.get("status"),
        "edit_url": edit_url(conn, post_id, kind="post"),
        "link": data.get("link"),
    }
