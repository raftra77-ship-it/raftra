"""
The multi-tenant hybrid retrieval layer.

Two stores, and the split between them is the whole design:

  Postgres  exact facts - hex codes, font names, logo URLs, USPs, the founding year.
            A brief that says "use #FF6B00" must be right, and approximate nearest
            neighbours cannot promise that. These are looked up, never retrieved.

  Qdrant    judgement - what rivals are running, which search intents are rising, which
            creative patterns are landing. There is no key to look these up by; the
            question is semantic and so is the index.

Tenancy is enforced on the vector side by a mandatory workspace_id filter built here
rather than passed in by callers, so there is one place to audit and no route can forget
it. The relational side is already scoped by the workspace check in the route.
"""
import re
from typing import List

from core.intel_sync import KIND_AD, KIND_TREND

# Payload type written by onboarding. Named here so the three kinds are visible together.
KIND_BRAND = "onboarding_scrape"

_TOKEN_QUERY_RE = re.compile(
    r"\b(colou?r|hex|palette|font|typeface|typography|logo|swatch|brand kit|design token|"
    r"rgb|css|mark|wordmark)\b", re.I)
_AD_QUERY_RE = re.compile(
    r"\b(competitor|rival|ad library|their ads?|offers?|discount|coupon|hook|creative|"
    r"blue ocean|red ocean|fatigue|running|angle)\b", re.I)
_TREND_QUERY_RE = re.compile(
    r"\b(trend|search|keyword|volume|seasonal|festive|demand|rising|shorts?|viral|"
    r"interest|market)\b", re.I)


def route(query: str) -> dict:
    """Which stores this question needs.

    Deliberately keyword-based rather than an LLM call: routing is cheap and reversible,
    and spending a model round-trip to decide whether to spend a model round-trip is a
    poor trade. When nothing matches, everything is consulted - a wrong "no" costs the
    user an answer, a wrong "yes" costs a few hundred tokens.
    """
    tokens = bool(_TOKEN_QUERY_RE.search(query or ""))
    ads = bool(_AD_QUERY_RE.search(query or ""))
    trends = bool(_TREND_QUERY_RE.search(query or ""))
    if not (tokens or ads or trends):
        return {"brand_kit": True, "brand_kb": True, "ads": True, "trends": True}
    return {"brand_kit": True, "brand_kb": not (ads or trends) or tokens,
            "ads": ads, "trends": trends}


# ------------------------------------------------------------------ relational side

def brand_facts(workspace_id: int) -> dict:
    """Exact, non-negotiable brand values, straight from Postgres."""
    from database import SessionLocal
    import models

    with SessionLocal() as db:
        ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
        bp = (db.query(models.BrandProfile)
                .filter(models.BrandProfile.workspace_id == workspace_id).first())
        if not ws:
            return {}
        guidelines = (bp.guidelines if bp else None) or {}
        return {
            "name": ws.name or "",
            "url": ws.company_url or "",
            "color_tokens": (bp.color_tokens if bp else None) or [],
            "color_palette": (bp.color_palette if bp else None) or [],
            "typography": (bp.typography if bp else None) or {},
            "logos": (bp.logos if bp else None) or [],
            "usps": guidelines.get("usps") or "",
            "mission": guidelines.get("slogan") or "",
            "positioning": guidelines.get("competitive") or "",
            "tone_of_voice": guidelines.get("tone_of_voice") or [],
            "personality": guidelines.get("personality") or "",
            "target_audiences": guidelines.get("target_audiences") or [],
            "audience": (bp.target_audience if bp else "") or "",
            "categories": guidelines.get("categories") or [],
        }


def format_brand_kit(facts: dict) -> str:
    """Render exact facts as text a model can quote verbatim."""
    if not facts:
        return ""
    lines = ["BRAND KIT (exact values - reproduce these literally, do not paraphrase):"]
    if facts.get("name"):
        lines.append("Brand: %s%s" % (facts["name"], " (%s)" % facts["url"] if facts.get("url") else ""))
    for t in (facts.get("color_tokens") or [])[:8]:
        lines.append("Colour: %s %s - %s" % (t.get("name", ""), t.get("hex", ""), t.get("role", "")))
    if not facts.get("color_tokens") and facts.get("color_palette"):
        lines.append("Colours: " + ", ".join(facts["color_palette"][:8]))
    if facts.get("typography"):
        lines.append("Typography: " + ", ".join("%s = %s" % (k, v) for k, v in facts["typography"].items()))
    for logo in (facts.get("logos") or [])[:3]:
        if logo.get("url"):
            lines.append("Logo (%s, %s): %s" % (logo.get("type", ""), logo.get("format", ""), logo["url"]))
    if facts.get("mission"):
        lines.append("Mission/slogan: " + facts["mission"])
    if facts.get("positioning"):
        lines.append("Positioning: " + facts["positioning"])
    if facts.get("usps"):
        lines.append("USPs:\n" + str(facts["usps"]))
    if facts.get("tone_of_voice"):
        lines.append("Tone of voice: " + ", ".join(str(t) for t in facts["tone_of_voice"]))
    if facts.get("personality"):
        lines.append("Personality: " + str(facts["personality"]))
    if facts.get("audience"):
        lines.append("Audience: " + facts["audience"])
    for p in (facts.get("target_audiences") or [])[:4]:
        lines.append("Persona: %s - hook: %s" % (p.get("persona", ""), p.get("hook", "")))
    if facts.get("categories"):
        lines.append("Product categories: " + ", ".join(str(c) for c in facts["categories"]))
    return "\n".join(lines)


