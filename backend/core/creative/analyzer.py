"""Prompt Analyzer  the ONE model call in the pipeline.

"make an instagram ad for my coffee brand" carries a product, a platform, an implied format
and an implied objective, but no visual direction. This turns that into a full CreativeSpec
in a single request, including a reference image when one was uploaded (Gemini is multimodal,
so the image rides along in the same call rather than costing a second one).

Two rules the prompt enforces hard:
  * Never invent a brand name, audience or claim the user did not give. A hallucinated brand
    ends up rendered into the picture, which is worse than leaving the field blank.
  * Only ask a clarifying question when the answer would materially change the creative.
    "What shade of brown?" is noise; "is this a physical product or an app?" is not.

If the call fails or returns unparseable JSON, a heuristic spec is built from the raw prompt.
Generation degrades to roughly the old behaviour rather than erroring out.
"""
from __future__ import annotations

import base64
import json
import asyncio
import os
import re
from typing import Optional

import httpx

from .platforms import normalise_platform
from .spec import BASE_NEGATIVES, CreativeSpec, VideoPlan

_GEMINI_URL = ("https://generativelanguage.googleapis.com/v1beta/models/"
               "{model}:generateContent")
_DEFAULT_MODEL = os.getenv("CREATIVE_ANALYZER_MODEL", "gemini-2.5-flash")

# This call is the only thing standing between a brand-grounded creative and a generic one,
# so it gets a retry. 120s rather than 90s because a populated vault makes the request
# meaningfully larger, and a timeout here costs the whole brand grounding.
_ANALYZER_TIMEOUT_SEC = float(os.getenv("CREATIVE_ANALYZER_TIMEOUT_SEC", "120"))
_ANALYZER_ATTEMPTS = int(os.getenv("CREATIVE_ANALYZER_ATTEMPTS", "2"))
_ANALYZER_RETRY_DELAY_SEC = float(os.getenv("CREATIVE_ANALYZER_RETRY_DELAY_SEC", "2"))

_SYSTEM = """You are an advertising creative director who outputs ONLY JSON.

Turn the user's request into a structured creative specification.

HARD RULES
- Preserve the user's intent exactly. Every concrete noun, colour, material, setting and
  style word they wrote must survive into the spec.
- NEVER invent a brand name, statistic, price, claim or audience the user did not state.
  Leave those fields as empty strings instead.
- Use sensible defaults for purely visual fields (lighting, composition, camera angle) 
  those are craft decisions, not facts about the user's business.
- Set "text_in_image" to true ONLY if the user explicitly asked for words, a slogan or a
  headline rendered inside the picture. Default false.
- Put a question in "clarifying_question" ONLY if the missing information would materially
  change the creative. Otherwise leave it an empty string.
- List anything you assumed in "assumptions".

Return ONLY this JSON object, no markdown fences, no commentary:
{
  "product": "", "brand": "", "objective": "awareness|consideration|conversion",
  "audience": "", "platform": "", "placement": "", "media_type": "image|video",
  "visual_concept": "one vivid sentence describing exactly what the picture shows",
  "subject": "", "environment": "", "composition": "", "camera_angle": "",
  "lighting": "", "color_direction": "", "mood": "", "style": "",
  "headline": "", "primary_text": "", "cta": "", "creative_angle": "",
  "text_in_image": false,
  "video": {"duration": 5, "camera_motion": "", "subject_motion": "", "voiceover": "",
            "scenes": [{"duration": 3, "visual": "", "camera": "", "motion": "", "text": ""}]},
  "negative_prompt": [],
  "clarifying_question": "", "assumptions": []
}
Omit "video" entirely when media_type is "image"."""


def _strip_fences(text: str) -> str:
    text = re.sub(r"^```[a-zA-Z0-9]*\s*", "", (text or "").strip())
    return re.sub(r"\s*```$", "", text).strip()


