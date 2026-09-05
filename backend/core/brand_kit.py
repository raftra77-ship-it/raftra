"""
Deterministic brand-kit extraction: design tokens, logos and typography read out of the
site's own markup and CSS, plus the strict schema the LLM must fill for everything that
is editorial rather than mechanical.

Why the split. Colours, fonts and logo files are *facts the site ships*; guessing at them
with a vision model is slower, costs a call, and is wrong more often than parsing the CSS
the browser itself uses. Positioning, USPs, personas and tone are judgements, and the only
honest source for those is a model reading the copy - but with a schema tight enough that
"found nothing" is representable, so a thin site yields empty fields instead of invented
ones.
"""
import colorsys
import json
import re
from collections import Counter
from typing import List
from urllib.parse import urljoin, urlparse

from pydantic import BaseModel, Field, ValidationError, field_validator

# --------------------------------------------------------------- design tokens

# Font stacks every site declares, which say nothing about the brand.
_GENERIC_FONTS = {
    "inherit", "initial", "unset", "sans-serif", "serif", "monospace", "system-ui",
    "-apple-system", "blinkmacsystemfont", "segoe ui", "helvetica", "helvetica neue",
    "arial", "roboto", "ui-sans-serif", "ui-serif", "ui-monospace", "cursive", "fantasy",
    "emoji", "math", "apple color emoji", "segoe ui emoji", "noto color emoji",
}

# A CSS custom property whose name says what the colour is *for*. These are the closest
# thing a site has to a published token list, so when they exist they beat frequency
# counting - "--color-primary" is a stated role, "#ff6b00 appears 40 times" is a guess.
_TOKEN_DECL_RE = re.compile(
    r"--([a-z0-9-]*(?:color|colour|brand|accent|primary|secondary|bg|background|surface|text|fg)[a-z0-9-]*)"
    r"\s*:\s*(#(?:[0-9a-f]{3}|[0-9a-f]{6})\b|rgba?\([^)]*\))",
    re.I,
)

_HEX_RE = re.compile(r"#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b")


def _norm_hex(value: str) -> str:
    """#abc -> #aabbcc, rgb(255,107,0) -> #ff6b00. Returns "" for anything else."""
    value = (value or "").strip().lower()
    if value.startswith("#"):
        if len(value) == 4:
            return "#" + "".join(ch * 2 for ch in value[1:])
        return value if len(value) == 7 else ""
    m = re.match(r"rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)", value)
    if not m:
        return ""
    try:
        r, g, b = (max(0, min(255, int(float(m.group(i))))) for i in (1, 2, 3))
    except ValueError:
        return ""
    return "#%02x%02x%02x" % (r, g, b)


def is_brand_colour(hex_code: str) -> bool:
    """True for colours with enough saturation to be a choice rather than a neutral."""
    try:
        r, g, b = (int(hex_code[i:i + 2], 16) / 255 for i in (1, 3, 5))
    except (ValueError, IndexError):
        return False
    _, lightness, saturation = colorsys.rgb_to_hls(r, g, b)
    return saturation >= 0.2 and 0.08 <= lightness <= 0.92


def _role_for(token_name: str) -> str:
    """A readable role for a CSS variable name, so the palette can be labelled with what
    the colour is used for rather than its position in a list."""
    n = token_name.lower()
    if any(k in n for k in ("primary", "brand", "accent", "cta")):
        return "Key CTAs & highlights"
    if "secondary" in n:
        return "Secondary surfaces"
    if any(k in n for k in ("bg", "background", "surface")):
        return "Backgrounds & surfaces"
    if any(k in n for k in ("text", "fg", "foreground")):
        return "Body & heading text"
    return "Supporting accents"


def _pretty(token_name: str) -> str:
    """--color-primary-500 -> "Color Primary 500"."""
    return " ".join(p.capitalize() for p in re.split(r"[-_]+", token_name.strip("-")) if p)


