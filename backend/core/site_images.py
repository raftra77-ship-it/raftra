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
import re
from typing import List, Optional
from urllib.parse import urljoin, urlparse

_UA = "Mozilla/5.0 (compatible; RaftraBot/1.0)"

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


def _first_from_srcset(value: str) -> str:
    """srcset is "a.jpg 400w, b.jpg 1200w" - take the LAST (largest) candidate."""
    parts = [p.strip().split(" ")[0] for p in (value or "").split(",") if p.strip()]
    return parts[-1] if parts else ""


def collect_image_refs(html: str, base_url: str, limit: int = 60) -> List[dict]:
    """Every distinct image the page references, with the markup context that describes it.

    Context is carried forward because it is the strongest categorisation signal available,
    and it exists only here in the HTML - by the time we have the bytes it is gone.
    """
    html = html or ""
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

    # og:image is the brand's chosen representative picture, so keep it even if the page
    # never renders it in an <img>.
    m = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\']',
                  html, re.I)
    if m:
        absolute = urljoin(base_url, m.group(1))
        if absolute.split("?")[0] not in seen:
            out.append({"url": absolute, "alt": "", "context": "og:image banner"})

    return out


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


async def harvest(url: str, max_images: int = 24, max_pages: int = 1) -> List[dict]:
    """Fetch a site and return its usable images with real dimensions and a category.

    Returns [] rather than raising on any failure: a vault that stays empty is a far
    better outcome than an onboarding run that dies because one CDN was slow.
    """
    import httpx

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
                    return []
                html = page.text
            except Exception as e:
                print("[site_images] could not load %s: %s" % (url, e))
                return []

            refs = collect_image_refs(html, url, limit=max_images * 3)

            async def one(ref: dict) -> Optional[dict]:
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

            # Bounded concurrency: 6 at a time keeps a 24-image harvest to a few seconds
            # without hammering the origin.
            sem = asyncio.Semaphore(6)

            async def guarded(ref):
                async with sem:
                    return await one(ref)

            for item in await asyncio.gather(*(guarded(r) for r in refs)):
                if item:
                    results.append(item)
                    if len(results) >= max_images:
                        break
    except Exception as e:
        print("[site_images] harvest failed for %s: %s" % (url, e))
        return []

    return results
