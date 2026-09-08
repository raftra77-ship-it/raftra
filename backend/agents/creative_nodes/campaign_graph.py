import asyncio
import json
from typing import TypedDict
from langgraph.graph import StateGraph, END
from core.providers.llm_providers import GeminiProvider, OpenRouterProvider
from core.websocket import manager, current_workspace_id
from database import SessionLocal
import models

class CampaignState(TypedDict):
    workspace_id: int
    prompt: str
    model: str
    cached_context: str
    objective: str
    budget: str
    audience: str
    placement: str
    geo_targeting_level: str
    geo_locations: list
    brief: dict          # channels, ad types, KPIs, keywords, Google copy, budget split
    campaign_spec: str
    logs: list

async def fetch_campaign_context(state: CampaignState) -> CampaignState:
    msg = f"Fetching historical campaign performance & ICP for workspace {state['workspace_id']}..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("System", msg, "running")
    
    # Full brand context: profile + Qdrant knowledge base (was profile-only before).
    from core.brand_context import get_brand_context
    brand_context = get_brand_context(state['workspace_id'], query="advertising campaign objective and audience")
    state["cached_context"] = brand_context
    await manager.broadcast_agent_log("System", "Brand context loaded into Campaign RAG.", "completed")
    return state

_CURRENCY = {"IN": "₹ (INR)", "US": "$ (USD)", "GB": "£ (GBP)", "AE": "AED", "SG": "S$ (SGD)"}

# What a strategist has to know to plan for one market. Qualitative only: no CPMs, no
# conversion rates, no spend benchmarks - the model is told elsewhere never to invent
# numbers, and a "typical Indian CPM" would be exactly that.
_MARKET_NOTES = {
    "IN": (
        "MARKET: INDIA. Plan for this market specifically, not a generic global one.\n"
        "- Currency is the Indian Rupee. Every budget, bid and price you mention is in ₹.\n"
        "  Do not convert to dollars or quote dollar figures.\n"
        "- Buyers are price- and value-sensitive and compare heavily before purchase, so\n"
        "  offers, EMI availability, exchange/return terms and delivery promises carry real\n"
        "  weight in ad copy.\n"
        "- Payments: UPI is the default online method; cash on delivery still matters for\n"
        "  first-time buyers. Mention COD/UPI only if the brand's own context supports it.\n"
        "- Language: English works for metros, but Hinglish and regional languages (Hindi,\n"
        "  Tamil, Telugu, Marathi, Bengali) often outperform for tier-2/tier-3 reach.\n"
        "  Recommend language variants when the audience spans beyond metros.\n"
        "- Geography: distinguish metro/tier-1 from tier-2 and tier-3 cities - intent,\n"
        "  price expectation and creative style differ sharply between them.\n"
        "- Seasonality: the festive calendar dominates retail demand (Diwali, Navratri,\n"
        "  Dussehra, Raksha Bandhan, Holi, Eid, Pongal/Onam regionally), alongside the big\n"
        "  ecommerce sale events and end-of-season sales. If the brief names a season or\n"
        "  date, plan around the relevant one.\n"
        "- Platforms: Meta (Instagram Reels especially) and YouTube dominate reach;\n"
        "  WhatsApp is the normal place a purchase conversation continues, so a\n"
        "  Click-to-WhatsApp destination is often stronger than a web form.\n"
        "- Mobile-first and data-conscious: assume vertical video, fast-loading pages and\n"
        "  copy that reads on a small screen.\n"
    ),
}


def _market_context(state: "CampaignState") -> str:
    """Market guidance for the strategist prompts.

    The prompts carried no geography at all, so recommendations came back generic and
    dollar-denominated even though this product defaults to India. The country comes from
    the campaign's own geo targeting when the user set it, else DEFAULT_MARKET_COUNTRY.
    """
    import os
    country = (os.getenv("DEFAULT_MARKET_COUNTRY") or "IN").strip().upper()
    locations = [str(x) for x in (state.get("geo_locations") or []) if str(x).strip()]

    parts = [_MARKET_NOTES.get(country, "MARKET: %s. Plan for this market specifically." % country)]
    parts.append("Currency for all figures: %s." % _CURRENCY.get(country, country))
    if locations:
        parts.append("The user targeted these locations (%s): %s. Tailor audience, language "
                     "and creative to them rather than to the country as a whole."
                     % (state.get("geo_targeting_level") or "Country-Level", ", ".join(locations[:12])))
    return "\n".join(parts)


