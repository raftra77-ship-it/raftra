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


# Framework boilerplate that is not anybody's logo.
#
# extract_logos falls back to the favicon when a site marks up no logo of its own, which is
# the right order of preference — but a scaffolded app ships with its FRAMEWORK's icon at
# that path. A real workspace here had brand_logo set to dsahelper.onrender.com/vite.svg:
# the Brand Kit displayed Vite's lightning bolt as the company's mark, the creative pipeline
# had it available as brand identity, and nothing anywhere said it was a placeholder.
#
# Matched on the filename only, so a brand that genuinely ships "logo.svg" is unaffected, and
# favicon.ico is deliberately absent — that one is usually a real (if small) brand mark.
_BOILERPLATE_ICONS = {
    "vite.svg", "react.svg", "vite.png",           # Vite / Vite-React templates
    "next.svg", "vercel.svg", "turbo.svg",         # Next.js / Vercel scaffolds
    "logo192.png", "logo512.png",                  # create-react-app
    "nuxt.svg", "svelte.svg", "angular.svg",       # other framework defaults
    "placeholder.svg", "placeholder.png",
}


def is_boilerplate_icon(url: str) -> bool:
    """Is this URL a framework's default icon rather than a brand asset?"""
    from urllib.parse import urlparse as _u
    name = (_u(url or "").path or "").rsplit("/", 1)[-1].strip().lower()
    return name in _BOILERPLATE_ICONS


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
        # Never offer a framework's own icon as the brand's logo. Returning nothing is the
        # honest answer — the Brand Kit can then say no logo was found and invite an upload,
        # instead of showing Vite's bolt and calling it the company mark.
        if is_boilerplate_icon(absolute):
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

NOT_AVAILABLE = "Not clearly available from the provided sources."

# Keys inside the guidelines JSON that are bookkeeping rather than brand knowledge. Both are
# underscore-prefixed so they cannot collide with a section id, and every reader that
# iterates guidelines should skip them.
USER_EDITED_KEY = "_user_edited"        # list[str]: sections a person corrected by hand
EXTRACTION_META_KEY = "_extraction"     # dict: when/where/how this knowledge was produced

# Bumped when the extraction PROMPT changes in a way that alters output shape or quality,
# so a brand extracted under older rules is identifiable and can be re-run deliberately.
EXTRACTION_VERSION = 2
# Bumped when the BrandKit schema gains or changes fields.
BRAND_KIT_SCHEMA_VERSION = 2


class Evidence(BaseModel):
    """Where a claim came from, and how far to trust it.

    The crawl already labels every page it hands the model with a `[url]` header, so the
    model can cite the page a claim came from - it was simply never asked to. Without this
    the vault presented a model's inference about positioning in exactly the same visual
    weight as a warranty length printed on the site, and nothing downstream could tell a
    safe claim from a guess.
    """
    source_url: str = Field(default="", description="The [url] header of the page this came from")
    snippet: str = Field(default="", description="Short quote from the source supporting this")
    confidence: str = Field(default="medium", description="high | medium | low")
    basis: str = Field(default="stated", description="'stated' if the site says it, 'inferred' if you concluded it")

    @field_validator("confidence", mode="before")
    @classmethod
    def _conf(cls, v):
        v = str(v or "medium").strip().lower()
        return v if v in ("high", "medium", "low") else "medium"

    @field_validator("basis", mode="before")
    @classmethod
    def _basis(cls, v):
        v = str(v or "stated").strip().lower()
        return "inferred" if v.startswith("infer") else "stated"


class USP(BaseModel):
    """A differentiator that answers: what is different, why it matters, who cares.

    A bare string list produced "High quality products" and there was no structural reason
    it could not. Forcing feature/benefit/audience separately makes a generic answer
    obviously empty rather than merely vague.
    """
    name: str = Field(default="", description="The differentiator's own name, e.g. 'Dri-FIT ADV'")
    feature: str = Field(default="", description="What it technically is")
    benefit: str = Field(default="", description="What the customer gets, in their terms")
    audience: str = Field(default="", description="Who specifically cares about this")
    messaging_angle: str = Field(default="", description="How to lead with it in an ad")
    evidence: Evidence = Field(default_factory=Evidence)


class ProductCategory(BaseModel):
    """A category, and why it matters to a customer - not just its name."""
    name: str = Field(default="")
    products: List[str] = Field(default_factory=list, description="Named products in this category")
    features: List[str] = Field(default_factory=list)
    benefit: str = Field(default="", description="The outcome the customer gets")
    technologies: List[str] = Field(default_factory=list, description="Named tech or materials")
    use_case: str = Field(default="", description="The situation it is bought for")
    audience: str = Field(default="", description="Which persona this serves")
    price_range: str = Field(default="", description="Only if the site shows prices")
    evidence: Evidence = Field(default_factory=Evidence)


