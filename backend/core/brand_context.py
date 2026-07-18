"""
Shared brand-context builder.

Every agent (SEO, Social, Analytics, Campaign, Creative) should ground its output in
the SAME company knowledge - the onboarded brand profile plus the Qdrant knowledge base.
Centralising it here means one consistent, real source instead of each agent inventing
generic output or duplicating retrieval logic.
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

    # 2) Relevant excerpts from the Qdrant knowledge base
    try:
        from database import qdrant_client
        from core.embeddings import embed_query, ensure_collection, COLLECTION_NAME
        from qdrant_client.models import Filter, FieldCondition, MatchValue
        ensure_collection(qdrant_client)
        resp = qdrant_client.query_points(
            collection_name=COLLECTION_NAME,
            query=embed_query(query or "company overview products audience positioning"),
            query_filter=Filter(must=[FieldCondition(key="workspace_id", match=MatchValue(value=workspace_id))]),
            limit=kb_limit,
        )
        excerpts = [p.payload.get("content", "") for p in resp.points if p.payload.get("content")]
        if excerpts:
            joined = "\n".join(f"- {c[:500]}" for c in excerpts)
            parts.append(f"Knowledge base excerpts:\n{joined}")
    except Exception as e:
        print(f"brand_context: KB retrieval failed for ws {workspace_id}: {e}")

    if not parts:
        return "No specific brand context is available for this workspace yet (run onboarding to build it)."
    return "\n\n".join(parts)