def _fit(text: str, limit: int) -> str:
    """Trim to `limit` characters on a word boundary, keeping it readable.

    The prompt states these limits plainly, but the model still overshoots — and an ad
    one character over is rejected by the platform exactly like one fifty over. Cutting
    at the last space (and dropping trailing punctuation) beats both shipping copy the
    platform will refuse and truncating mid-word.
    """
    t = " ".join(str(text or "").split())
    if len(t) <= limit:
        return t
    cut = t[:limit]
    if " " in cut[int(limit * 0.6):]:      # only back off to a space if one is near the end
        cut = cut[:cut.rfind(" ")]
    return cut.rstrip(" ,;:-")


def _enforce_copy_limits(brief: dict) -> None:
    """Bring generated ad copy inside the platform limits, in place.

    Silent by design: it runs on every generation and the review screen shows the final
    counts. The publish-time validators stay the backstop for anything still oversized.
    """
    meta = brief.get("meta")
    if isinstance(meta, dict):
        if meta.get("primary_text"):
            meta["primary_text"] = _fit(meta["primary_text"], 125)
        if meta.get("headline"):
            meta["headline"] = _fit(meta["headline"], 40)

    google = brief.get("google")
    if isinstance(google, dict):
        for key, limit in (("headlines", 30), ("descriptions", 90)):
            items = google.get(key)
            if isinstance(items, list):
                google[key] = [f for f in (_fit(x, limit) for x in items) if f]


async def generate_json(llm, prompt, system, model):
    response = await llm.generate_text(prompt, system_prompt=system, model_name=model)
    return response.replace('```json', '').replace('```', '').strip()

async def objective_budget_node(state: CampaignState) -> CampaignState:
    await manager.broadcast_agent_log("Budget Agent", "Analyzing historical CPA/CPM and mapping objective...", "running")
    llm = GeminiProvider() if "gemini" in state["model"].lower() else OpenRouterProvider()
    
    market = _market_context(state)
    prompt = (f"User Request: {state['prompt']}\nContext: {state['cached_context']}\n\n{market}\n\n"
              "Output a JSON object with 'objective' (e.g. Traffic, Conversions) and "
              "'daily_budget' (number, in the market currency above).")
    resp = await generate_json(llm, prompt,
                               "You are a performance marketer determining campaign goals and "
                               "budgets for the market described in the prompt.", state["model"])
    
    try:
        data = json.loads(resp)
        state["objective"] = data.get("objective", "Conversions")
        state["budget"] = str(data.get("daily_budget", 50))
    except:
        state["objective"] = "Conversions"
        state["budget"] = "50"
    
    # Was a hardcoded "$", which mislabelled every budget in a product that runs on rupees.
    import os as _os
    _sym = {"IN": "₹", "US": "$", "GB": "£"}.get(
        (_os.getenv("DEFAULT_MARKET_COUNTRY") or "IN").strip().upper(), "")
    await manager.broadcast_agent_log(
        "Budget Agent",
        f"Set Objective to {state['objective']} at {_sym}{state['budget']}/day.", "completed")
    return state

async def audience_placement_node(state: CampaignState) -> CampaignState:
    await manager.broadcast_agent_log("Audience Agent", "Building ICP, Lookalikes, and Placements...", "running")
    llm = GeminiProvider() if "gemini" in state["model"].lower() else OpenRouterProvider()
    
    prompt = (f"User Request: {state['prompt']}\nContext: {state['cached_context']}\n\n"
              f"{_market_context(state)}\n\n"
              "Output a JSON object with 'audience_targeting' (string describing demographics "
              "and interests, using segments that are meaningful in this market - including "
              "city tiers and language where relevant) and 'placements' (array of strings "
              "like 'Instagram Reels', 'Facebook Feed').")
    resp = await generate_json(llm, prompt,
                               "You are an audience and media buyer specialist for the market "
                               "described in the prompt.", state["model"])
    
    try:
        data = json.loads(resp)
        state["audience"] = data.get("audience_targeting", "Broad Audience")
        state["placement"] = ", ".join(data.get("placements", ["Auto Placements"]))
    except:
        state["audience"] = "Broad (18-65+)"
        state["placement"] = "Facebook, Instagram"
        
    await manager.broadcast_agent_log("Audience Agent", "Audience and placements mapped successfully.", "completed")
    return state

_GOOGLE_TYPES = {"Search", "Display", "Performance Max", "Shopping", "Demand Gen", "Video"}


