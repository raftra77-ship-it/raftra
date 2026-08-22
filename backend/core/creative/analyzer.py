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
import os
import re
from typing import Optional

import httpx

from .platforms import normalise_platform
from .spec import BASE_NEGATIVES, CreativeSpec, VideoPlan

_GEMINI_URL = ("https://generativelanguage.googleapis.com/v1beta/models/"
               "{model}:generateContent")
_DEFAULT_MODEL = os.getenv("CREATIVE_ANALYZER_MODEL", "gemini-2.5-flash")

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


def _heuristic_spec(prompt: str, media_type: str, platform: Optional[str],
                    reference_image_url: str, placement: Optional[str] = None) -> CreativeSpec:
    """Fallback when the model is unavailable or returns junk  the raw request still
    drives the image, which is no worse than the previous pipeline.

    `placement` must be carried through: it comes from an explicit UI choice, not from the
    model, so dropping it here silently downgraded an Instagram *story* (9:16) to the feed
    default (4:5) whenever analysis fell back.
    """
    spec = CreativeSpec(
        original_prompt=prompt, visual_concept=prompt.strip(),
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
                  brand_context: str = "", model: Optional[str] = None) -> CreativeSpec:
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
        instruction.append(f"Known brand context (use ONLY if relevant):\n{brand_context[:1500]}")
    if reference_image_url:
        instruction.append(
            "A reference image is attached. Describe its product, colours, shape and framing "
            "in the spec so the generated creative stays faithful to it. Treat it as a visual "
            "source  do not restyle or distort the actual product.")

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
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            r = await client.post(url, params={"key": api_key}, json=payload)
        if r.status_code != 200:
            print(f"[creative.analyzer] Gemini {r.status_code}: {r.text[:200]}")
            return _heuristic_spec(prompt, media_type, platform, reference_image_url, placement)
        body = r.json()
        candidate = (body.get("candidates") or [{}])[0]
        finish = candidate.get("finishReason")
        text = ((candidate.get("content") or {}).get("parts") or [{}])[0].get("text", "")
    except Exception as e:
        print(f"[creative.analyzer] call failed: {e}")
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
