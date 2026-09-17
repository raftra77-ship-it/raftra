"""
Harvest every usable image from a brand's own site into the Asset Vault.

The vault already understood four sources - generated, scraped, gdrive, device - but
nothing ever produced a "scraped" one, so a brand's own product photography, lifestyle
shots and banners were absent from the one screen meant to hold them. Creative Studio then
had nothing of the brand's to work from except what it had generated itself.

Two decisions worth stating:

* Categorisation is by EVIDENCE, in a fixed order: markup hints first (a class or alt
  saying "logo" or "banner" is the site telling us what the image is), then aspect ratio
  (a 4:1 image is a banner whatever it is called), then a photo/product split. Guessing
  from the filename alone is unreliable - "img_1745.png" is the most common name on the web.

* Dimensions come from decoding the bytes, not from the width/height attributes, because
  those are frequently absent, lazily rewritten by the theme, or plain wrong. That costs a
  fetch per image, which is why the harvest is capped and runs off the request path.
"""
import asyncio
import io
import os
import re
from typing import List, Optional
from urllib.parse import urljoin, urlparse

# A real browser string. The self-identifying "RaftraBot/1.0" was being turned away by
# CDN bot protection - raftra.com itself answered it with HTTP 520 - so the harvest saw an
# error page and reported the site as having no usable images.
_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")


class SiteUnreachable(Exception):
    """The site itself could not be read, as opposed to being read and having no images.

    Kept distinct because the two need different words to the user: one is "your site
    blocked us / is down", the other is "your images are all smaller than the threshold",
    and reporting the first as the second sends people looking in the wrong place.
    """

# Chrome, sprites, tracking pixels and payment badges - never brand assets.
_JUNK_RE = re.compile(
    r"(sprite|favicon|tracking|pixel|analytics|placeholder|loader|spinner|blank|"
    r"1x1|payment|visa|mastercard|paypal|amex|rupay|upi|gpay|trustpilot|badge-|"
    r"arrow|chevron|caret|close-|menu-|hamburger|star-rating)", re.I)

_LOGO_RE = re.compile(r"logo|wordmark|masthead|brand-mark", re.I)
_BANNER_RE = re.compile(r"banner|hero|slide|carousel|billboard|marquee|cover", re.I)
_PRODUCT_RE = re.compile(r"product|item|sku|pack|bottle|box|shot|render|catalog", re.I)
_LIFESTYLE_RE = re.compile(r"lifestyle|model|people|team|story|about|blog|editorial", re.I)

_IMG_TAG_RE = re.compile(r"<img\b[^>]*>", re.I)
_ATTR_RE = re.compile(r'\b(src|data-src|data-original|data-lazy|srcset|alt|class|id)\s*=\s*["\']([^"\']*)["\']', re.I)

# Anything smaller than this is an icon, a bullet or a spacer, not an asset worth keeping.
MIN_DIMENSION = 200
MIN_BYTES = 4 * 1024
MAX_BYTES = 15 * 1024 * 1024


_BASE_RE = re.compile(r'<base[^>]+href\s*=\s*["\']([^"\']+)["\']', re.I)


def resolve_base(html: str, page_url: str) -> str:
    """The URL relative references on this page resolve against.

    HTML lets a page declare <base href>, and static site generators commonly emit one
    pointing at the site root. Ignoring it resolved raftra.com/ELEGANTE/'s
    src="gallery/x.jpg" to /ELEGANTE/gallery/x.jpg - a 404 that answers with an HTML error
    page - instead of the real /gallery/x.jpg, so every image on every sub-page was
    silently discarded for having the wrong content type.
    """
    m = _BASE_RE.search(html or "")
    if not m:
        return page_url
    href = m.group(1).strip()
    return urljoin(page_url, href) if href else page_url


def _first_from_srcset(value: str) -> str:
    """srcset is "a.jpg 400w, b.jpg 1200w" - take the largest candidate by its descriptor,
    falling back to the last one. Order is only a convention; "big 2x, small 1x" is valid."""
    best, best_size = "", -1.0
    for part in (value or "").split(","):
        bits = part.strip().split()
        if not bits:
            continue
        try:
            size = float(bits[1][:-1]) if len(bits) > 1 else 0.0
        except ValueError:
            size = 0.0
        if size >= best_size:
            best, best_size = bits[0], size
    return best


