"""
Makes the Asset Vault searchable by what is actually in the pictures.

The vault stores a brand's product shots, lifestyle photography, banners and logos, and
until now the only things you could search were `filename`, `category` and whatever
`alt_text` the source site happened to provide. In practice that means almost nothing is
findable: harvested images arrive as IMG_4471.jpg with empty alt text, and the whole point
of the vault is questions like "show me our lifestyle desk setup assets".

Why a description rather than a CLIP vector. The architecture this implements asks for
multimodal CLIP embeddings. Two things rule that out here. CLIP needs torch — roughly
490MB against a 512MB instance, which is the same wall that already forced the text
embedder off sentence-transformers. And this project's Gemini key serves no multimodal
embedding model at all: ListModels returns only the text `gemini-embedding-*` family, and
Vertex AI's multimodalembedding would mean a service account, the Vertex API and a
different billing path.

So the image is described by a vision model and the description is embedded with the text
embedder already running in production. The trade-off is real and worth naming: this loses
the purely visual nuance CLIP captures (exact composition, colour proximity) and gains
precision on the semantic questions people actually type. It reuses the whole retrieval
path in core/vector_store.py, adds no dependency, and works today.

Descriptions are persisted on the asset row as well as indexed, so the vault UI can show
them and a re-index never needs to re-run vision on an image it has already seen.
"""
import asyncio
import json
import re
from datetime import datetime
from typing import List, Optional

import httpx

# Vision is the expensive part of this pipeline, so cap what we will pull down. Anything
# larger is almost certainly a print-resolution asset whose thumbnail would describe the
# same content, and the model downsamples it anyway.
MAX_IMAGE_BYTES = 6 * 1024 * 1024

_PROMPT = """Describe this brand asset for a marketing team's searchable library.

Return ONLY JSON, no prose or code fences:
{"description": "...", "tags": ["...", "..."]}

description: two or three sentences covering the subject, the setting, the composition and
the mood. Write what is visible. Do not guess a brand name, a price, a model number or any
text you cannot actually read in the image.

tags: 4-8 short lowercase keywords someone would plausibly search for — subject, setting,
style, colour, orientation. No hashtags, no punctuation."""


def _extract_json(raw: str) -> dict:
    """Parse the model's JSON, tolerating fences, preamble and truncation.

    Truncation is the case worth handling rather than logging. The gemini-3.x models spend
    a large part of max_output_tokens on internal thinking tokens, so a budget that looks
    generous can still cut the answer mid-string — the first version of this returned {}
    for every asset because the response ended at
    '{"description": "A hand with manicured nails holds a coiled, grey-'. A partial
    description is worth keeping: it is still a true statement about the image, and the
    alternative is indexing nothing at all.
    """
    s = (raw or "").strip()
    s = re.sub(r"^```(?:json)?|```$", "", s, flags=re.M).strip()
    try:
        return json.loads(s)
    except Exception:
        pass
    m = re.search(r"\{.*\}", s, re.S)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            pass
    # Salvage: pull the two fields out of an unterminated object.
    out = {}
    d = re.search(r'"description"\s*:\s*"((?:[^"\\]|\\.)*)', s)
    if d:
        text = d.group(1).encode().decode("unicode_escape", errors="ignore").strip()
        # Drop a trailing partial word so the stored sentence does not end mid-token.
        if text and not text[-1] in ".!?":
            text = text.rsplit(" ", 1)[0].rstrip(" ,;-") if " " in text else text
        if text:
            out["description"] = text
    t = re.findall(r'"([^"\\]{2,30})"', s.split('"tags"', 1)[1]) if '"tags"' in s else []
    if t:
        out["tags"] = t
    return out


async def fetch_image(url: str) -> tuple[Optional[bytes], str]:
    """Download one image. Returns (None, "") for anything that is not usable.

    SVGs are skipped deliberately: they are markup, vision models reject them, and a logo
    SVG's own filename is usually more descriptive than a caption would be.
    """
    if not url or url.lower().split("?")[0].endswith(".svg"):
        return None, ""
    try:
        async with httpx.AsyncClient(timeout=25, follow_redirects=True) as client:
            r = await client.get(url)
            if r.status_code != 200:
                return None, ""
            mime = (r.headers.get("content-type") or "").split(";")[0].strip()
            if not mime.startswith("image/") or "svg" in mime:
                return None, ""
            data = r.content
            if not data or len(data) > MAX_IMAGE_BYTES:
                return None, ""
            return data, mime
    except Exception as e:
        print(f"[asset_tagging] fetch failed for {url[:80]}: {e}")
        return None, ""


