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

async def generate_json(llm, prompt, system, model):
    response = await llm.generate_text(prompt, system_prompt=system, model_name=model)
    return response.replace('```json', '').replace('```', '').strip()

async def objective_budget_node(state: CampaignState) -> CampaignState:
    await manager.broadcast_agent_log("Budget Agent", "Analyzing historical CPA/CPM and mapping objective...", "running")
    llm = GeminiProvider() if "gemini" in state["model"].lower() else OpenRouterProvider()
    
    prompt = f"User Request: {state['prompt']}\nContext: {state['cached_context']}\nOutput a JSON object with 'objective' (e.g. Traffic, Conversions) and 'daily_budget' (number)."
    resp = await generate_json(llm, prompt, "You are a performance marketer determining campaign goals and budgets.", state["model"])
    
    try:
        data = json.loads(resp)
        state["objective"] = data.get("objective", "Conversions")
        state["budget"] = str(data.get("daily_budget", 50))
    except:
        state["objective"] = "Conversions"
        state["budget"] = "50"
    
    await manager.broadcast_agent_log("Budget Agent", f"Set Objective to {state['objective']} at ${state['budget']}/day.", "completed")
    return state

async def audience_placement_node(state: CampaignState) -> CampaignState:
    await manager.broadcast_agent_log("Audience Agent", "Building ICP, Lookalikes, and Placements...", "running")
    llm = GeminiProvider() if "gemini" in state["model"].lower() else OpenRouterProvider()
    
    prompt = f"User Request: {state['prompt']}\nContext: {state['cached_context']}\nOutput a JSON object with 'audience_targeting' (string describing demographics/interests) and 'placements' (array of strings like 'Instagram Reels', 'Facebook Feed')."
    resp = await generate_json(llm, prompt, "You are an audience and media buyer specialist.", state["model"])
    
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
        "Only fill the asset arrays the chosen type actually uses; leave the rest as []."
    )
    prompt = (
        f"Campaign brief from the user (may include business type, industry, product, goal, budget, "
        f"audience, location, season, website, landing page):\n{state['prompt']}\n\n"
        f"Business/brand context:\n{state['cached_context']}\n\n"
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
        '  "meta": {"primary_text": "... (1-2 sentences)", "headline": "... (max 40 chars)", "cta": "...", "placements": ["Instagram Reels","Facebook Feed"]},\n'
        '  "google": {\n'
        '    "headlines": ["... up to 15, max 30 chars each"],\n'
        '    "descriptions": ["... up to 4, max 90 chars each"],\n'
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
    )
    resp = await generate_json(llm, prompt, system, state["model"])

    brief: dict = {}
    try:
        brief = json.loads(resp) or {}
    except Exception:
        brief = {}

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

workflow = StateGraph(CampaignState)
workflow.add_node("context", fetch_campaign_context)
workflow.add_node("budget", objective_budget_node)
workflow.add_node("audience", audience_placement_node)
workflow.add_node("brief", creative_brief_node)
workflow.add_node("supervisor", supervisor_spec_node)

workflow.set_entry_point("context")
workflow.add_edge("context", "budget")
workflow.add_edge("budget", "audience")
workflow.add_edge("audience", "brief")
workflow.add_edge("brief", "supervisor")
workflow.add_edge("supervisor", END)

campaign_graph = workflow.compile()

async def run_campaign_planning_task(workspace_id: int, prompt: str, model: str = "gemini-2.5-flash"):
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