def extract_color_tokens(source: str, limit: int = 8) -> List[dict]:
    """Named colour tokens, richest source first.

    1. Declared CSS custom properties - these carry a name and an intended role.
    2. Frequency across the stylesheet, for sites that ship no variables at all.

    Returns [{"name", "hex", "role", "source"}]. Neutrals are dropped from the frequency
    pass but KEPT when the site named them itself: a brand that declares
    `--color-background: #030303` means it, and the creative agents need the surface
    colour as much as the accent.
    """
    out: List[dict] = []
    seen: set = set()

    for name, raw in _TOKEN_DECL_RE.findall(source or ""):
        hex_code = _norm_hex(raw)
        if not hex_code or hex_code in seen:
            continue
        seen.add(hex_code)
        out.append({"name": _pretty(name), "hex": hex_code,
                    "role": _role_for(name), "source": "css-variable"})
        if len(out) >= limit:
            return out

    counts: Counter = Counter()
    for h in _HEX_RE.findall(source or ""):
        h = _norm_hex(h)
        if h and is_brand_colour(h):
            counts[h] += 1

    fallback_names = ["Primary Accent", "Secondary", "Supporting", "Supporting",
                      "Supporting", "Supporting", "Supporting", "Supporting"]
    fallback_roles = ["Key CTAs & highlights", "Secondary surfaces", "Accents", "Accents",
                      "Accents", "Accents", "Accents", "Accents"]
    # A colour used once is usually incidental - a stray icon fill or one inline style.
    for hex_code, n in counts.most_common(limit * 2):
        if n < 2 or hex_code in seen:
            continue
        idx = min(len(out), len(fallback_names) - 1)
        seen.add(hex_code)
        out.append({"name": fallback_names[idx], "hex": hex_code,
                    "role": fallback_roles[idx], "source": "frequency"})
        if len(out) >= limit:
            break

    return out


def extract_typography(source: str) -> dict:
    """Display and body fonts, from Google Fonts links and @font-face first (both are
    explicit choices) and font-family declarations after."""
    named: List[str] = []

    for href in re.findall(r'href="([^"]*fonts\.googleapis\.com[^"]*)"', source or "", re.I):
        for fam in re.findall(r"family=([^&:\"]+)", href):
            named.append(fam.replace("+", " ").split(",")[0].strip())

    # @font-face means the brand paid to ship this face - a strong signal it is theirs.
    for fam in re.findall(r"@font-face\s*\{[^}]*?font-family\s*:\s*['\"]?([^;'\"}]+)",
                          source or "", re.I | re.S):
        named.append(fam.strip())

    for decl in re.findall(r"font-family\s*:\s*([^;}\"']+)", source or "", re.I):
        for part in decl.split(","):
            name = part.strip().strip("'\"")
            if (name and name.lower() not in _GENERIC_FONTS and len(name) < 40
                    and not name.startswith(("var(", "--"))):
                named.append(name)
                break

    ordered, seen = [], set()
    for n in named:
        key = n.lower()
        if key and key not in _GENERIC_FONTS and key not in seen:
            seen.add(key)
            ordered.append(n)

    if not ordered:
        return {}
    out = {"display": ordered[0]}
    if len(ordered) > 1:
        out["body"] = ordered[1]
    return out


# --------------------------------------------------------------- logo extraction

_LOGO_HINT_RE = re.compile(r"logo|brand|wordmark|masthead", re.I)
_IMG_EXT_RE = re.compile(r"\.(svg|png|webp|jpe?g)(\?|$)", re.I)


def _fmt_of(url: str) -> str:
    m = _IMG_EXT_RE.search(url or "")
    return m.group(1).lower().replace("jpeg", "jpg") if m else "unknown"


