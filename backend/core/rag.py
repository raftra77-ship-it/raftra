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

def _as_list(value) -> list:
    """A list, whether the stored value was already one or a comma-joined display string."""
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    if isinstance(value, str):
        return [p.strip() for p in value.split(",") if p.strip()]
    return []


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
            # Falls back to "tone". kit_to_guidelines writes both now, but every brand
            # onboarded before that fix has only "tone" stored, and without this fallback
            # they would keep generating copy with no tone guidance until someone happened
            # to re-run Sync Knowledge Graph.
            #
            # _as_list matters here: "tone" is a comma-joined DISPLAY string, and
            # format_brand_kit iterates this value. Handed the raw string it iterated
            # characters and emitted "Tone of voice: D, i, r, e, c, t, ...".
            "tone_of_voice": _as_list(guidelines.get("tone_of_voice")
                                      or guidelines.get("tone")),
            "personality": guidelines.get("personality") or "",
            "target_audiences": guidelines.get("target_audiences") or [],
            "audience": (bp.target_audience if bp else "") or "",
            "categories": guidelines.get("categories") or [],
            # Structured layer. Absent for brands onboarded before it existed, which is why
            # every consumer below is written to skip what is missing rather than assume it.
            "industry": guidelines.get("industry") or "",
            "value_proposition": guidelines.get("value_proposition") or "",
            "structured_usps": guidelines.get("structured_usps") or [],
            "catalogue": guidelines.get("catalogue") or [],
            "jobs_to_be_done": guidelines.get("jobs_to_be_done") or [],
            "voice": guidelines.get("voice") or {},
            "messaging": guidelines.get("messaging") or {},
            "positioning_signals": guidelines.get("positioning_signals") or {},
            "verified_claims": guidelines.get("verified_claims") or [],
            "unsupported_topics": guidelines.get("unsupported_topics") or [],
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
    # Personas: the whole segment when the richer shape is stored, so an agent asked
    # "what objection does this group have" has an answer instead of improvising one.
    # Falls back to the old persona/hook pair for brands onboarded before the change.
    for p in (facts.get("target_audiences") or [])[:5]:
        bits = ["Persona: %s" % p.get("persona", "")]
        for label, key in (("need", "need"), ("motivation", "buying_motivation"),
                           ("angle", "messaging_angle"), ("hook", "hook")):
            if p.get(key):
                bits.append("%s: %s" % (label, p[key]))
        for label, key in (("pain points", "pain_points"), ("objections", "objections"),
                           ("buys", "categories")):
            if p.get(key):
                bits.append("%s: %s" % (label, "; ".join(str(x) for x in p[key][:4])))
        lines.append(" | ".join(bits))

    if facts.get("categories"):
        lines.append("Product categories: " + ", ".join(str(c) for c in facts["categories"]))

    # ---- structured layer, each block skipped entirely when absent
    if facts.get("value_proposition"):
        lines.append("Value proposition: " + facts["value_proposition"])
    if facts.get("industry"):
        lines.append("Industry: " + facts["industry"])

    for u in (facts.get("structured_usps") or [])[:8]:
        ev = u.get("evidence") or {}
        lines.append(
            "Differentiator: %s | feature: %s | benefit: %s | for: %s | angle: %s%s"
            % (u.get("name", ""), u.get("feature", ""), u.get("benefit", ""),
               u.get("audience", ""), u.get("messaging_angle", ""),
               " | source: %s" % ev["source_url"] if ev.get("source_url") else ""))

    for c in (facts.get("catalogue") or [])[:8]:
        lines.append(
            "Category: %s | products: %s | benefit: %s | for: %s%s"
            % (c.get("name", ""), ", ".join(str(x) for x in (c.get("products") or [])[:6]),
               c.get("benefit", ""), c.get("audience", ""),
               " | price: %s" % c["price_range"] if c.get("price_range") else ""))

    for j in (facts.get("jobs_to_be_done") or [])[:5]:
        lines.append("Job to be done: %s -> %s -> wants: %s -> brand answers with: %s"
                     % (j.get("situation", ""), j.get("problem", ""),
                        j.get("desired_outcome", ""), j.get("brand_response", "")))

    voice = facts.get("voice") or {}
    if voice.get("traits"):
        lines.append("VOICE (write in this voice, do not describe it):")
        for t in voice["traits"][:5]:
            lines.append("  - %s: sounds like %s. e.g. \"%s\". Avoid: %s"
                         % (t.get("trait", ""), t.get("sounds_like", ""),
                            t.get("example", ""), t.get("avoid", "")))
    for label, key in (("Formality", "formality"), ("Energy", "energy"),
                       ("Sentence style", "sentence_style"), ("CTA style", "cta_style")):
        if voice.get(key):
            lines.append("%s: %s" % (label, voice[key]))
    if voice.get("use_words"):
        lines.append("Prefer these words: " + ", ".join(str(w) for w in voice["use_words"][:12]))
    if voice.get("avoid_words"):
        lines.append("Never use these words: " + ", ".join(str(w) for w in voice["avoid_words"][:12]))

    msg = facts.get("messaging") or {}
    if msg.get("core_message"):
        lines.append("Core message: " + msg["core_message"])
    for sm in (msg.get("supporting") or [])[:6]:
        lines.append("  Supporting: %s (proof: %s)"
                     % (sm.get("message", ""), ", ".join(str(p) for p in (sm.get("proof_points") or [])[:4])))
    if msg.get("angles"):
        lines.append("Messaging angles: " + " | ".join(str(a) for a in msg["angles"][:6]))

    sig = facts.get("positioning_signals") or {}
    axes = [f"{k}: {v}" for k, v in sig.items() if k != "basis" and v]
    if axes:
        lines.append("Positioning signals (%s): %s" % (sig.get("basis", "inferred"), ", ".join(axes)))

    # The two lists that keep generated copy out of trouble.
    if facts.get("verified_claims"):
        lines.append("SAFE TO CLAIM (the site states these):")
        lines.extend("  - %s" % c for c in facts["verified_claims"][:10])
    if facts.get("unsupported_topics"):
        lines.append("DO NOT CLAIM (nothing in this brand's content supports these):")
        lines.extend("  - %s" % c for c in facts["unsupported_topics"][:10])

    return "\n".join(lines)


# ---------------------------------------------------------------------- vector side

def retrieve(workspace_id: int, query: str, kinds: List[str], limit: int = 5) -> List[dict]:
    """Semantic search within ONE workspace, restricted to the given payload kinds.

    The workspace filter is applied inside core.vector_store and is not a caller argument
    that can be omitted, which is what keeps one tenant's ad vault out of another's answers.
    Returns [] rather than raising: an answer grounded in the brand kit alone still beats
    a 500 when the vector store is unreachable.

    The store itself moved behind core.vector_store, which defaults to pgvector. Talking
    straight to Qdrant from here meant retrieval only worked where Qdrant was running,
    which was nowhere but a local docker-compose — see that module's header.
    """
    if not kinds:
        return []
    from core import vector_store

    hits = vector_store.search(workspace_id, query, list(kinds), limit)
    out = []
    for h in hits:
        if (h.get("content") or "").strip():
            out.append({"content": h["content"], "type": h.get("type", ""),
                        "source_url": h.get("source_url", ""),
                        "competitor": h.get("competitor", ""),
                        "score": h.get("score")})
    return out


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