class JobToBeDone(BaseModel):
    """Situation -> problem -> desired outcome -> what the brand offers for it."""
    situation: str = Field(default="")
    problem: str = Field(default="")
    desired_outcome: str = Field(default="")
    brand_response: str = Field(default="", description="The product/technology that answers it")
    evidence: Evidence = Field(default_factory=Evidence)


class VoiceTrait(BaseModel):
    """A voice characteristic made actionable: what it sounds like, and what it is not."""
    trait: str = Field(default="")
    sounds_like: str = Field(default="", description="How it reads in a sentence")
    example: str = Field(default="", description="One line written in this voice")
    avoid: str = Field(default="", description="The failure mode of this trait")


class VoiceGuide(BaseModel):
    """Everything a copy agent needs to write in this brand's voice without guessing."""
    traits: List[VoiceTrait] = Field(default_factory=list)
    formality: str = Field(default="", description="e.g. 'informal but not slangy'")
    energy: str = Field(default="", description="e.g. 'high, imperative'")
    sentence_style: str = Field(default="", description="e.g. 'short, verb-first'")
    vocabulary: str = Field(default="", description="Register and the terminology it prefers")
    use_words: List[str] = Field(default_factory=list, description="Terms the brand actually uses")
    avoid_words: List[str] = Field(default_factory=list, description="Terms that would read wrong")
    cta_style: str = Field(default="", description="How its calls to action are phrased")
    dos: List[str] = Field(default_factory=list)
    donts: List[str] = Field(default_factory=list)


class SupportingMessage(BaseModel):
    message: str = Field(default="")
    proof_points: List[str] = Field(default_factory=list, description="Products/features that back it")


class Messaging(BaseModel):
    """The messaging framework, so agents stop re-deriving it per campaign."""
    core_message: str = Field(default="", description="The one thing the brand wants believed")
    supporting: List[SupportingMessage] = Field(default_factory=list)
    emotional_benefits: List[str] = Field(default_factory=list, description="How the customer should feel")
    functional_benefits: List[str] = Field(default_factory=list, description="What they practically get")
    angles: List[str] = Field(default_factory=list, description="Different ways to land the same value")


class BrandStory(BaseModel):
    """Only what the site actually publishes. A fabricated origin story is worse than none."""
    founding: str = Field(default="")
    mission: str = Field(default="")
    vision: str = Field(default="")
    philosophy: str = Field(default="")
    milestones: List[str] = Field(default_factory=list)
    beliefs: List[str] = Field(default_factory=list)


class PositioningSignals(BaseModel):
    """Axes rather than invented competitors. Marked inferred unless the site states it."""
    price_tier: str = Field(default="", description="premium | mid | value")
    orientation: str = Field(default="", description="performance | lifestyle | both")
    innovation: str = Field(default="", description="innovation-led | heritage-led")
    reach: str = Field(default="", description="mass market | niche")
    appeal: str = Field(default="", description="functional | emotional | both")
    basis: str = Field(default="inferred", description="'stated' or 'inferred'")