def extract_logos(html: str, base_url: str, limit: int = 6) -> List[dict]:
    """Logo candidates the page itself points at, best evidence first.

    Ordering matters more than recall: the Brand Kit shows the first one as the primary
    mark, so an <img class="logo"> beats a social card, and a social card beats a favicon.
    Returns [{"type", "url", "format", "variant"}], inline SVGs carrying a "svg" key.
    """
    html = html or ""
    found: List[dict] = []
    seen: set = set()

    def add(kind: str, raw_url: str, variant: str = ""):
        if not raw_url or raw_url.startswith("data:"):
            return
        absolute = urljoin(base_url, raw_url.strip())
        if urlparse(absolute).scheme not in ("http", "https") or absolute in seen:
            return
        seen.add(absolute)
        found.append({"type": kind, "url": absolute,
                      "format": _fmt_of(absolute), "variant": variant})

    # 1) <img> whose class/id/alt/src mentions a logo - how nearly every header marks it up.
    for tag in re.findall(r"<img\b[^>]*>", html, re.I):
        if not _LOGO_HINT_RE.search(tag):
            continue
        src = re.search(r'\bsrc=["\']([^"\']+)["\']', tag, re.I)
        # Lazy-loaded headers put the real file in data-src and a placeholder in src.
        lazy = re.search(r'\bdata-(?:src|original)=["\']([^"\']+)["\']', tag, re.I)
        alt = re.search(r'\balt=["\']([^"\']*)["\']', tag, re.I)
        chosen = lazy or src
        if chosen:
            add("Primary", chosen.group(1), (alt.group(1) if alt else "").strip()[:60])

    # 2) An inline <svg> in a logo-ish wrapper. Kept as markup, not a URL: it has no file
    #    to link to, and vector source is the most useful form of a logo we can hold.
    for m in re.finditer(r"<svg\b[^>]*>.*?</svg>", html, re.I | re.S):
        block = m.group(0)
        # The hint is usually on the wrapping <a class="logo">, not the svg itself, so look
        # at a little of what precedes the tag too.
        context = html[max(0, m.start() - 200):m.start() + 200]
        if _LOGO_HINT_RE.search(context) and len(block) < 20000:
            found.append({"type": "Inline SVG", "url": "", "format": "svg",
                          "variant": "", "svg": block})

    # 3) Open Graph / Twitter image - the picture the brand chose to represent itself.
    for prop in ("og:image", "og:logo", "twitter:image"):
        m = re.search(r'<meta[^>]+(?:property|name)=["\']' + re.escape(prop) +
                      r'["\'][^>]*content=["\']([^"\']+)["\']', html, re.I)
        if m:
            add("Social", m.group(1), prop)

    # 4) Favicons and apple-touch icons - the last resort, but always present.
    for tag in re.findall(r"<link\b[^>]*>", html, re.I):
        rel = re.search(r'\brel=["\']([^"\']+)["\']', tag, re.I)
        if not rel or not re.search(r"\b(icon|apple-touch-icon|mask-icon)\b", rel.group(1), re.I):
            continue
        href = re.search(r'\bhref=["\']([^"\']+)["\']', tag, re.I)
        sizes = re.search(r'\bsizes=["\']([^"\']+)["\']', tag, re.I)
        if href:
            add("Icon", href.group(1), sizes.group(1) if sizes else "")

    return found[:limit]


# ----------------------------------------------------------- structured extraction

class Persona(BaseModel):
    """One audience segment plus the line that would stop them scrolling."""
    persona: str = Field(default="", description="Who they are, e.g. 'MacBook power users'")
    hook: str = Field(default="", description="A one-line ad hook aimed at this persona")


class BrandKit(BaseModel):
    """What an LLM may state about a brand after reading its site.

    Every field defaults to empty. That is the point: the model is told to leave a field
    blank when the content does not support it, and a schema that *requires* a mission
    statement guarantees a fabricated one on the many sites that never publish theirs.
    """
    overview: str = Field(default="", description="What the brand is and its story, 2-4 sentences")
    mission: str = Field(default="", description="Mission or slogan, only if the site states one")
    positioning: str = Field(default="", description="How it positions in its category, 1-2 sentences")
    business_model: str = Field(default="", description="e.g. D2C ecommerce, B2B SaaS, marketplace")
    product_categories: List[str] = Field(default_factory=list)
    usps: List[str] = Field(default_factory=list, description="Concrete differentiators")
    benefits: List[str] = Field(default_factory=list, description="Customer-facing benefits")
    personality: List[str] = Field(default_factory=list, description="Adjectives, e.g. modern, direct")
    tone_of_voice: List[str] = Field(default_factory=list)
    audience_summary: str = Field(default="", description="Who this brand sells to, one sentence")
    target_audiences: List[Persona] = Field(default_factory=list)
    key_messages: List[str] = Field(default_factory=list)

    @field_validator("product_categories", "usps", "benefits", "personality",
                     "tone_of_voice", "key_messages", mode="before")
    @classmethod
    def _clean_list(cls, v):
        """Models return a comma-joined string about as often as a list; accept both and
        drop blanks, so one formatting choice does not lose a whole field."""
        if isinstance(v, str):
            v = re.split(r"[;\n,]", v)
        if not isinstance(v, list):
            return []
        return [str(x).strip() for x in v if str(x if x is not None else "").strip()][:12]

    @field_validator("target_audiences", mode="before")
    @classmethod
    def _clean_personas(cls, v):
        if isinstance(v, list):
            return [x for x in v
                    if isinstance(x, dict) and str(x.get("persona") or "").strip()][:6]
        return []