def _extract_json(text: str) -> dict:
    cleaned = _strip_fences(text)
    try:
        return json.loads(cleaned)
    except Exception:
        pass
    # Models occasionally wrap the object in prose; take the outermost braces.
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(cleaned[start:end + 1])
        except Exception:
            pass
    return {}


def _resolve_local(image_url: str) -> Optional[bytes]:
    """Read a locally-stored upload straight off disk.

    The upload endpoint returns a RELATIVE url (/api/generated/uploads/<ws>/<uuid>.png) so
    that it works in dev behind the Vite proxy and in production behind one origin. httpx
    cannot GET a relative url, so without this the reference image silently failed to load
    and the analyzer fell back to the raw prompt — the upload appeared to do nothing.
    """
    prefix = "/api/generated/uploads/"
    if not image_url.startswith(prefix):
        return None
    from pathlib import Path
    from core.providers.kenburns_video import MEDIA_ROOT
    rel = image_url[len(prefix):].split("?", 1)[0]
    # Resolve and confirm containment, so a crafted path cannot read outside the upload tree.
    root = (MEDIA_ROOT / "uploads").resolve()
    target = (root / rel).resolve()
    if root not in target.parents or not target.is_file():
        return None
    return target.read_bytes()


async def _fetch_image_part(image_url: str) -> Optional[dict]:
    """inline_data part for a reference image, or None when it cannot be read."""
    try:
        local = _resolve_local(image_url)
        if local is not None:
            import mimetypes
            mime = mimetypes.guess_type(image_url)[0] or "image/png"
            if len(local) > 4 * 1024 * 1024:
                return None
            return {"inlineData": {"mimeType": mime,
                                    "data": base64.b64encode(local).decode()}}
        if image_url.startswith("data:"):
            header, b64 = image_url.split(",", 1)
            mime = header.split(":", 1)[1].split(";", 1)[0] or "image/png"
            raw = base64.b64decode(b64)
        elif image_url.startswith("/"):
            # Any other server-relative URL: resolve against our own public base.
            base = os.getenv("BACKEND_URL", "http://127.0.0.1:8005").rstrip("/")
            async with httpx.AsyncClient(timeout=30, follow_redirects=True) as c:
                r = await c.get(base + image_url)
            if r.status_code != 200:
                return None
            mime = (r.headers.get("content-type") or "image/png").split(";")[0]
            raw = r.content
        else:
            async with httpx.AsyncClient(timeout=30, follow_redirects=True) as c:
                r = await c.get(image_url)
            if r.status_code != 200:
                return None
            mime = (r.headers.get("content-type") or "image/png").split(";")[0]
            raw = r.content
        # Keep the request small; Gemini inline data is capped and this is only for
        # understanding the reference, not reproducing it.
        if len(raw) > 4 * 1024 * 1024:
            return None
        return {"inlineData": {"mimeType": mime, "data": base64.b64encode(raw).decode()}}
    except Exception as e:
        print(f"[creative.analyzer] could not read reference image: {e}")
        return None


# Labels the Brand Knowledge brief uses to structure itself, and the lead-in that names the
# brand and its domain. Meaningful to the analyser, meaningless to an image model - which
# tries to PAINT them, along with the brand name and the URL sitting beside them.
_BRIEF_LEAD_RE = re.compile(
    r"^\s*(?:advertising|marketing)\s+creative\s+for\s+(?P<brand>[^.(]+?)\s*(?:\([^)]*\))?\.\s*",
    re.IGNORECASE)
_BRIEF_LABEL_RE = re.compile(
    r"\b(?:Subject|Brand visual identity|Use the brand palette|Tone|Brand personality|"
    r"Audience|Angle|Core message|What it offers|Differentiators to show)\s*:\s*",
    re.IGNORECASE)
# Any URL or bare domain. A model shown "dsahelper.onrender.com" renders lettering.
_URL_RE = re.compile(
    r"\(?\bhttps?://\S+|\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|ai|app|co|in|dev|onrender\.com)\b\)?",
    re.IGNORECASE)