async def creative_brief_node(state: CampaignState) -> CampaignState:
    """The reasoning core. Produces a *reasoned* strategy — every recommendation carries a
    plain-language WHY grounded in real best practice — plus the correct Google campaign
    TYPE and ONLY the assets that type needs, and Meta ad-copy fields."""
    await manager.broadcast_agent_log("Strategy Agent", "Reasoning about platforms, budget split, Google campaign type and creative...", "running")
    llm = GeminiProvider() if "gemini" in state["model"].lower() else OpenRouterProvider()

    system = (
        "You are a senior digital-marketing strategist. Apply real, current best practices for "
        "Meta Ads and Google Ads. EVERY recommendation MUST include a short, plain-language reason "
        "(the WHY) tied to the business, goal, audience, budget or search intent. Never invent "
        "statistics or facts; if unsure, explain the reasoning rather than fabricating numbers.\n\n"
        "Choose the Google campaign TYPE from goal + intent:\n"
        "- Search: people actively search for this product/service (high intent; leads/sales). NO images.\n"
        "- Display: awareness/retargeting across sites (visual, lower intent). Needs images.\n"
        "- Performance Max: goal-based automation across all Google inventory (ecommerce/conversions). Needs images + optional video.\n"
        "- Shopping: retail products with a product feed. Keywords not user-set.\n"
        "- Demand Gen: social-style discovery on YouTube/Discover/Gmail. Needs images + audience signals.\n"
        "- Video: awareness/consideration on YouTube. Needs video.\n"
        "Only fill the asset arrays the chosen type actually uses; leave the rest as [].\n\n"
        "Recommendations must be specific to the market described in the prompt - its "
        "currency, buying behaviour, languages, city tiers, seasonal calendar and the "
        "platforms people there actually use. A recommendation that would read identically "
        "for any country is not specific enough. Still never invent statistics: ground the "
        "WHY in the market's characteristics and the brand's own context, not in made-up "
        "benchmark numbers."
    )
    prompt = (
        f"Campaign brief from the user (may include business type, industry, product, goal, budget, "
        f"audience, location, season, website, landing page):\n{state['prompt']}\n\n"
        f"Business/brand context:\n{state['cached_context']}\n\n"
        f"{_market_context(state)}\n\n"
        f"Chosen objective: {state['objective']}\nAudience: {state['audience']}\n\n"
        "Return ONLY a JSON object with EXACTLY these keys:\n"
        "{\n"
        '  "recommendations": {\n'
        '    "objective": {"value": "...", "reason": "..."},\n'
        '    "platforms": [{"value": "Meta Ads", "reason": "..."}, {"value": "Google Ads", "reason": "..."}],\n'
        '    "budget_allocation": {"meta_pct": 60, "google_pct": 40, "reason": "..."},\n'
        '    "google_campaign_type": {"value": "Search", "reason": "..."},\n'
        '    "audience": {"value": "...", "reason": "..."},\n'
        '    "creative": {"value": "...", "reason": "..."},\n'
        '    "cta": {"value": "Shop Now", "reason": "..."},\n'
        '    "optimization_goal": {"value": "...", "reason": "..."}\n'
        "  },\n"
        '  "meta": {"primary_text": "... (ONE sentence, HARD LIMIT 125 characters)", "headline": "... (HARD LIMIT 40 characters)", "cta": "...", "placements": ["Instagram Reels","Facebook Feed"]},\n'
        '  "google": {\n'
        '    "headlines": ["... 8-15 items, HARD LIMIT 30 characters each"],\n'
        '    "descriptions": ["... 4 items, HARD LIMIT 90 characters each"],\n'
        '    "keywords": ["... 5-15 phrases; [] if type is Display/Video/Demand Gen"],\n'
        '    "extensions": ["Sitelink: ...","Callout: ..."; [] unless Search],\n'
        '    "image_ideas": ["short image descriptions; [] unless Display/Performance Max/Demand Gen"],\n'
        '    "video_ideas": ["short video concepts; [] unless Performance Max/Video"],\n'
        '    "audience_signals": ["...; [] unless Performance Max/Demand Gen"],\n'
        '    "cta": "..."\n'
        "  },\n"
        '  "kpis": ["2-4 measurable targets, e.g. CTR > 2%"],\n'
        '  "channels": ["Meta Ads","Google Ads"],\n'
        '  "ad_types": ["Image Ads","Carousel Ads"],\n'
        '  "duration_days": 15,\n'
        '  "total_budget": <total budget number from the request>\n'
        "}\n"
        "\n"
        "CHARACTER LIMITS ARE HARD PLATFORM RULES, NOT STYLE ADVICE. Google and Meta\n"
        "reject any ad whose copy exceeds them, so a campaign that breaks even one of\n"
        "these cannot be published at all:\n"
        "  - google.headlines    : 30 characters MAX, each\n"
        "  - google.descriptions : 90 characters MAX, each\n"
        "  - meta.headline       : 40 characters MAX\n"
        "  - meta.primary_text   : 125 characters MAX\n"
        "Count the characters of each one before answering, spaces and punctuation\n"
        "included, and rewrite anything over. Shorter is always fine; over is never.\n"
    )
    resp = await generate_json(llm, prompt, system, state["model"])

    brief: dict = {}
    try:
        brief = json.loads(resp) or {}
    except Exception:
        brief = {}

    _enforce_copy_limits(brief)

    rec = brief.get("recommendations") or {}
    google = brief.get("google") or {}
    meta = brief.get("meta") or {}

    # Normalise the Google campaign type to one we support.
    gtype = ((rec.get("google_campaign_type") or {}).get("value") or "Search").strip().title()
    if gtype not in _GOOGLE_TYPES:
        gtype = "Performance Max" if gtype.lower().startswith("perf") else "Search"
    rec.setdefault("google_campaign_type", {})
    rec["google_campaign_type"]["value"] = gtype

    # Budget split from the reasoned allocation (fall back to 70/30).
    ba = rec.get("budget_allocation") or {}
    try:
        meta_pct = int(ba.get("meta_pct", 70))
    except (TypeError, ValueError):
        meta_pct = 70
    meta_pct = max(0, min(100, meta_pct))

    # Back-compat fields the existing setup screens already read.
    brief["channels"] = brief.get("channels") or ["Meta Ads", "Google Ads"]
    brief["ad_types"] = brief.get("ad_types") or ["Image Ads", "Carousel Ads"]
    brief["kpis"] = brief.get("kpis") or ["CTR > 2%", "CPA within target"]
    brief["top_keywords"] = google.get("keywords") or []
    brief["google_headlines"] = google.get("headlines") or []
    brief["google_descriptions"] = google.get("descriptions") or []
    brief.setdefault("duration_days", 15)
    brief["meta_split_pct"] = meta_pct
    brief["recommendations"] = rec
    brief["google"] = google
    brief["google_campaign_type"] = gtype
    brief["meta"] = meta

    state["brief"] = brief
    await manager.broadcast_agent_log(
        "Strategy Agent",
        f"Reasoned strategy ready — Google type: {gtype}, budget split {meta_pct}/{100 - meta_pct} Meta/Google, "
        f"{len(brief['google_headlines'])} headlines.", "completed")
    return state


