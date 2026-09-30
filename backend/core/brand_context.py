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


import threading
import time

# The facts half of the context, cached per workspace.
#
# Measured on a live workspace: the Postgres half (profile + brand kit + graph) takes 13.0s
# and produces 11.5KB of real brand knowledge, while the vector half takes a further 28.5s
# to return a single passage because it loads the local embedding model on first use. Both
# sat behind ONE 8s timeout in the creative pipeline, so the timeout always fired and the
# whole brand kit was discarded - which is why generated images ignored the brand no matter
# what the kit contained. Splitting them lets the valuable half arrive on its own budget,
# and the cache means only the first request per workspace pays for it.
#
# The kit changes when onboarding re-runs or someone edits Brand Knowledge, so a short TTL
# is enough; nothing here needs to be correct to the second.
_FACTS_TTL_SEC = 300.0
_facts_cache: dict = {}
_facts_lock = threading.Lock()


def brand_facts_context(workspace_id: int, use_cache: bool = True) -> str:
    """The looked-up half: profile, exact design tokens, the brand kit and the brand graph.

    Postgres and pure Python only - no embedding model, no vector store. This is the part
    that actually carries the brand, so it is worth waiting for on its own.
    """
    if use_cache:
        with _facts_lock:
            hit = _facts_cache.get(workspace_id)
        if hit and (time.time() - hit[0]) < _FACTS_TTL_SEC:
            return hit[1]

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

    # 1b) Exact design tokens, identity and the relationships between them.
    try:
        from core.rag import brand_facts, format_brand_kit
        facts = brand_facts(workspace_id)
        kit = format_brand_kit(facts)
        if kit:
            parts.append(kit)
        from core.brand_graph import build_graph, format_graph
        graph = format_graph(build_graph(facts))
        if graph:
            parts.append(graph)
    except Exception as e:
        print(f"brand_context: brand kit load failed for ws {workspace_id}: {e}")

    # The retail calendar is public fact and costs nothing, so it rides along with the
    # fast half rather than being lost whenever retrieval is slow.
    try:
        from core.retail_calendar import calendar_context
        cal = calendar_context(within_days=90)
        if cal:
            parts.append(cal)
    except Exception as e:
        print(f"brand_context: retail calendar unavailable: {e}")

    out = "\n\n".join(parts)
    if out:
        with _facts_lock:
            _facts_cache[workspace_id] = (time.time(), out)
    return out


def invalidate_brand_context(workspace_id: int) -> None:
    """Drop the cached facts for a workspace. Called after onboarding or a manual edit so a
    correction shows up in the next generation rather than up to five minutes later."""
    with _facts_lock:
        _facts_cache.pop(workspace_id, None)


def brand_excerpts(workspace_id: int, query: str = "", kb_limit: int = 3) -> str:
    """The retrieved half: the workspace's slice of the vector store.

    Separated because it loads the embedding model and is by far the slowest part. It is
    supplementary - the facts above are the brand - so a caller may bound it tightly and
    proceed without it.
    """
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
            return f"Knowledge base excerpts:\n{joined}"
    except Exception as e:
        print(f"brand_context: KB retrieval failed for ws {workspace_id}: {e}")
    return ""


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
        facts = brand_facts(workspace_id)
        kit = format_brand_kit(facts)
        if kit:
            parts.append(kit)

        # The relationships between those facts, resolved rather than listed.
        #
        # The kit above states personas, categories and differentiators as separate lists,
        # which leaves every agent to work out for itself which product belongs to which
        # segment - from free text that does not match, so in practice it guessed. The map
        # answers "what do we promote to this audience, with what proof, and what objection
        # must the copy handle" directly. Derived from what is already stored, so it costs
        # no model call and needs no re-extraction.
        from core.brand_graph import build_graph, format_graph
        graph = format_graph(build_graph(facts))
        if graph:
            parts.append(graph)
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