EXTRACTION_PROMPT = """You are a brand strategist reading a company's own website.

Return ONLY a JSON object with exactly these keys, no code fence, no commentary:
{
  "overview": "", "mission": "", "positioning": "", "business_model": "",
  "product_categories": [], "usps": [], "benefits": [], "personality": [],
  "tone_of_voice": [], "audience_summary": "", "target_audiences": [{"persona": "", "hook": ""}],
  "key_messages": []
}

Rules:
- Ground every field in the content below. Reading what a brand sells and how it talks is
  inference and is welcome; inventing facts it never states is not.
- "mission" only if the site actually publishes a mission or slogan. Otherwise "".
- "usps" must be concrete and checkable (a certification, a warranty length, a technology),
  never generic praise like "great quality".
- "target_audiences": up to 4 segments. Each "hook" is one line you could run as an ad.
- Leave any field empty ("" or []) when the content does not support it. An empty field is
  a correct answer; a plausible guess is not.

WEBSITE CONTENT:
"""


def _loads_lenient(text: str):
    """json.loads, then a few repairs for the ways an LLM reliably breaks JSON.

    Worth the code because the failure is not rare and the cost is a whole extraction. The
    vision prompt in particular produces longer prose per field, and a positioning
    statement containing an inch mark or a quoted slogan lands as an unescaped quote
    mid-string. Repairs are ordered cheapest-first and each is retried independently, so a
    response with one flaw is never discarded for want of one character.
    """
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 1) Trailing commas before a closing brace/bracket.
    candidate = re.sub(r",(\s*[}\]])", r"\1", text)
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        pass

    # 2) Literal newlines and tabs inside string values, which JSON forbids.
    def _escape_inner(match):
        return '"' + match.group(1).replace("\n", "\\n").replace("\t", "\\t") + '"'
    candidate2 = re.sub(r'"((?:[^"\\]|\\.)*?)"', _escape_inner, candidate, flags=re.S)
    try:
        return json.loads(candidate2)
    except json.JSONDecodeError:
        pass

    # 3) A stray unescaped quote inside a value: escape any quote that is not adjacent to
    #    JSON structure (a colon, comma, brace or bracket).
    candidate3 = re.sub(r'(?<![:,{\[\s])"(?![\s]*[:,}\]])', r'\\"', candidate)
    return json.loads(candidate3)   # raises if still unparseable - caller handles it


def parse_brand_kit(raw: str) -> BrandKit:
    """Validate a model response into a BrandKit.

    Raises ValueError when there is no usable JSON, so the caller can decide whether to
    retry or record the failure - silently returning an empty kit would look identical to
    a site with nothing to say.
    """
    blob = re.search(r"\{.*\}", raw or "", re.S)
    if not blob:
        raise ValueError("model returned no JSON object")
    try:
        data = _loads_lenient(blob.group(0))
    except json.JSONDecodeError as e:
        raise ValueError("model returned malformed JSON: %s" % e) from e
    try:
        return BrandKit.model_validate(data)
    except ValidationError as e:
        raise ValueError("model response did not match the brand-kit schema: %s" % e) from e


async def extract_brand_kit(llm, content: str) -> BrandKit:
    """Run the structured extraction. `llm` is any provider exposing `generate_text`."""
    raw = await llm.generate_text(
        EXTRACTION_PROMPT + (content or "")[:12000],
        system_prompt="You are a precise brand strategist. You output JSON only.")
    return parse_brand_kit(raw)


def kit_to_guidelines(kit: BrandKit) -> dict:
    """Map a BrandKit onto the guidelines JSON the Brand Knowledge screen reads.

    Section ids ("overview", "usps", "features", ...) are the UI's, and prose sections are
    joined into text because that is what those panels render. Only non-empty fields are
    returned: the caller merges this over existing guidelines, and a blank must never
    overwrite something a user wrote by hand.
    """
    out: dict = {}

    def put(key: str, value):
        if isinstance(value, str) and value.strip():
            out[key] = value.strip()
        elif isinstance(value, list) and value:
            out[key] = value

    put("overview", kit.overview)
    put("slogan", kit.mission)
    put("competitive", kit.positioning)
    put("business_model", kit.business_model)
    put("categories", kit.product_categories)
    put("usps", "\n".join("- " + u for u in kit.usps))
    put("features", "\n".join("- " + b for b in kit.benefits))
    put("personality", ", ".join(kit.personality))
    put("tone", ", ".join(kit.tone_of_voice))
    put("tone_of_voice", kit.tone_of_voice)
    put("key_messages", kit.key_messages)
    if kit.target_audiences:
        out["target_audiences"] = [p.model_dump() for p in kit.target_audiences]
    return out


