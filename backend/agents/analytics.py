import asyncio
from typing import TypedDict, List
from langgraph.graph import StateGraph, END
import os
from core.websocket import manager, current_workspace_id
from core.providers.llm_providers import GeminiProvider

# The AI Marketing Analyst persona. MVP scope (no live ad-platform data connected yet for
# most workspaces): act as an expert consultant, never a live analytics engine - it must
# never invent campaign numbers or claim access to a platform that isn't actually connected.
# The CONNECTED DATA block built in claude_recommendation_node is the ONLY source of truth
# for what's real; when Meta/Google Ads/GA4/Search Console get wired in for a workspace, that
# block starts carrying real figures automatically and this prompt needs no changes.
MARKETING_ANALYST_PROMPT = """You are Raftra's AI Marketing Analyst - an expert paid-advertising and marketing performance consultant embedded in the user's Analytics dashboard.

## Role
Act as an intelligent marketing consultant, not a live analytics engine. You have deep, practical expertise in:
- Meta Ads, Google Ads, and paid advertising platforms generally
- Core metrics and how they interrelate: CTR, CPC, CPM, CPA, ROAS, Frequency, Reach, Impressions, Conversions
- Campaign optimization, audience targeting, creative fatigue, bidding strategies, scaling campaigns, and attribution
- Explaining WHY a metric typically rises or falls, and what marketers usually do about it
- Troubleshooting marketing problems conversationally, and analyzing whatever data the user pastes or describes directly in the chat

## Hard rules - never break these
1. Never fabricate campaign numbers, account names, or performance data.
2. Never claim to have access to Meta Ads, Google Ads, GA4, Search Console, or any other live platform data for this workspace unless the "CONNECTED DATA" section below actually contains real figures for it. If that section says a platform isn't connected, do not describe or imply having seen its data.
3. Clearly distinguish, in your own wording, between general marketing knowledge/best practice (always available) and insights derived from this workspace's real connected data (only when CONNECTED DATA has real numbers).
4. If the user asks about their own account/campaign performance and no real data is connected, don't just refuse - respond naturally and offer the path forward, e.g. along the lines of: "I don't yet have access to your live advertising data. Connect your Meta Ads account (or paste/upload a campaign report) and I'll analyze performance, identify issues, explain why they're happening, and recommend optimizations." Still answer whatever part of their question you can with general expertise.
5. If the user pastes or describes their own numbers/table/CSV content directly in the chat, treat that as real data and analyze it specifically - just don't imply it came from a live API pull unless the CONNECTED DATA section says so.

## How to answer
Be conversational and specific, like a senior performance marketer talking to a founder - not a formal report. When explaining a metric change, cover likely causes and the standard corrective actions marketers take. Prefer a few concrete, actionable next steps over generic theory."""


async def _format_connected_data(workspace_id: int) -> str:
    """Real, current connection state for this workspace - the only thing the model is
    allowed to treat as live data. Extend this as more integrations go live (Google Ads,
    GA4, Search Console query data, etc.) - the prompt rules above already handle it
    correctly once real figures start showing up here, no other changes needed."""
    lines = []
    try:
        from database import SessionLocal
        import models
        with SessionLocal() as db:
            meta_conn = db.query(models.MetaAdsConnection).filter(
                models.MetaAdsConnection.workspace_id == workspace_id).first()
            gsc_conn = db.query(models.SearchConsoleConnection).filter(
                models.SearchConsoleConnection.workspace_id == workspace_id).first()
            gads_conn = db.query(models.GoogleAdsConnection).filter(
                models.GoogleAdsConnection.workspace_id == workspace_id).first()

        if meta_conn and meta_conn.access_token and meta_conn.ad_account_id:
            lines.append(await _meta_insights_summary(meta_conn))
        else:
            lines.append("Meta Ads: NOT CONNECTED - no live campaign data available.")

        if gads_conn and gads_conn.refresh_token and gads_conn.customer_id:
            lines.append(await _gads_insights_summary(gads_conn))
        else:
            lines.append("Google Ads: NOT CONNECTED - no live campaign data available.")

        if gsc_conn and gsc_conn.refresh_token and gsc_conn.site_url:
            lines.append("Google Search Console: connected (organic search data, not paid ads).")
        else:
            lines.append("Google Search Console: NOT CONNECTED.")

        lines.append("Google Analytics 4: NOT CONNECTED.")
    except Exception as e:
        lines.append(f"(Could not check connection status: {e})")
    return "\n".join(lines)


async def _meta_insights_summary(meta_conn) -> str:
    """Best-effort real Meta insights summary. Any failure here just means we report
    'connected but no data available' - never fall back to invented numbers."""
    try:
        from core import meta_ads as meta
        insights = await meta.fetch_insights(meta_conn, date_preset="last_7d")
        if not insights:
            return "Meta Ads: connected, but no delivery data for the last 7 days yet."
        rows = [
            f"- {v.get('campaign_name')}: spend {v.get('spend')}, impressions {v.get('impressions')}, "
            f"clicks {v.get('clicks')}, ctr {v.get('ctr')}%, roas {v.get('roas')}x, purchases {v.get('purchases')}"
            for v in list(insights.values())[:10]
        ]
        return "Meta Ads: CONNECTED - real data, last 7 days:\n" + "\n".join(rows)
    except Exception as e:
        return f"Meta Ads: connected, but could not fetch live insights right now ({e})."