# ---------------------------------------------------------------------- vector side

def retrieve(workspace_id: int, query: str, kinds: List[str], limit: int = 5) -> List[dict]:
    """Semantic search within ONE workspace, restricted to the given payload kinds.

    The workspace filter is built here and is not optional - a caller cannot pass a filter
    that omits it, which is what keeps one tenant's ad vault out of another's answers.
    Returns [] rather than raising: an answer grounded in the brand kit alone still beats
    a 500 when Qdrant is unreachable.
    """
    if not kinds:
        return []
    try:
        from database import qdrant_client
        from qdrant_client.models import Filter, FieldCondition, MatchValue, MatchAny
        from core.embeddings import embed_query, ensure_collection, COLLECTION_NAME

        ensure_collection(qdrant_client)
        resp = qdrant_client.query_points(
            collection_name=COLLECTION_NAME,
            query=embed_query(query),
            query_filter=Filter(must=[
                FieldCondition(key="workspace_id", match=MatchValue(value=workspace_id)),
                FieldCondition(key="type", match=MatchAny(any=list(kinds))),
            ]),
            limit=limit,
        )
        out = []
        for point in resp.points:
            payload = point.payload or {}
            if (payload.get("content") or "").strip():
                out.append({"content": payload["content"], "type": payload.get("type", ""),
                            "source_url": payload.get("source_url", ""),
                            "competitor": payload.get("competitor", ""),
                            "score": getattr(point, "score", None)})
        return out
    except Exception as e:
        print("[rag] retrieval failed for workspace %s: %s" % (workspace_id, e))
        return []


def build_context(workspace_id: int, query: str, include_ads: bool = True,
                  include_trends: bool = True, kb_limit: int = 4) -> dict:
    """Assemble the grounded context for one question. Returns the text plus the passages
    it was built from, so an answer can always be traced back."""
    plan = route(query)
    if not include_ads:
        plan["ads"] = False
    if not include_trends:
        plan["trends"] = False

    facts = brand_facts(workspace_id) if plan["brand_kit"] else {}
    kinds: List[str] = []
    if plan["brand_kb"]:
        kinds.append(KIND_BRAND)
    if plan["ads"]:
        kinds.append(KIND_AD)
    if plan["trends"]:
        kinds.append(KIND_TREND)

    passages = retrieve(workspace_id, query, kinds, limit=kb_limit + len(kinds))

    blocks = []
    kit_text = format_brand_kit(facts)
    if kit_text:
        blocks.append(kit_text)

    labels = {KIND_BRAND: "BRAND SITE CONTENT", KIND_AD: "COMPETITOR ADS (live, from the ad library)",
              KIND_TREND: "MARKET & SEARCH TRENDS"}
    for kind in kinds:
        chunk = [p for p in passages if p["type"] == kind]
        if chunk:
            blocks.append("%s:\n%s" % (labels.get(kind, kind.upper()),
                                       "\n".join("- " + p["content"][:600] for p in chunk)))

    return {"context": "\n\n".join(blocks), "routed": plan,
            "facts": facts, "passages": passages}


_ANSWER_PROMPT = """Answer the question using ONLY the grounded context below.

Rules:
- Exact values in the BRAND KIT block (hex codes, font names, logo URLs) must be
  reproduced literally. Never invent or adjust one.
- Competitor and trend claims must come from the blocks below. If the context does not
  cover something the question asks for, say so plainly rather than filling the gap.
- Be concrete and brief. If the answer is a creative brief, make it producible.

GROUNDED CONTEXT:
{context}

QUESTION: {query}
"""


async def answer_intelligence_query(workspace_id: int, query: str, include_ads: bool = True,
                                    include_trends: bool = True) -> dict:
    """The end of the pipeline: retrieve, ground, answer, and hand back the sources."""
    from core.providers.llm_providers import GeminiProvider

    built = build_context(workspace_id, query, include_ads, include_trends)
    if not built["context"].strip():
        return {"answer": "", "routed": built["routed"], "sources": [],
                "note": "This workspace has no brand kit, ad vault or trend data yet. "
                        "Run brand onboarding, then sync competitor ads and market trends."}

    answer = await GeminiProvider().generate_text(
        _ANSWER_PROMPT.format(context=built["context"][:14000], query=query),
        system_prompt="You are a growth strategist who never invents facts.")

    return {
        "answer": (answer or "").strip(),
        "routed": built["routed"],
        "sources": [{"type": p["type"], "url": p.get("source_url", ""),
                     "competitor": p.get("competitor", ""),
                     "excerpt": p["content"][:200]} for p in built["passages"]],
    }


def intelligence_context(workspace_id: int, query: str = "", limit: int = 3) -> str:
    """A compact grounded block for the OTHER agents (creative, campaign, social) to prefix
    onto their own prompts. Never raises - a laggy store degrades the brief, it does not
    break the agent."""
    try:
        return build_context(workspace_id, query or "brand positioning, live competitor "
                                                    "angles and rising search demand",
                             kb_limit=limit)["context"]
    except Exception as e:
        print("[rag] intelligence_context failed for workspace %s: %s" % (workspace_id, e))
        return ""