# ------------------------------------------------------- hero image colour clustering

# Why this exists alongside extract_color_tokens(). That function reads colours the site
# *declares* in CSS, which is the right source for a CTA colour or a surface token. But a
# brand's most recognisable colour is often only present as pixels - the orange of a product
# render, the teal of a hero photograph's grade - and never appears as a hex in any
# stylesheet. Reading the shipped CSS alone cannot see those, so this clusters the actual
# pixels of the images the brand chose to lead with.

_HERO_IMG_ATTR_RE = re.compile(
    r"<img\b[^>]*?\b(?:src|data-src|data-original)=[\"']([^\"']+)[\"'][^>]*>", re.I)
_CSS_BG_URL_RE = re.compile(r"background(?:-image)?\s*:[^;}]*url\(\s*[\"']?([^\"')]+)", re.I)

# Files that are never the hero: icons, sprites, logos, tracking pixels, payment badges.
_NON_HERO_RE = re.compile(
    r"(sprite|icon|favicon|logo|badge|pixel|tracking|placeholder|loader|spinner|avatar|"
    r"payment|visa|mastercard|paypal|amex|1x1|blank)", re.I)


def extract_hero_images(html: str, base_url: str, limit: int = 4) -> List[str]:
    """URLs of the images a page leads with, best candidates first.

    Ordered by how deliberately the brand chose the image: og:image is what they picked to
    represent the page anywhere it is shared, then the first few in-body images (a hero sits
    near the top of the document), then CSS background images.
    """
    html = html or ""
    out: List[str] = []
    seen: set = set()

    def add(raw: str):
        if not raw or raw.startswith("data:") or _NON_HERO_RE.search(raw):
            return
        absolute = urljoin(base_url, raw.strip())
        if urlparse(absolute).scheme not in ("http", "https") or absolute in seen:
            return
        if not _IMG_EXT_RE.search(absolute) and "?" not in absolute:
            return          # not obviously an image and no query string to excuse it
        seen.add(absolute)
        out.append(absolute)

    m = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\']',
                  html, re.I)
    if m:
        add(m.group(1))

    # Only the first ~40 <img> tags: a hero is at the top, and scanning a 400-product
    # listing page would pick up thumbnails instead.
    for tag_match in list(_HERO_IMG_ATTR_RE.finditer(html))[:40]:
        add(tag_match.group(1))
        if len(out) >= limit * 3:
            break

    for bg in _CSS_BG_URL_RE.findall(html)[:20]:
        add(bg)

    return out[:limit]


def _significant_pixels(arr):
    """Drop pixels that carry no brand information: near-white, near-black and near-grey.

    Without this the answer for almost every site is "white, off-white, light grey" - the
    page background dominates the pixel count and the actual brand colour is a rounding
    error. Returns None when too little colour survives to cluster.
    """
    import numpy as np

    rgb = arr.astype("float32") / 255.0
    mx = rgb.max(axis=1)
    mn = rgb.min(axis=1)
    lightness = (mx + mn) / 2.0
    delta = mx - mn
    # HSL saturation, guarding the division where lightness is 0 or 1.
    denom = 1.0 - np.abs(2.0 * lightness - 1.0)
    saturation = np.divide(delta, denom, out=np.zeros_like(delta), where=denom > 1e-6)

    keep = (saturation >= 0.18) & (lightness >= 0.08) & (lightness <= 0.92)
    kept = arr[keep]
    return kept if len(kept) >= 40 else None