def _to_float(v, default=0.0) -> float:
    try:
        return float(str(v).replace(",", "").replace("₹", "").strip())
    except Exception:
        return default


async def supervisor_spec_node(state: CampaignState) -> CampaignState:
    await manager.broadcast_agent_log("Supervisor", "Merging node outputs into final Campaign JSON Spec...", "running")

    import datetime as _dt
    brief = state.get("brief") or {}

    # Budget split across platforms, derived from the total the user asked for.
    total = _to_float(brief.get("total_budget"), 0.0)
    if total <= 0:
        total = _to_float(state["budget"], 0.0) * float(brief.get("duration_days", 15) or 15)
    meta_pct = int(brief.get("meta_split_pct", 70) or 70)
    meta_pct = max(0, min(100, meta_pct))
    google_pct = 100 - meta_pct
    meta_amt = round(total * meta_pct / 100.0, 2)
    google_amt = round(total - meta_amt, 2)

    days = int(brief.get("duration_days", 15) or 15)
    start = _dt.date.today()
    end = start + _dt.timedelta(days=days)

    spec = {
        "campaign_name": f"AI Campaign - {state['objective']}",
        "objective": state["objective"],
        "daily_budget": state["budget"],
        "audience": state["audience"],
        "placements": state["placement"],
        # Passed through verbatim from the user's form input - never re-derived by an LLM
        # from prose, so the exact geography picked can't drift during strategy generation.
        "geo_targeting": {
            "level": state.get("geo_targeting_level") or "Country-Level",
            "locations": state.get("geo_locations") or [],
        },
        # ---- richer plan used by the setup screens ----
        "total_budget": total,
        "budget_split": {
            "meta": {"pct": meta_pct, "amount": meta_amt},
            "google": {"pct": google_pct, "amount": google_amt},
        },
        "channels": brief.get("channels"),
        "ad_types": brief.get("ad_types"),
        "kpis": brief.get("kpis"),
        "top_keywords": brief.get("top_keywords"),
        "google_headlines": brief.get("google_headlines"),
        "google_descriptions": brief.get("google_descriptions"),
        "duration_days": days,
        "duration_label": f"{start.strftime('%d %b')} - {end.strftime('%d %b %Y')} ({days} Days)",
        # ---- reasoned strategy (the "Why AI Recommended This" + dynamic Google type) ----
        "recommendations": brief.get("recommendations") or {},
        "google_campaign_type": brief.get("google_campaign_type") or "Search",
        "google": brief.get("google") or {},
        "meta": brief.get("meta") or {},
        "status": "pending_review",
    }

    state["campaign_spec"] = json.dumps(spec)
    await manager.broadcast_agent_log("Supervisor", "Campaign Spec Ready for Human Review.", "completed")
    return state

