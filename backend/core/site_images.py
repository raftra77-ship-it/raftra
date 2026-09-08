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
    """srcset is "a.jpg 400w, b.jpg 1200w" - take the LAST (largest) candidate."""
    parts = [p.strip().split(" ")[0] for p in (value or "").split(",") if p.strip()]
    return parts[-1] if parts else ""


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


async def harvest(url: str, max_images: int = 24, max_pages: int = 6) -> List[dict]:
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
                    raise SiteUnreachable(
                        "%s returned HTTP %d" % (url, page.status_code))
                html = page.text
            except SiteUnreachable:
                raise
            except Exception as e:
                raise SiteUnreachable("could not load %s (%s)" % (url, e)) from e

            refs = collect_image_refs(html, url, limit=max_images * 3)

            # max_pages was accepted but never used, so a harvest only ever read the
            # landing page. On a store that is the hero banner and little else - the
            # product photography lives on the collection and product pages the homepage
            # links to, which is most of what a brand would expect in its vault.
            if max_pages > 1:
                seen_refs = {r["url"] for r in refs}
                for link in _image_page_links(html, url, max_pages - 1):
                    if len(refs) >= max_images * 3:
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
    except SiteUnreachable:
        # Surfaced to the caller: "we could not read your site" is actionable, and the
        # empty-vault fallback below would report it as "no images big enough".
        raise
    except Exception as e:
        print("[site_images] harvest failed for %s: %s" % (url, e))
        return []

    return results