def _scene_only(prompt: str) -> str:
    """The visual part of a brief, for when the analyser could not run.

    The fallback used the request verbatim as `visual_concept`, which was survivable when a
    prompt was a sentence someone typed. It is not survivable now that "Generate using Brand
    Knowledge" composes a structured brief: a real run reached the image model as

        "Advertising creative for DSA (dsahelper.onrender.com). Subject: DSA Topic
         Modules. Brand visual identity: The visual identity is clean, modern..."

    - brand name, domain and section labels included, because on this path `spec.brand` and
    `spec.product` are empty, so the proper-noun guard in the optimizer has nothing to match.
    That is the random image: the model paints the labels.
    """
    text = _BRIEF_LEAD_RE.sub("", prompt or "")
    text = _BRIEF_LABEL_RE.sub("", text)
    text = _URL_RE.sub("", text)
    text = re.sub(r"\s{2,}", " ", text)
    text = re.sub(r"\s+([,.])", r"\1", text)
    return text.strip(" .,")


def _heuristic_spec(prompt: str, media_type: str, platform: Optional[str],
                    reference_image_url: str, placement: Optional[str] = None) -> CreativeSpec:
    """Fallback when the model is unavailable or returns junk  the raw request still
    drives the image, which is no worse than the previous pipeline.

    `placement` must be carried through: it comes from an explicit UI choice, not from the
    model, so dropping it here silently downgraded an Instagram *story* (9:16) to the feed
    default (4:5) whenever analysis fell back.
    """
    # Recover the brand from the brief's own lead-in ("Advertising creative for DSA (...)").
    #
    # Without it `spec.brand` is empty on this path, so the optimizer's proper-noun guard has
    # nothing to match and the name survives into the image prompt - which is exactly how
    # "DSA Topic Modules" reached the model and came back as painted lettering. Setting it
    # here makes the existing guard work on the fallback too, rather than adding a second one.
    lead = _BRIEF_LEAD_RE.match(prompt or "")
    brand = (lead.group("brand").strip() if lead else "")

    spec = CreativeSpec(
        original_prompt=prompt, visual_concept=_scene_only(prompt),
        brand=brand,
        media_type=media_type, platform=normalise_platform(platform),
        placement=placement or "",
        reference_image_url=reference_image_url or "",
        negative_prompt=list(BASE_NEGATIVES),
        assumptions=["Prompt analysis was unavailable; used the request verbatim."],
    )
    if media_type == "video":
        spec.video = VideoPlan()
    return spec.apply_platform_defaults()