class Persona(BaseModel):
    """One audience segment, deep enough to brief a campaign from.

    Was {persona, hook}. Two strings cannot answer "what objection does this segment have"
    or "which products serve them", so every agent that needed those re-invented them per
    task, inconsistently. Behaviour and need define a segment here, not demographics: the
    site rarely states age or gender, and inventing them is the exact failure this schema
    exists to prevent.
    """
    persona: str = Field(default="", description="Named by need or behaviour, not demographics")
    need: str = Field(default="", description="The core need that defines this segment")
    pain_points: List[str] = Field(default_factory=list)
    goals: List[str] = Field(default_factory=list)
    buying_motivation: str = Field(default="", description="What actually triggers the purchase")
    categories: List[str] = Field(default_factory=list, description="Product categories they buy")
    objections: List[str] = Field(default_factory=list, description="Why they might not buy")
    decision_factors: List[str] = Field(default_factory=list, description="What they compare on")
    desired_outcome: str = Field(default="")
    messaging_angle: str = Field(default="", description="The angle that lands with them")
    hook: str = Field(default="", description="A one-line ad hook aimed at this persona")
    evidence: Evidence = Field(default_factory=Evidence)


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
    # The Brand Guidelines screen has always rendered a "Visual Design & Brand Identity"
    # section, but nothing ever produced its content, so it was blank for every brand.
    # The vision-enabled extractor sees a screenshot, and even the text-only one can read a
    # site's design language from its copy and structure.
    visual_identity: str = Field(default="", description="The site's visual/design language and what it signals")
    product_categories: List[str] = Field(default_factory=list)
    usps: List[str] = Field(default_factory=list, description="Concrete differentiators")
    benefits: List[str] = Field(default_factory=list, description="Customer-facing benefits")
    personality: List[str] = Field(default_factory=list, description="Adjectives, e.g. modern, direct")
    tone_of_voice: List[str] = Field(default_factory=list)
    audience_summary: str = Field(default="", description="Who this brand sells to, one sentence")
    target_audiences: List[Persona] = Field(default_factory=list)
    key_messages: List[str] = Field(default_factory=list)
    # The Brand Knowledge Vault has always rendered a "Markets" section ("Where the brand
    # sells"), but no field produced it and kit_to_guidelines never wrote the key — so that
    # panel was empty for every brand and a re-sync could never fill it. Same failure the
    # visual_identity field above was added to fix.
    #
    # Deliberately "only if the site states it": shipping destinations, a country selector
    # or an address are evidence; a .in domain is not, and guessing a market wrong is worse
    # than leaving the section blank for someone to type.
    markets: str = Field(
        default="",
        description="Countries or regions the brand sells to, only if the site states them "
                    "(shipping/delivery pages, a country or currency selector, a stated address). "
                    "Leave blank if the site does not say.")

    # ---------------------------------------------------------------- structured layer
    # Everything above is the original flat schema and is deliberately untouched: existing
    # rows, the guidelines JSON and every downstream reader still work exactly as before.
    # The fields below are additive and all default to empty, so a model that ignores them
    # (or an older stored kit) degrades to precisely the previous behaviour.
    # The brand's own name, read from its content.
    #
    # Nothing extracted this before: the workspace name came from onboarding (typed once) or
    # from the domain, and neither is corrected when the site changes. A workspace re-pointed
    # at a new site therefore kept the previous brand's name while every other field was
    # rebuilt - the site said one brand, the name said another, and that name is what reaches
    # agents and image generation. Read from the page (masthead, title, copyright, "about"),
    # never from the domain, which is a guess rather than a statement.
    brand_name: str = Field(
        default="",
        description="The brand's own name exactly as the site writes it. Only if the content "
                    "states it; do not infer it from the domain.")
    industry: str = Field(default="", description="The category the brand competes in")
    value_proposition: str = Field(default="", description="One sentence: what it offers and to whom")
    structured_usps: List[USP] = Field(default_factory=list)
    catalogue: List[ProductCategory] = Field(default_factory=list)
    jobs_to_be_done: List[JobToBeDone] = Field(default_factory=list)
    voice: VoiceGuide = Field(default_factory=VoiceGuide)
    messaging: Messaging = Field(default_factory=Messaging)
    story: BrandStory = Field(default_factory=BrandStory)
    positioning_signals: PositioningSignals = Field(default_factory=PositioningSignals)
    # Facts a marketing agent must not get wrong, and which sites do publish.
    verified_claims: List[str] = Field(
        default_factory=list,
        description="Claims the site states outright and that an ad could safely repeat "
                    "(certifications, warranty terms, shipping/returns terms, partnerships)")
    unsupported_topics: List[str] = Field(
        default_factory=list,
        description="Things an ad must NOT claim because the site never establishes them")

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


