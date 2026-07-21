"""
Content generation agent — the 'content strategy -> generate' stage.

Given a topic (or a keyword from the SEO strategy), generate a real, SEO-optimized
article grounded in the company's brand context, store it as a ContentDraft with
status 'pending_review', and record agent status. A human then approves/rejects it.
"""
from core.websocket import manager, current_workspace_id
from core.providers.llm_providers import GeminiProvider
from core.providers.base import LLMProviderError
from core.brand_context import get_brand_context
from core.agent_status import record_agent_task


async def run_content_generation(workspace_id: int, topic: str, content_type: str = "blog"):
    current_workspace_id.set(workspace_id)  # scope all broadcasts in this task to this workspace
    await manager.broadcast_agent_log("Content Agent", f"Generating {content_type} content for: {topic}", "running")
    record_agent_task(workspace_id, "CONTENT", "RUNNING", topic[:80])

    try:
        brand = get_brand_context(workspace_id, query=topic)
        system_prompt = (
            "You are an expert SEO content writer. Write a complete, publication-ready "
            "article in markdown. Requirements: an H1 title, a compelling intro, well-structured "
            "H2/H3 sections, and a short conclusion with a call to action. Optimize naturally for "
            "the target topic (no keyword stuffing), and match the brand's voice and audience. "
            "Also make it answer-engine friendly (clear, factual, question-oriented subheadings)."
        )
        prompt = (
            f"TOPIC / TARGET KEYWORD: {topic}\n\n"
            f"COMPANY CONTEXT (write in this brand's voice, for its audience, about its offerings):\n{brand}\n\n"
            f"Write the full {content_type} article now."
        )
        llm = GeminiProvider()
        body = (await llm.generate_text(prompt, system_prompt=system_prompt, max_output_tokens=2000)).strip()
    except LLMProviderError as e:
        await manager.broadcast_agent_log("Content Agent", f"Content generation failed: {e}", "failed")
        record_agent_task(workspace_id, "CONTENT", "FAILED", str(e)[:120])
        raise

    # Derive a title from the first markdown H1, else fall back to the topic.
    title = topic
    for line in body.splitlines():
        if line.strip().startswith("# "):
            title = line.strip().lstrip("# ").strip()
            break

    # Persist as a draft for human review.
    draft_id = 0
    try:
        from database import SessionLocal
        import models
        with SessionLocal() as db:
            draft = models.ContentDraft(
                workspace_id=workspace_id,
                title=title[:255],
                body=body,
                content_type=content_type,
                target_keyword=topic[:255],
                status="pending_review",
            )
            db.add(draft)
            db.commit()
            db.refresh(draft)
            draft_id = draft.id
    except Exception as e:
        print(f"Failed to save ContentDraft: {e}")

    record_agent_task(workspace_id, "CONTENT", "COMPLETED", f"Draft ready for review: {title[:70]}")
    await manager.broadcast_agent_log("Content Agent", f"Content draft ready for human review: {title[:60]}", "completed")

    import json
    await manager.broadcast(json.dumps({
        "type": "new_content_draft",
        "draft": {"id": draft_id, "title": title, "content_type": content_type, "status": "pending_review"},
    }))
    return {"id": draft_id, "title": title, "body": body, "status": "pending_review"}