def collect_image_refs(html: str, base_url: str, limit: int = 60) -> List[dict]:
    """Every distinct image the page references, with the markup context that describes it.

    Context is carried forward because it is the strongest categorisation signal available,
    and it exists only here in the HTML - by the time we have the bytes it is gone.
    """
    html = html or ""
    # A page's <base href> wins over its own URL for resolving relative references.
    base_url = resolve_base(html, base_url)
    seen: set = set()
    out: List[dict] = []

    for tag in _IMG_TAG_RE.findall(html):
        attrs = {k.lower(): v for k, v in _ATTR_RE.findall(tag)}
        raw = (attrs.get("data-src") or attrs.get("data-original") or attrs.get("data-lazy")
               or attrs.get("src") or _first_from_srcset(attrs.get("srcset", "")))
        if not raw or raw.startswith("data:"):
            continue
        context = " ".join(filter(None, [attrs.get("class", ""), attrs.get("id", ""),
                                         attrs.get("alt", ""), raw]))
        if _JUNK_RE.search(context):
            continue
        absolute = urljoin(base_url, raw.strip())
        if urlparse(absolute).scheme not in ("http", "https"):
            continue
        key = absolute.split("?")[0]
        if key in seen:
            continue
        seen.add(key)
        out.append({"url": absolute, "alt": (attrs.get("alt") or "").strip()[:200],
                    "context": context})
        if len(out) >= limit:
            break

    def add(raw: str, context: str, alt: str = "") -> None:
        raw = (raw or "").strip().strip("'\"")
        if not raw or raw.startswith("data:") or len(out) >= limit or _JUNK_RE.search(raw):
            return
        absolute = urljoin(base_url, raw)
        if urlparse(absolute).scheme not in ("http", "https"):
            return
        key = absolute.split("?")[0]
        if key in seen:
            return
        seen.add(key)
        out.append({"url": absolute, "alt": alt[:200], "context": context + " " + raw})

    # og:image is the brand's chosen representative picture, so keep it even if the page
    # never renders it in an <img>.
    m = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\']',
                  html, re.I)
    if m:
        add(m.group(1), "og:image banner")

    # <picture><source srcset> carries the art-directed hero and product crops that the
    # fallback <img> often points at a tiny placeholder for.
    for m in re.finditer(r'<source\b[^>]*\bsrcset\s*=\s*["\']([^"\']+)["\']', html, re.I):
        add(_first_from_srcset(m.group(1)), "picture source")

    # Hero sections and banners are very often CSS backgrounds rather than <img> tags.
    for m in re.finditer(r'background(?:-image)?\s*:\s*url\(\s*([^)]+?)\s*\)', html, re.I):
        add(m.group(1), "background banner")

    # Product JSON-LD lists the catalogue photography even when the gallery is lazy-loaded
    # by script and absent from the markup.
    for m in re.finditer(r'"image"\s*:\s*(\[[^\]]*\]|"[^"]+")', html):
        for u in re.findall(r'"(https?:[^"]+|/[^"]+)"', m.group(1)):
            add(u.replace("\\/", "/"), "product jsonld")

    return out


_BUNDLE_IMG_RE = re.compile(
    r'["\'`]((?:https?:)?//[^"\'`\s]+?\.(?:png|jpe?g|webp|gif|avif)|'
    r'/[^"\'`\s]*?\.(?:png|jpe?g|webp|gif|avif))(?:\?[^"\'`\s]*)?["\'`]', re.I)


async def _bundle_image_refs(client, html: str, url: str, limit: int) -> List[dict]:
    """Image paths referenced inside a site's own JavaScript bundles.

    Bundlers rewrite `import hero from './hero.png'` to a string like "/assets/hero-3f2a.png"
    in the built JS, so this finds images on every route of an SPA without rendering each
    one. Only same-site scripts are read; third-party SDKs are not the brand's assets.
    """
    base = resolve_base(html, url)
    host = (urlparse(base).netloc or "").lower()
    refs, seen = [], set()
    scripts = re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', html or "", re.I)
    for src in scripts[:6]:
        script_url = urljoin(base, src)
        if (urlparse(script_url).netloc or "").lower() != host:
            continue
        try:
            r = await client.get(script_url, timeout=25)
            if r.status_code != 200 or len(r.content) > 8 * 1024 * 1024:
                continue
        except Exception:
            continue
        for m in _BUNDLE_IMG_RE.finditer(r.text):
            raw = m.group(1)
            if _JUNK_RE.search(raw):
                continue
            absolute = urljoin(base, raw)
            key = absolute.split("?")[0]
            if key in seen or urlparse(absolute).scheme not in ("http", "https"):
                continue
            seen.add(key)
            refs.append({"url": absolute, "alt": "", "context": "bundle " + raw})
            if len(refs) >= limit:
                return refs
    return refs