def kmeans_palette(image_bytes: bytes, k: int = 4) -> List[dict]:
    """Dominant brand colours in one image, by k-means over its saturated pixels.

    Returns [{"hex", "share"}] ordered by cluster size, where share is the fraction of
    colour-carrying pixels in that cluster. Returns [] for anything that is not a usable
    image or that has no real colour in it - a greyscale product shot on white is a
    legitimate "no brand colour here", not an error.
    """
    import io
    import numpy as np
    from PIL import Image

    try:
        img = Image.open(io.BytesIO(image_bytes))
        # Via RGBA first: a palette PNG with byte-wise transparency warns (and composites
        # oddly) on a direct convert("RGB"), which silently tints the clusters.
        if img.mode in ("P", "LA", "PA"):
            img = img.convert("RGBA")
        if img.mode == "RGBA":
            from PIL import Image as _Im
            flat = _Im.new("RGB", img.size, (255, 255, 255))
            flat.paste(img, mask=img.split()[-1])
            img = flat
        img = img.convert("RGB")
        # Thumbnail first: clustering a 4000px hero costs seconds and changes nothing, the
        # dominant colours of a downsample are the dominant colours of the original.
        img.thumbnail((200, 200))
        arr = np.asarray(img).reshape(-1, 3)
    except Exception as e:
        print("[brand_kit] could not decode image for clustering: %s" % e)
        return []

    pixels = _significant_pixels(arr)
    if pixels is None:
        return []

    try:
        from sklearn.cluster import KMeans
        n = min(k, len(pixels))
        km = KMeans(n_clusters=n, n_init=4, random_state=0).fit(pixels)
        labels, centers = km.labels_, km.cluster_centers_
    except Exception as e:
        print("[brand_kit] k-means failed: %s" % e)
        return []

    total = len(labels)
    out = []
    for idx, center in enumerate(centers):
        share = float((labels == idx).sum()) / total
        r, g, b = (int(max(0, min(255, round(v)))) for v in center)
        hex_code = "#%02x%02x%02x" % (r, g, b)
        if is_brand_colour(hex_code):
            out.append({"hex": hex_code, "share": round(share, 3)})

    out.sort(key=lambda c: c["share"], reverse=True)
    return out


# Two colours closer than this in RGB are the same brand colour seen under different
# lighting. Tested against real storefronts: Ambrane's hero images yield #ff5105, #ff2f00
# and #ff7943 across three shots, which is one orange, not three. 60 merges those while
# still separating an orange from a red.
_MERGE_DISTANCE = 60.0

# A cluster smaller than this is a highlight, a shadow edge, or JPEG noise - not a brand
# colour. Without it the palette fills up with entries rendered as "0% of colour pixels".
_MIN_CLUSTER_SHARE = 0.08


def _rgb(hex_code: str):
    return tuple(int(hex_code[i:i + 2], 16) for i in (1, 3, 5))


def _distance(a: str, b: str) -> float:
    ra, ga, ba = _rgb(a)
    rb, gb, bb = _rgb(b)
    return ((ra - rb) ** 2 + (ga - gb) ** 2 + (ba - bb) ** 2) ** 0.5


