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

async def creative_brief_node(state: CampaignState) -> CampaignState:
    """Everything the downstream setup screens need: channels, ad types, KPIs, keywords,
    Google Ads copy and how the total budget splits across platforms."""
    await manager.broadcast_agent_log("Creative Brief Agent", "Deriving channels, KPIs, keywords and ad copy...", "running")
    llm = GeminiProvider() if "gemini" in state["model"].lower() else OpenRouterProvider()

    prompt = (
        f"User Request: {state['prompt']}\nContext: {state['cached_context']}\n"
        f"Objective: {state['objective']}\nAudience: {state['audience']}\n\n"
        "Return ONLY a JSON object with these keys:\n"
        '  "channels": array of ad channels, e.g. ["Meta Ads","Google Ads"]\n'
        '  "ad_types": array, e.g. ["Image Ads","Carousel Ads","Stories"]\n'
        '  "kpis": array of 2-4 short measurable targets, e.g. ["CTR > 4%","CPA < 200"]\n'
        '  "top_keywords": array of 4-12 short keyword phrases\n'
        '  "google_headlines": array of up to 15 ad headlines (max 30 characters each)\n'
        '  "google_descriptions": array of up to 4 ad descriptions (max 90 characters each)\n'
        '  "duration_days": integer campaign length in days\n'
        '  "total_budget": number, the TOTAL campaign budget from the request\n'
        '  "meta_split_pct": integer 0-100, share of budget for Meta (remainder goes to Google)\n'
    )
    resp = await generate_json(llm, prompt, "You are a media planner writing a precise campaign brief.", state["model"])

    brief: dict = {}
    try:
        brief = json.loads(resp) or {}
    except Exception:
        brief = {}

    # Defensive defaults so the UI always has something real to render.
    brief.setdefault("channels", ["Meta Ads", "Google Ads"])
    brief.setdefault("ad_types", ["Image Ads", "Carousel Ads", "Stories"])
    brief.setdefault("kpis", ["CTR > 2%", "CPA within target"])
    brief.setdefault("top_keywords", [])
    brief.setdefault("google_headlines", [])
    brief.setdefault("google_descriptions", [])
    brief.setdefault("duration_days", 15)
    brief.setdefault("meta_split_pct", 70)

    state["brief"] = brief
    await manager.broadcast_agent_log(
        "Creative Brief Agent",
        f"Brief ready: {len(brief.get('top_keywords') or [])} keywords, "
        f"{len(brief.get('google_headlines') or [])} headlines.", "completed")
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