async def _store_feed_refs(client, url: str, limit: int) -> List[dict]:
    """Product photography from a store's public catalogue feed, when it has one.

    Shopify (/products.json) and WooCommerce (Store API) both publish every product image
    without authentication. On a D2C store that is the bulk of the brand's photography,
    and most of it is never on the handful of pages a crawl can afford to open.
    """
    origin = "{0.scheme}://{0.netloc}".format(urlparse(url))
    refs: List[dict] = []
    feeds = (
        ("%s/products.json?limit=250" % origin, "shopify"),
        ("%s/wp-json/wc/store/v1/products?per_page=100" % origin, "woocommerce"),
    )
    for feed, kind in feeds:
        try:
            r = await client.get(feed, timeout=20)
            if r.status_code != 200 or "json" not in (r.headers.get("content-type") or ""):
                continue
            data = r.json()
        except Exception:
            continue
        products = data.get("products", []) if kind == "shopify" and isinstance(data, dict) \
            else (data if isinstance(data, list) else [])
        for p in products:
            if not isinstance(p, dict):
                continue
            title = str(p.get("title") or p.get("name") or "").strip()
            for img in p.get("images") or []:
                src = img.get("src") if isinstance(img, dict) else None
                if src:
                    # Shopify states each image's size, so these need no download to
                    # measure. WooCommerce does not, and they are probed like page images.
                    refs.append({"url": urljoin(origin, src), "alt": title[:200],
                                 "context": "product " + title,
                                 "width": int(img.get("width") or 0),
                                 "height": int(img.get("height") or 0)})
                    if len(refs) >= limit:
                        return refs
        if refs:
            break
    return refs


def categorise(context: str, width: int, height: int) -> str:
    """One of: logos | banners | product_shots | lifestyle."""
    if _LOGO_RE.search(context):
        return "logos"
    if _BANNER_RE.search(context):
        return "banners"
    # Aspect ratio outranks a generic filename: a 4:1 image is a banner however it is named.
    if width and height and (width / height) >= 2.5:
        return "banners"
    if _PRODUCT_RE.search(context):
        return "product_shots"
    if _LIFESTYLE_RE.search(context):
        return "lifestyle"
    # A near-square image on a storefront is almost always the product on white.
    if width and height and 0.8 <= (width / height) <= 1.25:
        return "product_shots"
    return "lifestyle"


def _probe(content: bytes):
    """(width, height, format) from the bytes, or (0, 0, '') if undecodable."""
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(content))
        return img.width, img.height, (img.format or "").upper()
    except Exception:
        return 0, 0, ""


# Which pages are worth opening for pictures. Deliberately not the same ranking the brand
# crawl uses: that one wants About and Pricing for copy, while photography lives in shops,
# collections and galleries.
_IMAGE_PAGE_PRIORITY = (
    (100, r"/(product|products|shop|store|collection|collections|catalog|catalogue)"),
    (85,  r"/(gallery|portfolio|lookbook|work|projects|case-stud)"),
    (70,  r"/(menu|rooms|fleet|services|solutions)"),
    (55,  r"/(about|about-us|our-story|team)"),
    (40,  r"/(blog|news|press)"),
)
_IMAGE_PAGE_PENALTY = (r"/(privacy|terms|cookie|legal|refund|shipping|returns|login|signin|"
                       r"signup|register|account|cart|checkout|search|sitemap)")