async def objective_and_audience_node(state: CampaignState) -> CampaignState:
    """Runs the budget and audience LLM calls concurrently.

    These two are independent - audience_placement_node reads only 'prompt' and
    'cached_context', never the objective/budget the other one produces - so running
    them in sequence just added a whole extra LLM round-trip to the user's wait.
    They write disjoint keys of the same state dict, so sharing it is safe.
    """
    await asyncio.gather(
        objective_budget_node(state),
        audience_placement_node(state),
    )
    return state


workflow = StateGraph(CampaignState)
workflow.add_node("context", fetch_campaign_context)
workflow.add_node("plan", objective_and_audience_node)
workflow.add_node("brief", creative_brief_node)
workflow.add_node("supervisor", supervisor_spec_node)

workflow.set_entry_point("context")
workflow.add_edge("context", "plan")
workflow.add_edge("plan", "brief")
workflow.add_edge("brief", "supervisor")
workflow.add_edge("supervisor", END)

campaign_graph = workflow.compile()

async def run_campaign_planning_task(workspace_id: int, prompt: str, model: str = "gemini-2.5-flash",
                                     geo_targeting_level: str = None, geo_locations: list = None):
    current_workspace_id.set(workspace_id)  # scope all broadcasts in this task to this workspace
    initial_state = {
        "workspace_id": workspace_id,
        "prompt": prompt,
        "model": model,
        "cached_context": "",
        "objective": "",
        "budget": "",
        "audience": "",
        "placement": "",
        "geo_targeting_level": geo_targeting_level or "",
        "geo_locations": geo_locations or [],
        "brief": {},
        "campaign_spec": "",
        "logs": []
    }
    
    await manager.broadcast_agent_log("System", "Initializing AI Campaign Manager Workflow...", "queued")

    from core.agent_status import record_agent_task
    record_agent_task(workspace_id, "CAMPAIGN", "RUNNING", prompt[:80])

    try:
        result = await campaign_graph.ainvoke(initial_state)
        spec = json.loads(result["campaign_spec"])

        # Auto-generate an image ad from the strategy (Pollinations returns a URL
        # instantly, no API key). Shown in the Campaign Manager; the user can open
        # Creative Studio to generate more.
        image_url = None
        try:
            from core.providers.image_providers import FluxSchnellProvider
            img_prompt = (
                f"Advertising creative for: {prompt[:140]}. "
                f"{spec.get('objective', '')} campaign for {spec.get('audience', '')}. "
                f"Commercial ad photography, vibrant, high detail, no text."
            )
            image_url = await FluxSchnellProvider().generate_image(img_prompt, aspect_ratio="1:1")
        except Exception as e:
            print(f"Campaign image generation failed: {e}")

        # Persist the plan (audience/placements live in metrics; the model has no
        # columns for them). send_personal_message no longer exists on the manager,
        # so broadcast (scoped to this workspace by the contextvar set above) instead.
        campaign_id = 0
        try:
            with SessionLocal() as db:
                m = dict(spec)
                if image_url:
                    m["image_url"] = image_url
                camp = models.Campaign(
                    workspace_id=workspace_id,
                    platform="Meta / Google",
                    name=spec.get("campaign_name", "AI Campaign"),
                    objective=spec.get("objective", ""),
                    budget=float(spec.get("daily_budget", 0) or 0),
                    status="PENDING_REVIEW",
                    metrics=m,
                )
                db.add(camp)
                db.commit()
                db.refresh(camp)
                campaign_id = camp.id
        except Exception as e:
            print(f"Failed to save Campaign: {e}")

        await manager.broadcast(json.dumps({
            "type": "campaign_spec_generated",
            "campaign_id": campaign_id,
            "spec": result["campaign_spec"],
            "image_url": image_url,
        }))
        record_agent_task(workspace_id, "CAMPAIGN", "COMPLETED", f"Campaign plan ready: {spec.get('campaign_name', '')[:60]}")
    except Exception as e:
        await manager.broadcast_agent_log("Campaign Agent", f"Campaign generation failed: {e}", "failed")
        record_agent_task(workspace_id, "CAMPAIGN", "FAILED", str(e)[:120])