async def analyze(prompt: str, *, media_type: str = "image", platform: Optional[str] = None,
                  placement: Optional[str] = None, reference_image_url: str = "",
                  brand_context: str = "", model: Optional[str] = None,
                  input_method: str = "", copy_angle: str = "") -> CreativeSpec:
    """Raw request -> CreativeSpec. Exactly one model call."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or not (prompt or "").strip():
        return _heuristic_spec(prompt, media_type, platform, reference_image_url, placement)

    instruction = [
        f'User request: "{prompt.strip()}"',
        f"Requested media type: {media_type}",
    ]
    if platform:
        instruction.append(f"Target platform: {platform}"
                           + (f" ({placement})" if placement else ""))
    if brand_context:
        # This used to read "use ONLY if relevant" and cut the context at 1500 chars.
        #
        # Both were wrong. The hedge invited the model to discard the vault - and combined
        # with the system rule "NEVER invent a brand name, claim or audience", it read as a
        # reason to avoid brand facts altogether, so Creative Studio produced generic
        # creative for a fully populated workspace. The truncation then threw away over half
        # of a measured 3,643-char context, and the brand kit's product names and
        # technologies sit near the end of it - exactly the part being cut.
        #
        # The budget was never the constraint: this context is ~900 tokens against a model
        # that accepts far more, and the earlier token problem was output-side (fixed by
        # disabling thinking, see below), not input-side.
        instruction.append(
            "VERIFIED BRAND KNOWLEDGE for this workspace. This was extracted from the "
            "brand's own website and is given to you as fact - using it is NOT inventing, "
            "and the rule about never inventing a brand does not apply to anything below.\n"
            "Ground the spec in it:\n"
            "- `visual_concept` is what actually reaches the image model, so the grounding "
            "must land THERE, not only in `product`. Ground it by DESCRIBING the product's "
            "visible form - shape, materials, construction, finish - and NEVER by naming it. "
            "Write \"a road-running shoe with an engineered mesh upper and a visible "
            "air-cushioned midsole\", NOT \"the Vomero 18\". A reader of `visual_concept` "
            "should be able to picture the exact object without being told whose it is.\n"
            "- IF THE PRODUCT IS SOFTWARE (an app, a platform, a dashboard, a website): do "
            "NOT describe the interface. `visual_concept` describes the PHYSICAL SCENE only "
            "- the device, the desk, the room, the light. Write \"a slim silver laptop open "
            "on a pale oak desk beside a ceramic mug, bright morning light from a window to "
            "the left\". Never \"a dashboard showing lessons, a code editor and a progress "
            "bar\". An image model asked for interface content invents it and every label "
            "comes out as unreadable scribble - it is the single most common way a SaaS ad "
            "is ruined. The real product is composited onto the screen afterwards.\n"
            "- The SAME rule covers technologies and materials: describe what they look "
            "like (\"translucent cushioning unit in the heel\"), never their trade names "
            "(\"Air Zoom\", \"Dri-FIT\").\n"
            "- Put product names, model numbers, technology names and the brand name in "
            "`product` and `brand`. Those fields are read by the copy layer and never reach "
            "the image model.\n"
            "  Why this matters: an image model cannot type. It paints letter-SHAPED pixels, "
            "so any proper noun in the prompt comes back as garbled lettering baked into the "
            "picture - measured on this product: \"DSA Mastery Hub\" rendered as \"Data "
            "Mastery Arts St Aseles\". Describing the object instead keeps every bit of the "
            "grounding and removes the thing the model cannot draw.\n"
            "- Set `color_direction` from the brand's stated palette, and `mood`/`style` "
            "from its stated visual language and positioning.\n"
            "- Do NOT render the brand name, wordmark or logo as text in the image unless "
            "`text_in_image` is true; grounding the subject is separate from drawing a logo.\n"
            "- If a brand fact contradicts the user's request, the user's request wins.\n"
            "- WRITE THE AD COPY. Fill `headline` (<= 9 words), `primary_text` (one "
            "sentence, <= 18 words) and `cta` (2-4 words) from the brand knowledge below. "
            "These are rendered as real text by our own code AFTER the image is generated, "
            "so they are the only place words are guaranteed to be spelled correctly - and "
            "leaving them empty means the finished ad has no message on it at all. Base "
            "them on the brand's stated value proposition, differentiators and audience; "
            "the 'never invent' rule still applies to prices, statistics and awards.\n\n"
            f"{brand_context[:6000]}")
    if reference_image_url:
        instruction.append(
            "A reference image is attached. Describe its product, colours, shape and framing "
            "in the spec so the generated creative stays faithful to it. Treat it as a visual "
            "source  do not restyle or distort the actual product.")

    # Which of the Creative Studio input routes this came from.
    #
    # The four routes ask for genuinely different things, and the analyser could not tell
    # them apart from the prompt text: "use the brand kit as the subject" and "keep the
    # photo I gave you and style it on-brand" arrived identical, so they produced identical
    # specs. Stated plainly here so the spec differs where the intent differs.
    _ROUTE_DIRECTIVE = {
        "brand_kb":
            "INPUT ROUTE: brand knowledge. There is no user photo and the brief below IS the "
            "brand kit. Pick the hero subject from this brand's own catalogue and name it in "
            "`visual_concept` with its materials and technologies; do not fall back to a "
            "generic category object.",
        "vault_assets":
            "INPUT ROUTE: an existing brand asset. The attached image is this brand's own "
            "product shot and is the subject. Keep the product identical - its shape, "
            "colourway, proportions and markings - and let the spec change only the "
            "environment, lighting, composition and mood around it.",
        "upload_image":
            "INPUT ROUTE: a user-supplied photo. The attached image is the subject and must "
            "be preserved exactly; do not substitute a catalogue product for it. Use the "
            "brand knowledge for palette, mood and styling around it only.",
        "ai_generate_image":
            "INPUT ROUTE: the user's own prompt leads. Their described scene and subject take "
            "priority; use the brand knowledge for palette, mood, styling and product naming "
            "where it does not contradict what they asked for.",
    }
    directive = _ROUTE_DIRECTIVE.get((input_method or "").strip().lower())
    if directive:
        instruction.append(directive)

    # Which angle this particular generation takes.
    #
    # Without it, pressing Generate again returns the same ad. The brand kit does not change
    # between runs and nor does the brief, so temperature 0.7 only reshuffles the wording -
    # measured across six consecutive runs on one workspace, the headline came back as
    # "Level Up Your Coding Skills" every time. The caller rotates through the brand's own
    # personas and messaging angles and names one here, which changes what the ad is ABOUT
    # rather than just how it is phrased.
    if copy_angle:
        instruction.append(
            f"ANGLE FOR THIS GENERATION: {copy_angle}\n"
            "Write `headline`, `primary_text` and `cta` specifically for this angle, and "
            "make the scene suit it. Do not fall back to the brand's most generic message - "
            "the user has seen that one. The visual and the copy should both be recognisably "
            "about this angle.")

    parts: list[dict] = [{"text": _SYSTEM + "\n\n" + "\n".join(instruction)}]
    if reference_image_url:
        part = await _fetch_image_part(reference_image_url)
        if part:
            parts.append(part)

    # This is structured extraction against a schema, not open reasoning, so the model's
    # thinking budget is spent for nothing here - and on 2.5 it is charged against
    # maxOutputTokens. With a real brand context (~1.1k chars) it burned ~1341 of the old
    # 1400 limit, leaving too few tokens to finish the JSON: the response came back
    # truncated, _extract_json failed, and every request silently fell back to the verbatim
    # heuristic. The better the brand knowledge, the more reliably it broke.
    # Disabling thinking fixes the cause; the raised ceiling is headroom for long specs.
    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 4096,
                             "responseMimeType": "application/json",
                             "thinkingConfig": {"thinkingBudget": 0}},
    }
    url = _GEMINI_URL.format(model=(model or _DEFAULT_MODEL))

    # Retry the transient failures instead of silently falling back.
    #
    # Falling back means _heuristic_spec, which echoes the user's raw prompt with generic
    # polish and NO brand knowledge - a plausible-looking spec that quietly discards the
    # whole vault. Any non-200 took that path immediately, so one 503 ("The request timed
    # out", observed live on this workspace) turned a brand-grounded creative into a generic
    # one with nothing on screen to say why. 503/429/500 and network errors are worth one
    # more try; a 400 or 403 is not, and still degrades at once.
    body = None
    finish = None
    text = ""
    last_problem = ""
    for attempt in range(_ANALYZER_ATTEMPTS):
        try:
            async with httpx.AsyncClient(timeout=_ANALYZER_TIMEOUT_SEC) as client:
                r = await client.post(url, params={"key": api_key}, json=payload)
            if r.status_code == 200:
                body = r.json()
                candidate = (body.get("candidates") or [{}])[0]
                finish = candidate.get("finishReason")
                text = ((candidate.get("content") or {}).get("parts") or [{}])[0].get("text", "")
                break
            last_problem = f"HTTP {r.status_code}: {r.text[:160]}"
            if r.status_code not in (429, 500, 502, 503, 504):
                break        # a client error will not fix itself
        except Exception as e:
            last_problem = f"{type(e).__name__}: {e}"
        if attempt + 1 < _ANALYZER_ATTEMPTS:
            print(f"[creative.analyzer] {last_problem} - retrying "
                  f"({attempt + 2}/{_ANALYZER_ATTEMPTS})")
            await asyncio.sleep(_ANALYZER_RETRY_DELAY_SEC)

    if body is None:
        # Loud on purpose: the creative that follows will carry no brand knowledge, and that
        # is worth knowing rather than discovering from a generic-looking image.
        print(f"[creative.analyzer] GIVING UP after {_ANALYZER_ATTEMPTS} attempts "
              f"({last_problem}). Falling back to the verbatim prompt - this creative will "
              f"NOT use brand knowledge.")
        return _heuristic_spec(prompt, media_type, platform, reference_image_url, placement)

    data = _extract_json(text)
    if not data:
        # This branch used to return silently, which is how a 100%-failing analyzer went
        # unnoticed: the caller just saw a plausible spec built from the raw prompt.
        # finishReason is the tell - MAX_TOKENS here means the budget above needs raising.
        print(f"[creative.analyzer] unparseable response (finishReason={finish}, "
              f"{len(text)} chars); falling back to the verbatim prompt")
        return _heuristic_spec(prompt, media_type, platform, reference_image_url, placement)
    return build_spec(data, prompt=prompt, media_type=media_type, platform=platform,
                      placement=placement, reference_image_url=reference_image_url)


def build_spec(data: dict, *, prompt: str, media_type: str, platform: Optional[str],
               placement: Optional[str] = None, reference_image_url: str = "") -> CreativeSpec:
    """Model JSON -> validated CreativeSpec. Caller-supplied values win over the model's:
    the user explicitly picked a platform and media type in the UI, so a model that
    disagrees does not get to override them."""
    video_data = data.get("video") if isinstance(data.get("video"), dict) else None
    spec = CreativeSpec(
        product=str(data.get("product") or ""),
        brand=str(data.get("brand") or ""),
        objective=str(data.get("objective") or "awareness"),
        audience=str(data.get("audience") or ""),
        platform=normalise_platform(platform or data.get("platform")),
        placement=(placement or data.get("placement") or ""),
        media_type=media_type,
        visual_concept=str(data.get("visual_concept") or ""),
        subject=str(data.get("subject") or ""),
        environment=str(data.get("environment") or ""),
        composition=str(data.get("composition") or "") or CreativeSpec().composition,
        camera_angle=str(data.get("camera_angle") or "") or CreativeSpec().camera_angle,
        lighting=str(data.get("lighting") or "") or CreativeSpec().lighting,
        color_direction=str(data.get("color_direction") or ""),
        mood=str(data.get("mood") or ""),
        style=str(data.get("style") or "") or CreativeSpec().style,
        headline=str(data.get("headline") or ""),
        primary_text=str(data.get("primary_text") or ""),
        cta=str(data.get("cta") or ""),
        creative_angle=str(data.get("creative_angle") or ""),
        text_in_image=bool(data.get("text_in_image")),
        negative_prompt=[str(n) for n in (data.get("negative_prompt") or []) if n],
        original_prompt=prompt,
        reference_image_url=reference_image_url or "",
        clarifying_question=str(data.get("clarifying_question") or ""),
        assumptions=[str(a) for a in (data.get("assumptions") or []) if a],
    )
    if media_type == "video":
        vd = video_data or {}
        spec.video = VideoPlan(
            duration=int(vd.get("duration") or 5),
            camera_motion=str(vd.get("camera_motion") or "slow push-in"),
            subject_motion=str(vd.get("subject_motion") or ""),
            voiceover=str(vd.get("voiceover") or ""),
            scenes=[s for s in (vd.get("scenes") or []) if isinstance(s, dict)],
        )
    return spec.apply_platform_defaults()