def _image_page_links(html: str, base_url: str, limit: int) -> List[str]:
    """Same-domain pages most likely to carry photography, best first."""
    base_url = resolve_base(html, base_url)
    base_host = (urlparse(base_url).netloc or "").lower().replace("www.", "")
    base_norm = base_url.rstrip("/")
    seen, candidates = set(), []
    for m in re.finditer(r'href=["\']([^"\']+)["\']', html or "", re.I):
        href = m.group(1).strip()
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        absu = urljoin(base_url, href)
        pu = urlparse(absu)
        if pu.scheme not in ("http", "https"):
            continue
        if (pu.netloc or "").lower().replace("www.", "") != base_host:
            continue
        clean = pu._replace(fragment="").geturl()
        if clean.rstrip("/") == base_norm or clean in seen:
            continue
        if re.search(r"\.(png|jpe?g|gif|svg|webp|ico|pdf|zip|css|js|mp4|woff2?)(\?|$)", clean, re.I):
            continue
        seen.add(clean)
        candidates.append(clean)

    def score(u: str) -> int:
        path = (urlparse(u).path or "/").lower()
        s = 10
        for weight, pattern in _IMAGE_PAGE_PRIORITY:
            if re.search(pattern, path):
                s = weight
                break
        if re.search(_IMAGE_PAGE_PENALTY, path):
            s -= 80
        return s - min(len([p for p in path.split("/") if p]), 6) * 2

    candidates.sort(key=lambda u: -score(u))
    return candidates[:limit]


# Wall-clock budget for one harvest. In production the browser reaches this API through
# Vercel's /api rewrite, which gives up after 120 seconds (ROUTER_EXTERNAL_TARGET_ERROR),
# and a sleeping Render instance can spend 30-60 of those waking up. A slow origin used to
# be able to run the harvest past that: the user saw an error while the rows were still
# written. Past the budget the harvest stops starting new work and returns what it has.
HARVEST_BUDGET_S = float(os.getenv("HARVEST_BUDGET_SECONDS", "55"))