EXTRACTION_PROMPT = """You are a brand strategist building a brand intelligence brief that
other AI agents will use to write ads, plan campaigns and answer questions about this brand.
They cannot see the website. Everything they know comes from what you return.

Each page below is preceded by its URL in square brackets, like [https://example.com/tech].
Cite those URLs in the "evidence" objects.

Return ONLY a JSON object with exactly these keys, no code fence, no commentary:
{
  "brand_name": "",
  "overview": "", "mission": "", "positioning": "", "business_model": "",
  "visual_identity": "", "industry": "", "value_proposition": "",
  "product_categories": [], "usps": [], "benefits": [], "personality": [],
  "tone_of_voice": [], "audience_summary": "", "key_messages": [], "markets": "",

  "structured_usps": [
    {"name": "", "feature": "", "benefit": "", "audience": "", "messaging_angle": "",
     "evidence": {"source_url": "", "snippet": "", "confidence": "high|medium|low",
                  "basis": "stated|inferred"}}
  ],
  "catalogue": [
    {"name": "", "products": [], "features": [], "benefit": "", "technologies": [],
     "use_case": "", "audience": "", "price_range": "",
     "evidence": {"source_url": "", "snippet": "", "confidence": "", "basis": ""}}
  ],
  "target_audiences": [
    {"persona": "", "need": "", "pain_points": [], "goals": [], "buying_motivation": "",
     "categories": [], "objections": [], "decision_factors": [], "desired_outcome": "",
     "messaging_angle": "", "hook": "",
     "evidence": {"source_url": "", "snippet": "", "confidence": "", "basis": ""}}
  ],
  "jobs_to_be_done": [
    {"situation": "", "problem": "", "desired_outcome": "", "brand_response": "",
     "evidence": {"source_url": "", "snippet": "", "confidence": "", "basis": ""}}
  ],
  "voice": {
    "traits": [{"trait": "", "sounds_like": "", "example": "", "avoid": ""}],
    "formality": "", "energy": "", "sentence_style": "", "vocabulary": "",
    "use_words": [], "avoid_words": [], "cta_style": "", "dos": [], "donts": []
  },
  "messaging": {
    "core_message": "",
    "supporting": [{"message": "", "proof_points": []}],
    "emotional_benefits": [], "functional_benefits": [], "angles": []
  },
  "story": {"founding": "", "mission": "", "vision": "", "philosophy": "",
            "milestones": [], "beliefs": []},
  "positioning_signals": {"price_tier": "", "orientation": "", "innovation": "",
                          "reach": "", "appeal": "", "basis": "stated|inferred"},
  "verified_claims": [],
  "unsupported_topics": []
}

THE RULE THAT OVERRIDES EVERY OTHER RULE:
Never invent. An empty field is a correct answer. A plausible-sounding guess is a defect,
because an agent will repeat it to customers as though the brand said it.

Separate what you SAW from what you CONCLUDED:
- basis "stated"   - the page says this. Quote it in "snippet".
- basis "inferred" - you concluded it from what the page says. Still cite the page that
  led you there, and set confidence honestly.
Positioning, personality, tone, personas and jobs_to_be_done are almost always "inferred".
Products, technologies, materials, prices, shipping, returns, warranty, certifications and
partnerships must be "stated" or omitted entirely.

SPECIFICITY:
Use the brand's own vocabulary. If the site names a technology, a material, a collection
or a product line, name it. A brief that would read identically for a competitor is a
failed brief. "High quality products" and "innovative solutions" are failures.

COVERAGE - these are the fields that carry the most weight downstream, and the ones most
often returned empty. Work through the pages you were given and fill each one that the
content supports. An empty field is correct ONLY when the content genuinely does not
support it; it is not a shortcut.
- "brand_name": read it off the page - the masthead, the <title>, a copyright line, the
  "about" copy. NEVER derive it from the domain name.
- "catalogue": go through every page that lists or describes what the brand sells. One
  entry per meaningful category, and fill "products" with the ACTUAL product names printed
  on those pages, not descriptions of them. A category with an empty "products" list on a
  site that names its products is an incomplete answer.
- "technologies" inside each catalogue entry: the named technologies, materials, fabrics,
  components or processes the brand has given its own name to. These are usually
  capitalised or trademarked on the page. Copy the name exactly.
- "verified_claims": read the commerce and policy pages you were given - returns, exchange,
  warranty, shipping, delivery, care, certification, partnership. Those pages state precise,
  checkable terms, and those terms are the claims an ad may safely repeat. Quote the
  specifics (a window, a duration, a threshold, a certification name), not a paraphrase.
- "voice": derive the traits from how the site's own headlines and product copy are
  actually written. Quote a real line from the site in "example" where one fits.

Field notes:
- "overview": 3-5 sentences. What it sells, who for, what makes it different, market, and
  anything stated about origin or scale. Every other agent reads this first.
- "value_proposition": one sentence a stranger could repeat back.
- "structured_usps": 4-8. Each must survive: what is different -> why does it matter ->
  who cares. If you cannot fill feature AND benefit AND audience, drop the entry.
- "catalogue": one entry per meaningful category, with real product names where given.
  Explain why the category matters to a customer; a bare list of names is not enough.
- "target_audiences": 3-5 segments defined by NEED or BEHAVIOUR, never by demographics.
  "Runners training for distance who need cushioning that lasts" - not "men 18-34". If
  the site does not support age or gender, do not state them. "objections" is why this
  person might NOT buy; it is the most useful and most often skipped field.
- "jobs_to_be_done": only where a product genuinely answers a situation the site describes.
- "voice.traits": 3-5. "example" must be a line you wrote in that voice, not a description
  of it. "avoid" is that trait's failure mode.
- "messaging.supporting": each message needs proof_points naming real products or features.
- "verified_claims": things the site states outright that an ad could safely repeat -
  certifications, warranty terms, shipping/returns terms, named partnerships.
- "unsupported_topics": things an ad must NOT claim because this crawl never establishes
  them (e.g. "cheapest", "clinically proven", a sustainability claim the site never makes).
  This protects the brand; be willing to fill it.
- "benefits": the outcome the customer gets ("stays dry through a long run"), not the
  feature that delivers it ("Dri-FIT fabric"). Features belong in usps.
- "markets": only where the site says it sells - a shipping page, a country or currency
  selector, a stated address. A domain suffix is not evidence.
- "mission"/"story": only if the site publishes them. Do not write an origin story.
- "visual_identity": layout, imagery, density, colour and type, and what it signals.

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


# Upper bound on the site text handed to the extractor. Must stay >=
# onboarding_graph._SYNTHESIS_CHARS (_MAX_KB_PAGES * _PER_PAGE_CHARS + 1000), or the last
# pages the crawler paid to fetch are discarded here instead - the exact bug this constant
# was introduced to remove. Kept as a literal rather than imported to avoid a circular
# import; test_extraction_budgets.py asserts the two stay in step.
# At 12 pages x 3000 chars that is ~37k characters, roughly 10k tokens, which is
# unremarkable for the flash model doing the extraction.
_EXTRACTION_CHARS = 40000


async def extract_brand_kit(llm, content: str) -> BrandKit:
    """Run the structured extraction. `llm` is any provider exposing `generate_text`."""
    raw = await llm.generate_text(
        EXTRACTION_PROMPT + (content or "")[:_EXTRACTION_CHARS],
        system_prompt="You are a precise brand strategist. You output JSON only.",
        # See GeminiProvider.generate_text: the structured schema is large enough that the
        # model breaks its own quoting partway through without this - observed as
        # "malformed JSON: Expecting ',' delimiter: line 362 column 75" on a live nike.in
        # extraction. Providers that do not understand the flag ignore it, and the lenient
        # parser still runs behind it either way.
        json_mode=True)
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
    # Keyed "visual" to match the section id the Brand Guidelines screen renders.
    put("visual", kit.visual_identity)
    put("categories", kit.product_categories or [c.name for c in kit.catalogue if c.name])
    # The flat sections are derived from the structured ones when the model filled only the
    # richer shape. Without this, a brand re-synced under the new prompt would come back with
    # "Unique Selling Points" and "Key Features & Benefits" blank - the data is all there,
    # just under structured_usps - and the vault would look like the sync had lost ground.
    flat_usps = kit.usps or [
        (f"{u.name}: {u.feature}" if u.name and u.feature else (u.name or u.feature))
        for u in kit.structured_usps if (u.name or u.feature)
    ]
    flat_benefits = kit.benefits or [
        u.benefit for u in kit.structured_usps if u.benefit
    ] or [c.benefit for c in kit.catalogue if c.benefit]
    put("usps", "\n".join("- " + u for u in flat_usps))
    put("features", "\n".join("- " + b for b in flat_benefits))
    put("personality", ", ".join(kit.personality))
    # "tone" is the section id the vault reads. It was also written as "tone_of_voice",
    # which nothing has ever read — a duplicate of the same value under a key with no
    # consumer, bloating the stored guidelines blob on every sync.
    put("tone", ", ".join(kit.tone_of_voice))
    put("key_messages", kit.key_messages)
    put("markets", kit.markets)
    # core.rag.brand_facts reads guidelines["tone_of_voice"] and hands it to every agent as
    # "Tone of voice:". An earlier cleanup removed this write as an unread duplicate of
    # "tone" - it was not unread, and removing it silently stripped tone guidance from every
    # piece of copy the product generates. Both keys are written: "tone" is the vault's
    # section id (a display string), "tone_of_voice" is the list agents consume.
    put("tone_of_voice", list(kit.tone_of_voice))
    # The personas were extracted on every crawl and then dropped here, so the Brand
    # Knowledge vault had no way to show them and a re-sync could never fill them in. They
    # are the most useful thing this extractor produces - a named segment with a written
    # hook - and they were the one field that never reached the screen.
    #
    # The whole persona is stored now, not just {persona, hook}: the extra fields are what
    # let a campaign agent answer "what objection does this segment have" without inventing
    # an answer. Readers that only know the old two keys are unaffected - they are still
    # present, in the same place.
    put("target_audiences", [
        p.model_dump() for p in kit.target_audiences if (p.persona or "").strip()
    ])

    # ------------------------------------------------------------ structured layer
    # Namespaced under their own keys so nothing that reads the flat sections above can be
    # disturbed by them. `put` still drops anything empty, so a model that ignored the new
    # schema leaves the previous contents of these keys untouched on a re-sync.
    put("brand_name", kit.brand_name)
    put("industry", kit.industry)
    put("value_proposition", kit.value_proposition)
    put("structured_usps", [u.model_dump() for u in kit.structured_usps if (u.name or u.feature or "").strip()])
    put("catalogue", [c.model_dump() for c in kit.catalogue if (c.name or "").strip()])
    put("jobs_to_be_done", [j.model_dump() for j in kit.jobs_to_be_done if (j.problem or "").strip()])
    put("verified_claims", list(kit.verified_claims))
    put("unsupported_topics", list(kit.unsupported_topics))

    # Nested objects: written only when they carry something, so an empty VoiceGuide never
    # overwrites a voice a user edited by hand.
    voice = kit.voice.model_dump()
    if any(voice.values()):
        out["voice"] = voice
    messaging = kit.messaging.model_dump()
    if any(messaging.values()):
        out["messaging"] = messaging
    story = kit.story.model_dump()
    if any(story.values()):
        out["story"] = story
    signals = kit.positioning_signals.model_dump()
    # basis defaults to "inferred", so test the axes rather than the whole object.
    if any(v for k, v in signals.items() if k != "basis"):
        out["positioning_signals"] = signals
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
            EXTRACTION_PROMPT + (content or "")[:_EXTRACTION_CHARS] + _VISION_SUFFIX,
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


# ------------------------------------------------- accent roles (primary / glow / dark)

def _hsl(hex_code: str):
    r, g, b = (int(hex_code[i:i + 2], 16) / 255 for i in (1, 3, 5))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    return h, s, l


# A CSS variable's NAME is evidence the pixels do not carry. `--color-accent` is the site
# stating its accent; `--diff-old-color` is syntax highlighting that happens to be vivid.
# Without this, scoring collapses to chroma alone for CSS tokens (which have no share), and
# on linear.app that picked "Diff Old Color" (#f34e52, chroma 0.65) over "Color Accent"
# (#7170ff, chroma 0.56) - a red from a code sample presented as the brand colour.
_BRAND_NAME_RE = re.compile(r"\b(accent|brand|primary|cta|highlight)\b", re.I)
_NON_BRAND_NAME_RE = re.compile(
    r"\b(diff|icon|error|danger|success|warning|info|disabled|placeholder|shadow|"
    r"overlay|scrollbar|selection|link|visited|code|syntax|token)\b", re.I)


def _primary_score(c: dict) -> float:
    """How likely this colour is the brand's primary.

    Chroma and prevalence, then weighted by what the site calls it. Prevalence is the
    stronger signal when we have it (clustered pixels), the name is the stronger signal
    when we do not (declared variables, which carry no share).
    """
    base = c["_chroma"] * (0.3 + c["_share"])
    label = "%s %s" % (c.get("name", ""), c.get("role", ""))
    if _NON_BRAND_NAME_RE.search(label):
        return base * 0.15
    if _BRAND_NAME_RE.search(label):
        return base * 2.5
    return base


def classify_accents(colours: List[dict]) -> dict:
    """Sort clustered colours into the three roles a brand actually designs with.

    A flat ranked palette does not tell a designer what to DO with a colour. These three
    are the ones a brief needs, and they are distinguishable by measurement rather than
    taste:

      primary  the brand colour - the most present colour that is genuinely chromatic.
      glow     a vivid, LIGHT accent used for emphasis: highlights, hover states, the lit
               edge of a gradient. High chroma AND high lightness together, which is what
               separates it from the primary rather than being a second primary.
      dark     the deep surface a dark-mode brand sits on. Low lightness, and it is a
               *choice* (near-black with a hue) rather than pure #000.

    Returns {"primary": {...}|None, "glow": ..., "dark": ...}. A role stays None when
    nothing qualifies - a brand with no dark surface should not be handed one.
    """
    scored = []
    for c in colours:
        hex_code = c.get("hex", "")
        if not re.fullmatch(r"#[0-9a-fA-F]{6}", hex_code or ""):
            continue
        r, g, b = (int(hex_code[i:i + 2], 16) / 255 for i in (1, 3, 5))
        chroma = max(r, g, b) - min(r, g, b)
        # rgb_to_hls returns (hue, LIGHTNESS, saturation) - lightness is the SECOND value.
        # Unpacking the third here read saturation as lightness, which classified #ffffff
        # (saturation 0.0) as the dark surface and #ff5207 (saturation 0.97) as the glow.
        _, lightness, _ = colorsys.rgb_to_hls(r, g, b)
        scored.append({**c, "_chroma": chroma, "_lightness": lightness,
                       "_share": float(c.get("share") or c.get("_share") or 0)})

    out = {"primary": None, "glow": None, "dark": None}
    if not scored:
        return out

    # Dark first: a deep surface would otherwise be a poor "primary" purely by area.
    darks = [c for c in scored if c["_lightness"] <= 0.22]
    if darks:
        # The most chromatic dark - a brand's obsidian usually carries a hue, and picking
        # the *least* chromatic would just return black.
        out["dark"] = max(darks, key=lambda c: (c["_chroma"], c["_share"]))

    # Primary BEFORE glow. Ordering matters: a brand whose only chromatic colour is a
    # bright one (Linear's #7170ff) would otherwise have it taken as the glow, leaving
    # primary to fall through to the most-present colour - which is usually #ffffff. The
    # brand's one colour is its primary; a glow is a *second* vivid accent or nothing.
    taken = {id(v) for v in out.values() if v}
    candidates = [c for c in scored if id(c) not in taken and c["_chroma"] >= 0.15]
    if candidates:
        out["primary"] = max(candidates, key=_primary_score)
    # No fallback to the most-present colour: a palette with nothing chromatic in it has no
    # primary, and reporting white as a brand colour is worse than reporting none.

    # Glow: vivid AND light, and not already spoken for. Both conditions matter - a
    # vivid-but-dark colour is a primary, and a light-but-dull one is a background.
    taken = {id(v) for v in out.values() if v}
    glows = [c for c in scored
             if id(c) not in taken and c["_chroma"] >= 0.35 and c["_lightness"] >= 0.55]
    if glows:
        out["glow"] = max(glows, key=lambda c: c["_chroma"] * c["_lightness"])

    for role, c in out.items():
        if c:
            for k in ("_chroma", "_lightness", "_share"):
                c.pop(k, None)
            c["role"] = {"primary": "Primary brand colour",
                         "glow": "Glow / emphasis accent",
                         "dark": "Dark surface"}[role]
            c["name"] = role.capitalize()
    return out


async def screenshot_color_tokens(screenshot: bytes, limit: int = 4) -> List[dict]:
    """Cluster the RENDERED page.

    Distinct from hero_color_tokens, which reads image FILES. A screenshot carries what the
    browser actually painted - CSS gradients, glows, overlays, and any colour that exists
    only as a rule rather than a file. On a dark-mode brand that is usually where the
    surface and the glow live, and no <img> on the page contains either.
    """
    if not screenshot:
        return []
    clusters = kmeans_palette(screenshot, k=limit + 2)
    out = []
    for c in clusters[:limit]:
        if c["share"] < 0.04:
            continue
        out.append({"name": "Rendered %d" % (len(out) + 1), "hex": c["hex"],
                    "role": "Painted on the page (%d%%)" % round(c["share"] * 100),
                    "source": "screenshot-kmeans", "share": c["share"]})
    return out


# --------------------------------------------------------------- quality report

# Phrases that could be said about any company. A brief built from these is worthless to a
# copy agent because it constrains nothing, so they are counted against specificity.
_GENERIC_PHRASES = (
    "high quality", "high-quality", "great quality", "best quality", "top quality",
    "innovative solutions", "wide range", "world class", "world-class", "cutting edge",
    "cutting-edge", "customer satisfaction", "excellent service", "trusted brand",
    "leading provider", "one-stop", "affordable prices", "value for money",
    "state of the art", "state-of-the-art", "seamless experience", "premium quality",
)


def _norm_claim(text: str) -> str:
    """Lowercased, punctuation-stripped form, for spotting the same claim written twice."""
    return re.sub(r"[^a-z0-9 ]+", "", str(text or "").lower()).strip()


def assess_brand_kit(kit: "BrandKit", page_count: int = 0) -> dict:
    """Score a kit against rules that actually inspect it.

    Deliberately not a vibe. Every number below is computed from the kit's own contents, so
    a thin extraction cannot report 90% and a rich one cannot be dragged down by an empty
    optional field. The report is for operators and for the UI's confidence indicators; it
    is never shown as a marketing number.
    """
    # -------- completeness: sections that carry real weight, each worth the same
    checks = {
        "overview": bool((kit.overview or "").strip()),
        "value_proposition": bool((kit.value_proposition or "").strip()),
        "positioning": bool((kit.positioning or "").strip()),
        "audience_summary": bool((kit.audience_summary or "").strip()),
        "personas": len(kit.target_audiences) >= 2,
        "structured_usps": len(kit.structured_usps) >= 3,
        "catalogue": len(kit.catalogue) >= 1,
        "voice": len(kit.voice.traits) >= 2,
        "messaging": bool((kit.messaging.core_message or "").strip()),
        "jobs_to_be_done": len(kit.jobs_to_be_done) >= 1,
        "verified_claims": len(kit.verified_claims) >= 1,
        "markets": bool((kit.markets or "").strip()),
    }
    completeness = round(100 * sum(1 for v in checks.values() if v) / len(checks))

    # -------- evidence coverage: of the claims that CAN carry a citation, how many do
    evidence_bearing = (
        [u.evidence for u in kit.structured_usps]
        + [c.evidence for c in kit.catalogue]
        + [p.evidence for p in kit.target_audiences]
        + [j.evidence for j in kit.jobs_to_be_done]
    )
    cited = sum(1 for e in evidence_bearing if (e.source_url or "").strip())
    evidence_coverage = round(100 * cited / len(evidence_bearing)) if evidence_bearing else 0

    # -------- specificity: generic filler anywhere in the prose the agents will quote
    prose = " ".join([
        kit.overview, kit.value_proposition, kit.positioning, kit.audience_summary,
        " ".join(kit.usps), " ".join(kit.benefits), " ".join(kit.key_messages),
        " ".join(u.benefit + " " + u.feature for u in kit.structured_usps),
    ]).lower()
    generic_hits = sorted({g for g in _GENERIC_PHRASES if g in prose})
    # A USP is "thin" when it fails the what/why/who test the schema exists to enforce.
    thin_usps = [u.name or u.feature for u in kit.structured_usps
                 if not ((u.feature or "").strip() and (u.benefit or "").strip()
                         and (u.audience or "").strip())]
    if generic_hits or thin_usps:
        specificity = "low" if (len(generic_hits) + len(thin_usps)) > 3 else "medium"
    else:
        specificity = "high"

    # -------- duplication: the same sentence appearing across sections
    claims = ([_norm_claim(u) for u in kit.usps]
              + [_norm_claim(b) for b in kit.benefits]
              + [_norm_claim(m) for m in kit.key_messages]
              + [_norm_claim(s.message) for s in kit.messaging.supporting])
    # >= 8, not > 12: at 12 the rule missed "high quality" repeated verbatim across usps,
    # benefits and key_messages, which is the single most common duplication in practice.
    claims = [c for c in claims if len(c) >= 8]
    duplicates = len(claims) - len(set(claims))

    # -------- hallucination risk: assertions with no citation and no hedge
    unsupported = [
        u.name or u.feature for u in kit.structured_usps
        if not (u.evidence.source_url or "").strip() and u.evidence.basis == "stated"
    ]

    # -------- usefulness: can an agent answer the questions it is actually asked
    answerable = {
        "who is this brand targeting": len(kit.target_audiences) >= 1,
        "what should be promoted to a segment": any(p.categories for p in kit.target_audiences),
        "what tone should copy use": len(kit.voice.traits) >= 1,
        "what are the differentiators": len(kit.structured_usps) >= 1,
        "what claims are safe": len(kit.verified_claims) >= 1,
        "what must an ad avoid": len(kit.unsupported_topics) >= 1,
        "what is the positioning": bool((kit.positioning or "").strip()),
        "what messaging angles exist": len(kit.messaging.angles) >= 1,
    }

    # -------- connectedness: can the knowledge answer a RELATIONAL question
    #
    # Everything above counts whether facts exist. A vault can score well on that and still
    # be unusable, because knowing five personas and five categories does not tell an agent
    # which product to put in front of which segment - and that is the question campaigns
    # and creative actually ask. core.brand_graph resolves those links from the stored
    # records, so the share of personas it can reach an offer for measures something the
    # presence checks cannot.
    connected_pct = 0
    orphan_personas: list = []
    orphan_categories: list = []
    try:
        from core.brand_graph import build_graph
        graph = build_graph({
            "catalogue": [c.model_dump() for c in kit.catalogue],
            "structured_usps": [u.model_dump() for u in kit.structured_usps],
            "target_audiences": [p.model_dump() for p in kit.target_audiences],
            "jobs_to_be_done": [j.model_dump() for j in kit.jobs_to_be_done],
        })
        rows = graph.get("personas") or []
        linked = [r for r in rows if r.get("products") or r.get("differentiators")]
        connected_pct = round(100 * len(linked) / len(rows)) if rows else 0
        orphan_personas = graph.get("personas_without_products") or []
        orphan_categories = graph.get("unmatched_categories") or []
    except Exception as e:      # never let the report fail the profile
        print("brand quality: relationship pass skipped: %s" % e)

    return {
        "completeness_pct": completeness,
        "completeness_missing": sorted(k for k, v in checks.items() if not v),
        # How much of the knowledge is actually joined up, and where it is not.
        "connected_pct": connected_pct,
        "personas_without_offer": orphan_personas,
        "categories_without_audience": orphan_categories,
        "evidence_coverage_pct": evidence_coverage,
        "specificity": specificity,
        "generic_phrases": generic_hits,
        "thin_usps": thin_usps,
        "duplicate_claims": duplicates,
        "unsupported_claims": unsupported,
        "counts": {
            "personas": len(kit.target_audiences),
            "product_categories": len(kit.catalogue),
            "products": sum(len(c.products) for c in kit.catalogue),
            "usps": len(kit.structured_usps),
            "jobs_to_be_done": len(kit.jobs_to_be_done),
            "voice_traits": len(kit.voice.traits),
            "verified_claims": len(kit.verified_claims),
            "source_pages": page_count,
        },
        "agent_questions_answerable": answerable,
        "agent_readiness_pct": round(100 * sum(1 for v in answerable.values() if v) / len(answerable)),
    }