async def _gads_insights_summary(gads_conn) -> str:
    """Best-effort real Google Ads insights summary. Mirrors _meta_insights_summary -
    any failure just reports 'connected but no data available', never invented numbers."""
    try:
        from core import google_ads as gads
        insights = await gads.fetch_insights(gads_conn, date_range="LAST_7_DAYS")
        if not insights:
            return "Google Ads: connected, but no delivery data for the last 7 days yet."
        rows = [
            f"- {v.get('campaign_name')}: cost {v.get('cost')}, impressions {v.get('impressions')}, "
            f"clicks {v.get('clicks')}, ctr {v.get('ctr')}%, roas {v.get('roas')}x, conversions {v.get('conversions')}"
            for v in list(insights.values())[:10]
        ]
        return "Google Ads: CONNECTED - real data, last 7 days:\n" + "\n".join(rows)
    except Exception as e:
        return f"Google Ads: connected, but could not fetch live insights right now ({e})."

class AnalyticsState(TypedDict):
    workspace_id: int
    query_message: str
    logs: List[str]
    current_node: str
    status: str
    explanation: str

async def collect_data_node(state: AnalyticsState) -> AnalyticsState:
    state["current_node"] = "Collect Data"
    msg = "Collecting adset spend metrics and revenue trends from DB..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Data Analyst", msg, "running")
    await manager.broadcast_node_update("analytics", "Collect Data", "running")
    await asyncio.sleep(1.0)
    return state

async def analyze_trends_node(state: AnalyticsState) -> AnalyticsState:
    state["current_node"] = "Analyze Trends"
    msg = "Parsing conversion rate patterns and CPC curves..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Data Analyst", msg, "thinking")
    await manager.broadcast_node_update("analytics", "Analyze Trends", "running")
    await asyncio.sleep(1.0)
    return state

async def claude_recommendation_node(state: AnalyticsState) -> AnalyticsState:
    state["current_node"] = "Claude Recommendation Engine"
    msg = "AI Marketing Analyst reasoning about the question..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Data Analyst", msg, "running")
    await manager.broadcast_node_update("analytics", "Claude Recommendation", "running")

    # Ground the answer in this company's real brand profile + knowledge base, and in the
    # real (not invented) connection/data status for this workspace.
    from core.brand_context import get_brand_context
    brand = get_brand_context(state["workspace_id"], query=state['query_message'])
    connected_data = await _format_connected_data(state["workspace_id"])
    prompt = (
        f"User question: {state['query_message']}\n\n"
        f"Brand context (tailor the answer to this business, audience and offerings):\n{brand}\n\n"
        f"CONNECTED DATA STATUS for this workspace (the only data you may treat as real/live):\n{connected_data}\n\n"
        f"Answer the user's question, following your rules about never fabricating data and "
        f"clearly separating general advice from real connected-data insights."
    )

    # On failure we must NOT invent numbers. The old fallback fabricated hard figures
    # ("CPA rose to $28.40", "ROAS 4.0x") that were indistinguishable from a real
    # analysis - a founder could act on made-up data. Fail the node instead.
    llm = GeminiProvider()
    response = await llm.generate_text(prompt=prompt, system_prompt=MARKETING_ANALYST_PROMPT)
    state["explanation"] = response.strip()
    return state

async def finalize_analytics_node(state: AnalyticsState) -> AnalyticsState:
    state["current_node"] = "Finalize Analytics"
    msg = "Analytics reports ready for dashboard display."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Data Analyst", msg, "completed")
    await manager.broadcast_node_update("analytics", "Finalize Analytics", "completed")
    state["status"] = "completed"
    return state

workflow = StateGraph(AnalyticsState)

workflow.add_node("collect_data", collect_data_node)
workflow.add_node("analyze_trends", analyze_trends_node)
workflow.add_node("claude_recommendation", claude_recommendation_node)
workflow.add_node("finalize_analytics", finalize_analytics_node)

workflow.set_entry_point("collect_data")
workflow.add_edge("collect_data", "analyze_trends")
workflow.add_edge("analyze_trends", "claude_recommendation")
workflow.add_edge("claude_recommendation", "finalize_analytics")
workflow.add_edge("finalize_analytics", END)

analytics_graph = workflow.compile()

async def run_analytics_pipeline(workspace_id: int, query_message: str):
    current_workspace_id.set(workspace_id)  # scope all broadcasts in this task to this workspace
    initial_state = {
        "workspace_id": workspace_id,
        "query_message": query_message,
        "logs": [],
        "current_node": "init",
        "status": "queued",
        "explanation": ""
    }
    await manager.broadcast_agent_log("Data Analyst", "Initializing Analytics pipeline...", "queued")
    from core.agent_status import record_agent_task
    record_agent_task(workspace_id, "ANALYST", "RUNNING", query_message[:80])
    try:
        result = await analytics_graph.ainvoke(initial_state)
        record_agent_task(workspace_id, "ANALYST", "COMPLETED", "Analytics recommendation ready")
    except Exception as e:
        await manager.broadcast_agent_log("Data Analyst", f"Analytics failed: {e}", "failed")
        record_agent_task(workspace_id, "ANALYST", "FAILED", str(e)[:120])
        raise
    return result
