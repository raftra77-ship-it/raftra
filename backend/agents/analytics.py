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

        # Was hardcoded to NOT CONNECTED. GA4 rides on the same Google grant as Search
        # Console, so the property id on that row is what decides it.
        if gsc_conn and gsc_conn.refresh_token and getattr(gsc_conn, "ga4_property_id", None):
            lines.append(f"Google Analytics 4: connected (property {gsc_conn.ga4_property_id}).")
        else:
            lines.append("Google Analytics 4: NOT CONNECTED.")

        # This workspace's own stored results. Without these the agent could not answer
        # "what is my latest SEO score" about data the dashboard was showing on the same page.
        lines.append(_workspace_data_summary(workspace_id))
    except Exception as e:
        lines.append(f"(Could not check connection status: {e})")
    return "\n".join(lines)


def _workspace_data_summary(workspace_id: int) -> str:
    """Audits, campaigns, creatives, competitors and schedules held for this workspace.

    These are results the product produced itself, as opposed to the connector sections
    above which depend on an external platform being linked. Everything here is measured or
    stored - the prompt's rule against inventing figures still applies to anything absent.
    """
    from database import SessionLocal
    import models

    out = []
    try:
        with SessionLocal() as db:
            # ── audits, split by pipeline ────────────────────────────────────────
            # SEO and GEO answer different questions and move independently, so an average
            # across both tells the user nothing they can act on.
            audits = (db.query(models.SEOAudit)
                        .filter(models.SEOAudit.workspace_id == workspace_id)
                        .order_by(models.SEOAudit.created_at.desc())
                        .all())

            def _pipeline(a) -> str:
                try:
                    return ((a.keywords_data or {}).get("pipeline") or "SEO").upper()
                except Exception:
                    return "SEO"

            def _is_demo(a) -> bool:
                try:
                    return bool((a.keywords_data or {}).get("demo"))
                except Exception:
                    return False

            if audits:
                # Spelled out because the model otherwise reads "GEO" as geographical
                # targeting and gives location-based advice for an AI-visibility score.
                out.append("Note: GEO here means Generative Engine Optimization - how "
                           "visible and accurately described this brand is inside AI "
                           "assistants and AI search answers. It is not geographic targeting.")
                for name in ("SEO", "GEO"):
                    runs = [a for a in audits if _pipeline(a) == name and a.score is not None]
                    if not runs:
                        out.append(f"{name} audits: none recorded.")
                        continue
                    latest = runs[0]
                    when = latest.created_at.strftime("%d %b %Y") if latest.created_at else "an unknown date"
                    line = (f"{name} audits: {len(runs)} recorded. Latest {latest.score}/100 on {when}.")
                    trail = ", ".join(str(a.score) for a in reversed(runs[:8]))
                    if len(runs) > 1:
                        line += f" Recent scores oldest-first: {trail}."
                    demo = sum(1 for a in runs if _is_demo(a))
                    if demo:
                        # Flagged because these did not come from crawling the real site;
                        # treating them as measurements would skew any trend the agent reads.
                        line += f" {demo} of these were demo-mode runs, not real crawls."
                    out.append(line)

                newest = audits[0]
                if newest.recommendation:
                    out.append(f"  Latest audit recommendation: {str(newest.recommendation)[:500]}")
            else:
                out.append("SEO/GEO audits: none recorded yet.")

            # ── campaigns, individually ──────────────────────────────────────────
            campaigns = (db.query(models.Campaign)
                           .filter(models.Campaign.workspace_id == workspace_id).all())
            if campaigns:
                by_status = {}
                for camp in campaigns:
                    key = (camp.status or "UNKNOWN").lower()
                    by_status[key] = by_status.get(key, 0) + 1
                spread = ", ".join(f"{n} {s}" for s, n in sorted(by_status.items()))
                budget = sum(float(camp.budget or 0) for camp in campaigns)
                out.append(f"Campaigns: {len(campaigns)} ({spread}). Total budget booked: {budget:,.2f}.")

                top = sorted(campaigns, key=lambda x: float(x.budget or 0), reverse=True)[:10]
                for camp in top:
                    bits = [f"  - {camp.name or 'Untitled'} ({camp.platform or 'no platform'})",
                            f"status {(camp.status or 'unknown').lower()}",
                            f"budget {float(camp.budget or 0):,.2f}"]
                    if camp.objective:
                        bits.append(f"objective {camp.objective}")
                    # roas defaults to 0 and is only meaningful once a platform reports back,
                    # so it is stated as stored rather than presented as measured return.
                    if camp.roas:
                        bits.append(f"stored ROAS {camp.roas}x")
                    out.append(", ".join(bits) + ".")
                if len(campaigns) > len(top):
                    out.append(f"  ({len(campaigns) - len(top)} further campaigns not listed.)")
            else:
                out.append("Campaigns: none created yet.")

            creatives = (db.query(models.AdAsset)
                           .filter(models.AdAsset.workspace_id == workspace_id).count())
            out.append(f"Generated ad creatives: {creatives}.")

            # ── competitor research ──────────────────────────────────────────────
            comps = (db.query(models.CompetitorReport)
                       .filter(models.CompetitorReport.workspace_id == workspace_id)
                       .order_by(models.CompetitorReport.updated_at.desc())
                       .limit(5).all())
            if comps:
                out.append(f"Competitors researched ({len(comps)}):")
                for r in comps:
                    line = f"  - {r.competitor}"
                    if r.positioning:
                        line += f": {str(r.positioning)[:220]}"
                    out.append(line)
                    offers = (r.offers or [])[:3]
                    if offers:
                        out.append(f"      offers: {'; '.join(str(o) for o in offers)}")
            else:
                out.append("Competitors researched: none yet.")

            # ── scheduled runs ───────────────────────────────────────────────────
            schedules = (db.query(models.ScheduledTask)
                           .filter(models.ScheduledTask.workspace_id == workspace_id).all())
            if schedules:
                enabled = sum(1 for s in schedules if s.enabled)
                out.append(f"Scheduled agent runs: {len(schedules)} ({enabled} enabled).")
                for s in schedules[:5]:
                    line = f"  - {s.name} ({s.agent}, {s.cadence})"
                    if s.last_status:
                        line += f", last run {s.last_status}"
                        if s.last_status == "failed" and s.last_message:
                            line += f": {str(s.last_message)[:160]}"
                    out.append(line + ".")
            else:
                out.append("Scheduled agent runs: none.")
    except Exception as e:
        return f"(Could not read stored workspace data: {e})"

    return "\n".join(out)


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
        # A manager (MCC) account has no campaigns of its own, so a metrics query against it
        # always fails with "invalid argument". Reporting that as a generic fetch failure
        # sends people looking for an outage instead of changing the selected account.
        if getattr(gads_conn, "customer_is_manager", False):
            return ("Google Ads: connected, but the selected customer "
                    f"({gads_conn.customer_id}) is a manager (MCC) account. Manager accounts "
                    "hold no campaigns, so no performance data can be read from it - a client "
                    "account under it has to be selected instead.")
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