async def describe_image(url: str) -> dict:
    """{'description': str, 'tags': [str]} for one image URL, or {} if it cannot be read."""
    data, mime = await fetch_image(url)
    if not data:
        return {}
    try:
        from core.providers.llm_providers import GeminiProvider
        # 1600 rather than a few hundred: the gemini-3.x models bill internal thinking
        # tokens against this budget, so 400 left roughly fifteen tokens for the answer and
        # every response arrived truncated mid-JSON.
        raw = await GeminiProvider().generate_with_image(
            _PROMPT, data, mime_type=mime or "image/jpeg", max_output_tokens=1600)
    except Exception as e:
        print(f"[asset_tagging] vision call failed for {url[:80]}: {e}")
        return {}

    parsed = _extract_json(raw)
    desc = (parsed.get("description") or "").strip()
    tags = [str(t).strip().lower() for t in (parsed.get("tags") or []) if str(t).strip()]
    if not desc and not tags:
        return {}
    return {"description": desc, "tags": tags[:8]}


def _passage(asset, description: str, tags: List[str]) -> str:
    """The text that gets embedded.

    Includes the category and the site's own alt text alongside the generated description,
    because those are real signal the vision model does not see — a brand that labelled an
    image "AeroSync Qi2 charger" knows something the picture alone does not say.
    """
    parts = [description]
    if tags:
        parts.append("Tags: " + ", ".join(tags))
    if asset.category:
        parts.append(f"Category: {asset.category.replace('_', ' ')}")
    if asset.alt_text:
        parts.append(f"Site description: {asset.alt_text}")
    if asset.filename and not asset.filename.lower().startswith(("img_", "dsc", "screenshot")):
        parts.append(f"Filename: {asset.filename}")
    return "\n".join(p for p in parts if p)


async def index_workspace_assets(workspace_id: int, limit: int = 40,
                                 retag: bool = False) -> dict:
    """Describe and index this workspace's vault images.

    `retag=False` (the default) skips assets that already carry a description, so this is
    cheap to call repeatedly after a harvest — only new images cost a vision call.

    Runs sequentially rather than concurrently on purpose: the Gemini free tier is
    rate-limited per model, and firing forty vision calls at once gets most of them
    429'd and indexes nothing.
    """
    import models
    from database import SessionLocal
    from core import vector_store

    db = SessionLocal()
    try:
        q = (db.query(models.MediaAsset)
               .filter(models.MediaAsset.workspace_id == workspace_id))
        if not retag:
            q = q.filter(models.MediaAsset.description.is_(None))
        assets = q.order_by(models.MediaAsset.created_at.desc()).limit(limit).all()

        described, indexed, skipped = 0, 0, 0
        texts = []
        for a in assets:
            got = await describe_image(a.storage_url)
            if not got:
                skipped += 1
                continue
            a.description = got["description"]
            # Merge rather than overwrite: a tag someone added by hand outranks a generated
            # one and must survive a re-tag.
            existing = [t for t in (a.tags or []) if str(t).strip()]
            a.tags = list(dict.fromkeys(existing + got["tags"]))
            a.tagged_at = datetime.utcnow()
            described += 1
            texts.append({
                "content": _passage(a, got["description"], got["tags"]),
                "meta": {"asset_id": a.id, "asset_url": a.storage_url,
                         "category": a.category or "", "source_url": a.source_url or ""},
            })
        db.commit()

        if texts:
            # replace=False: assets accumulate, and re-tagging one image must not drop the
            # passages for every other image in the vault.
            indexed = vector_store.upsert(workspace_id, "media_asset", texts)
        return {"considered": len(assets), "described": described,
                "indexed": indexed, "skipped": skipped}
    finally:
        db.close()


def search_assets(workspace_id: int, query: str, limit: int = 12) -> List[dict]:
    """Vault images matching a natural-language query, best first.

    Returns [{asset_id, score, ...}] — the caller joins back to the asset rows so the
    response carries the same shape as the rest of the vault API.
    """
    from core import vector_store
    hits = vector_store.search(workspace_id, query, ["media_asset"], limit)
    out = []
    for h in hits:
        aid = h.get("asset_id")
        if aid is not None:
            out.append({"asset_id": int(aid), "score": h.get("score"),
                        "matched_on": (h.get("content") or "")[:220]})
    return out