async def harvest(url: str, max_images: int = 24, max_pages: int = 6) -> List[dict]:
    """Fetch a site and return its usable images with real dimensions and a category.

    Returns [] rather than raising on any failure: a vault that stays empty is a far
    better outcome than an onboarding run that dies because one CDN was slow.
    """
    import httpx
    import time

    started = time.monotonic()

    def over_budget() -> bool:
        return time.monotonic() - started > HARVEST_BUDGET_S

    if not url:
        return []
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    results: List[dict] = []
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=25,
                                     headers={"User-Agent": _UA}) as client:
            try:
                page = await client.get(url)
                if page.status_code != 200:
                    raise SiteUnreachable(
                        "%s returned HTTP %d" % (url, page.status_code))
                html = page.text
            except SiteUnreachable:
                raise
            except Exception as e:
                raise SiteUnreachable("could not load %s (%s)" % (url, e)) from e

            refs = collect_image_refs(html, url, limit=max_images * 3)

            # A client-rendered site (React/Vite/Next SPA) ships an empty <div id="root">,
            # so the fetched HTML has no images at all. Render it like a browser, and read
            # the JS bundles, which reference every image the app imports on any route.
            if len(refs) < 5:
                known = {r["url"].split("?")[0] for r in refs}
                try:
                    from core import browser_render
                    if browser_render.is_available():
                        rendered = await browser_render.render(url, screenshot=False)
                        if rendered.get("html"):
                            html = rendered["html"]
                            for ref in collect_image_refs(html, url, limit=max_images * 3):
                                if ref["url"].split("?")[0] not in known:
                                    known.add(ref["url"].split("?")[0])
                                    refs.append(ref)
                except Exception as e:
                    print("[site_images] render fallback failed for %s: %s" % (url, e))
                for ref in await _bundle_image_refs(client, page.text, url, max_images * 2):
                    if ref["url"].split("?")[0] not in known:
                        known.add(ref["url"].split("?")[0])
                        refs.append(ref)

            # Catalogue feed after the homepage's own images: the homepage carries the
            # banners and logo, the feed carries the product photography, and a cap reached
            # on feed images alone would leave the vault with no banners at all.
            feed_refs = await _store_feed_refs(client, url, max_images * 2)
            if feed_refs:
                known = {r["url"].split("?")[0] for r in refs}
                refs = refs + [r for r in feed_refs if r["url"].split("?")[0] not in known]

            # max_pages was accepted but never used, so a harvest only ever read the
            # landing page. On a store that is the hero banner and little else - the
            # product photography lives on the collection and product pages the homepage
            # links to, which is most of what a brand would expect in its vault.
            # A store feed already lists the catalogue, so crawling product pages for the
            # same photos would only add slow duplicates at other sizes.
            if max_pages > 1 and len(feed_refs) < max_images:
                seen_refs = {r["url"] for r in refs}
                for link in _image_page_links(html, url, max_pages - 1):
                    if len(refs) >= max_images * 3 or over_budget():
                        break
                    try:
                        sub = await client.get(link)
                        if sub.status_code != 200:
                            continue
                    except Exception:
                        continue
                    for ref in collect_image_refs(sub.text, link, limit=max_images * 2):
                        if ref["url"] not in seen_refs:
                            seen_refs.add(ref["url"])
                            refs.append(ref)

            async def one(ref: dict) -> Optional[dict]:
                w, h = ref.get("width") or 0, ref.get("height") or 0
                if w and h:
                    if w < MIN_DIMENSION or h < MIN_DIMENSION:
                        return None
                    ext = urlparse(ref["url"]).path.rsplit(".", 1)[-1].upper()
                    fmt = "JPEG" if ext in ("JPG", "JPEG") else ext
                    return {
                        "source_url": ref["url"], "alt": ref["alt"],
                        "category": categorise(ref["context"], w, h),
                        "width": w, "height": h,
                        "mime_type": "image/%s" % fmt.lower(),
                        "format": fmt, "file_size_kb": None,
                        "filename": (urlparse(ref["url"]).path.rsplit("/", 1)[-1] or "image")[:120],
                    }
                try:
                    r = await client.get(ref["url"], timeout=20)
                    if r.status_code != 200:
                        return None
                    ctype = (r.headers.get("content-type") or "").lower()
                    if "image" not in ctype:
                        return None
                    size = len(r.content)
                    if size < MIN_BYTES or size > MAX_BYTES:
                        return None
                    w, h, fmt = _probe(r.content)
                    # SVGs never decode through PIL but are legitimate brand assets, so they
                    # are kept on content-type alone with unknown dimensions.
                    is_svg = "svg" in ctype
                    if not is_svg and (w < MIN_DIMENSION or h < MIN_DIMENSION):
                        return None
                    return {
                        "source_url": ref["url"],
                        "alt": ref["alt"],
                        "category": "logos" if is_svg and _LOGO_RE.search(ref["context"])
                                    else categorise(ref["context"], w, h),
                        "width": w, "height": h,
                        "mime_type": ctype.split(";")[0].strip(),
                        "format": "SVG" if is_svg else (fmt or "UNKNOWN"),
                        "file_size_kb": round(size / 1024, 1),
                        "filename": (urlparse(ref["url"]).path.rsplit("/", 1)[-1] or "image")[:120],
                    }
                except Exception:
                    return None

            # Each candidate costs a download, and many are rejected (too small, duplicates),
            # so fetch a bounded surplus rather than every reference the pages listed.
            refs = refs[:max_images * 3]

            # Bounded concurrency: 8 at a time keeps a full harvest to well under a minute
            # without hammering the origin.
            sem = asyncio.Semaphore(8)

            async def guarded(ref):
                async with sem:
                    return await one(ref)

            # In batches, so the harvest stops downloading as soon as the cap is met rather
            # than fetching every surplus candidate and discarding the results.
            seen_bytes = set()
            batch = 24
            for i in range(0, len(refs), batch):
                if over_budget():
                    print("[site_images] harvest of %s hit its %.0fs budget with %d images"
                          % (url, HARVEST_BUDGET_S, len(results)))
                    break
                for item in await asyncio.gather(*(guarded(r) for r in refs[i:i + batch])):
                    if not item:
                        continue
                    # The same image under two CDN size variants measures identically.
                    sig = (item["filename"].split("?")[0], item["width"], item["height"])
                    if sig in seen_bytes:
                        continue
                    seen_bytes.add(sig)
                    results.append(item)
                    if len(results) >= max_images:
                        break
                if len(results) >= max_images:
                    break
    except SiteUnreachable:
        # Surfaced to the caller: "we could not read your site" is actionable, and the
        # empty-vault fallback below would report it as "no images big enough".
        raise
    except Exception as e:
        print("[site_images] harvest failed for %s: %s" % (url, e))
        return []

    return results
