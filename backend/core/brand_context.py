"""
Shared brand-context builder.

Every agent (SEO, Social, Analytics, Campaign, Creative) should ground its output in
the SAME company knowledge - the onboarded brand profile, the exact design tokens, and the
workspace's slice of the vector store. Centralising it here means one consistent, real
source instead of each agent inventing generic output or duplicating retrieval logic.

The retrieval now spans three kinds of indexed content, not just the site crawl: the
onboarding pages, the fortnightly competitor ad vault and the four-weekly market-trend
radar. See core/rag.py for the split between looked-up facts and retrieved judgement.
"""


def get_brand_context(workspace_id: int, query: str = "", kb_limit: int = 3) -> str:
    """
    Returns a formatted brand-context string for a workspace:
      - brand voice/tone, target audience, guidelines (from Postgres BrandProfile)
      - the most relevant knowledge-base excerpts for `query` (from Qdrant)

    Never raises - on any failure it returns whatever it managed to gather (or a clear
    'no context' message), so a laggy DB or empty KB degrades gracefully instead of
    breaking the agent.
    """
    parts = []

    # 1) Structured brand profile from Postgres
    try:
        from database import SessionLocal
        import models
        with SessionLocal() as db:
            ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
            bp = db.query(models.BrandProfile).filter(models.BrandProfile.workspace_id == workspace_id).first()
            if ws and ws.name:
                parts.append(f"Brand: {ws.name}" + (f" ({ws.company_url})" if ws.company_url else ""))
            if ws and ws.brand_voice:
                parts.append(f"Brand voice/tone: {ws.brand_voice}")
            if bp:
                if bp.target_audience:
                    parts.append(f"Target audience: {bp.target_audience}")
                if bp.brand_guidelines_summary:
                    parts.append(f"Brand guidelines: {bp.brand_guidelines_summary}")
    except Exception as e:
        print(f"brand_context: profile load failed for ws {workspace_id}: {e}")

    # 1b) Exact design tokens and identity, straight from Postgres.
    #
    # These are looked up rather than retrieved on purpose: a creative brief that says
    # "use the CTA colour" is useless, and a vector store asked for a hex code returns
    # something hex-shaped rather than the right one. See core/rag.py.
    try:
        from core.rag import brand_facts, format_brand_kit
        kit = format_brand_kit(brand_facts(workspace_id))
        if kit:
            parts.append(kit)
    except Exception as e:
        print(f"brand_context: brand kit load failed for ws {workspace_id}: {e}")

    # 2) Relevant excerpts from the knowledge base - now spanning the onboarding crawl,
    #    the competitor ad vault and the market-trend radar, all filtered to this
    #    workspace. Agents used to see only the site crawl, so a campaign brief had no idea
    #    what rivals were currently running or which search intents were rising.
    try:
        from core.rag import retrieve, KIND_BRAND
        from core.intel_sync import KIND_AD, KIND_TREND
        passages = retrieve(
            workspace_id,
            query or "company overview products audience positioning",
            [KIND_BRAND, KIND_AD, KIND_TREND],
            limit=kb_limit + 2,
        )
        excerpts = [p["content"] for p in passages if p.get("content")]
        if excerpts:
            joined = "\n".join(f"- {c[:500]}" for c in excerpts)
            parts.append(f"Knowledge base excerpts:\n{joined}")
    except Exception as e:
        print(f"brand_context: KB retrieval failed for ws {workspace_id}: {e}")

    # 3) The retail calendar. A campaign planned in late September should know Diwali is
    #    six weeks out and that creative has to be live three weeks before it - without the
    #    user having to say so. These are public facts, so they need no workspace lookup.
    try:
        from core.retail_calendar import calendar_context
        cal = calendar_context(within_days=90)
        if cal:
            parts.append(cal)
    except Exception as e:
        print(f"brand_context: retail calendar unavailable: {e}")

    if not parts:
        return "No specific brand context is available for this workspace yet (run onboarding to build it)."
    return "\n\n".join(parts)