async def hero_color_tokens(client, html: str, base_url: str, max_images: int = 3,
                            per_image: int = 3, limit: int = 4) -> List[dict]:
    """Brand colours clustered out of the page's hero imagery.

    Clusters are pooled across every hero image and merged by perceptual distance, then
    ranked by total share. That pooling is the point: a colour that shows up in three
    separate hero shots is far more likely to be the brand's than one that dominates a
    single photograph, and per-image ranking cannot express that.

    Shaped like extract_color_tokens() output so the two merge, and tagged
    source="image-kmeans" so the UI can say where a colour came from - a hex read from a
    declared CSS variable and one averaged out of a photograph deserve different trust.
    Never raises: a slow CDN degrades the palette, it does not fail onboarding.
    """
    urls = extract_hero_images(html, base_url, limit=max_images)
    if not urls:
        return []

    # Each entry: {"hex", "share" (summed), "images" (how many shots it appeared in)}
    pooled: List[dict] = []

    for url in urls:
        try:
            r = await client.get(url, timeout=20)
            if r.status_code != 200:
                continue
            ctype = (r.headers.get("content-type") or "").lower()
            if "image" not in ctype and not _IMG_EXT_RE.search(url):
                continue
            # 12MB ceiling: past that it is a print asset or a mislabelled video, and
            # decoding it is not worth the memory.
            if len(r.content) > 12 * 1024 * 1024:
                continue

            for colour in kmeans_palette(r.content, k=per_image + 1):
                if colour["share"] < _MIN_CLUSTER_SHARE:
                    continue
                match = next((p for p in pooled
                              if _distance(p["hex"], colour["hex"]) < _MERGE_DISTANCE), None)
                if match:
                    # Keep whichever spelling carried the larger share - that one is closer
                    # to the colour as the brand actually uses it.
                    if colour["share"] > match["peak"]:
                        match["hex"], match["peak"] = colour["hex"], colour["share"]
                    match["share"] += colour["share"]
                    match["images"] += 1
                else:
                    pooled.append({"hex": colour["hex"], "share": colour["share"],
                                   "peak": colour["share"], "images": 1})
        except Exception as e:
            print("[brand_kit] hero image %s failed: %s" % (url, e))
            continue

    # Ranking. The obvious rule - "appeared in the most hero images" - is wrong, and
    # measurably so: on ambraneindia.com it ranked two muted olive product-photo tones
    # (#292d1b, #524d33, seen in two shots each) above #ff5105, the orange that is 99% of
    # the banner and is plainly the brand's colour.
    #
    # What separates a brand accent from photographic scenery is vividness. Measured as
    # CHROMA (max channel - min channel), not HLS saturation: HLS inflates saturation at
    # extreme lightness, which on portronics.com ranked a pale peach background (#f8d49f)
    # above the brand's teal (#57d6d9). Chroma scores the teal higher, as the eye does.
    def _score(p: dict) -> float:
        r, g, b = (v / 255.0 for v in _rgb(p["hex"]))
        chroma = max(r, g, b) - min(r, g, b)
        return p["peak"] * (0.3 + chroma) * (1.0 + 0.15 * (p["images"] - 1))

    pooled.sort(key=_score, reverse=True)

    out = []
    for idx, p in enumerate(pooled[:limit]):
        seen_in = ("in %d hero images" % p["images"]) if p["images"] > 1 else "in the hero image"
        out.append({
            "name": "Imagery Accent" if idx == 0 else "Imagery %d" % (idx + 1),
            "hex": p["hex"],
            "role": "Dominant %s (%d%% of colour pixels)" % (seen_in, round(p["peak"] * 100)),
            "source": "image-kmeans",
        })
    return out


# ------------------------------------------------------------ vision-assisted extraction

# What a screenshot adds over the copy. The text pass can read what a brand *says*; it
# cannot see how the brand presents itself - whether the design reads premium or budget,
# playful or clinical, dense or airy. Those are exactly the judgements that drive a
# creative brief, and they are visible in one screenshot and invisible in the markup.
_VISION_SUFFIX = """

You are ALSO given a screenshot of the brand's homepage as rendered in a browser.

Use it for the judgements the copy cannot support:
- "personality" and "tone_of_voice": let the visual design inform these - density, colour,
  photography style, how much white space, how loud the offers are.
- "positioning": whether the presentation reads premium, mid-market or value.
- "product_categories": include anything clearly pictured that the text did not name.

Do NOT let the screenshot override facts. A price, a warranty length or a certification
comes from the text only. If the image and the copy disagree on a fact, trust the copy.
Return the SAME JSON object described above and nothing else.
"""


async def extract_brand_kit_with_vision(llm, content: str, screenshot: bytes) -> BrandKit:
    """Structured extraction that also looks at the rendered page.

    Falls back to the text-only path whenever there is no screenshot or the provider has no
    vision method, so a caller can always use this and let the capability decide - that is
    what keeps onboarding working identically on a deployment without Playwright.
    """
    if not screenshot or not hasattr(llm, "generate_with_image"):
        return await extract_brand_kit(llm, content)

    try:
        raw = await llm.generate_with_image(
            EXTRACTION_PROMPT + (content or "")[:12000] + _VISION_SUFFIX,
            image_bytes=screenshot,
            mime_type="image/jpeg",
            system_prompt="You are a precise brand strategist. You output JSON only.")
        return parse_brand_kit(raw)
    except ValueError as e:
        # The vision pass answered but not in the agreed shape. Fall back to the text-only
        # extraction rather than surfacing the error: vision is an ENRICHMENT, so its
        # failure must never leave the caller worse off than not having asked for it. This
        # is not theoretical - the longer prose vision produces per field is exactly what
        # trips JSON escaping, and it was the first thing that happened when this was
        # tested against a real storefront.
        print("[brand_kit] vision extraction unusable (%s); using the text-only pass." % e)
        return await extract_brand_kit(llm, content)
