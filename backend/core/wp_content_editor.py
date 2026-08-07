"""Contextual WordPress content editing — targeted edits instead of whole-page rewrites.

The previous approach handed the entire page body to the model and wrote back whatever it
returned. That is a full rewrite dressed up as a fix: unrelated paragraphs, images,
shortcodes and formatting all silently pass through the model and come back subtly changed,
and there is no way to say *where* a change was supposed to land.

Here the responsibilities are split:

    AI  decides WHAT to change and WHERE  -> an EditPlan (structured JSON, no HTML surgery)
    code performs the change              -> deterministic string splice at known offsets

Because the code does the editing, everything outside the targeted span is preserved
byte-for-byte. The model never sees an opportunity to "helpfully" reword the rest of the
page, and a plan whose target no longer exists is rejected rather than guessed at.

Two rules this module will not bend:
  * If a target cannot be located unambiguously, the operation goes to manual review. It is
    never applied at a guessed position.
  * Offsets are recomputed against the CURRENT page every time. A plan built against stale
    content fails validation instead of overwriting whatever now sits at that offset.
"""
from __future__ import annotations

import json
import re
from typing import Optional

from pydantic import BaseModel, Field

# Top-level elements we treat as addressable nodes. Matches the set to_gutenberg_blocks
# already understands, so an edited page stays block-clean.
_TOP_LEVEL = r"h1|h2|h3|h4|h5|h6|p|ul|ol|blockquote|figure|pre|table|hr"
_OPEN_RE = re.compile(rf"<({_TOP_LEVEL})\b[^>]*>", re.IGNORECASE)

# A Gutenberg block wrapper around an element:  <!-- wp:heading -->...<!-- /wp:heading -->
_BLOCK_OPEN_RE = re.compile(r"<!--\s*wp:([a-z0-9-]+)(\s+\{.*?\})?\s*-->", re.IGNORECASE | re.DOTALL)


class EditTarget(BaseModel):
    type: str = "paragraph"                  # heading | paragraph | section | html_element
    identifier: str = ""                     # the visible text used to find the node
    existing_content: Optional[str] = None   # what the model believed was there


class EditOperation(BaseModel):
    """One targeted change. `action` says what to do, `target` says where."""
    action: str                              # replace | insert | delete
    target: EditTarget = Field(default_factory=EditTarget)
    position: str = "replace"                # before | after | replace
    content: str = ""                        # new HTML (empty for delete)
    reason: str = ""
    fix: str = ""                            # which approved recommendation this serves


def _strip_tags(html: str) -> str:
    text = re.sub(r"<[^>]+>", " ", html or "")
    text = re.sub(r"&nbsp;?", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def outline(html: str) -> list[dict]:
    """Every addressable top-level node, with the exact source span it occupies.

    `start`/`end` are offsets into the ORIGINAL string, and they include the Gutenberg block
    comment wrapper when there is one — so replacing a node swaps the whole block cleanly
    rather than leaving an orphaned `<!-- /wp:heading -->` behind.
    """
    html = html or ""
    nodes: list[dict] = []
    pos = 0
    while pos < len(html):
        m = _OPEN_RE.search(html, pos)
        if not m:
            break
        tag = m.group(1).lower()
        if tag == "hr":
            inner_end = m.end()
        else:
            close = re.compile(rf"</{tag}\s*>", re.IGNORECASE)
            cm = close.search(html, m.end())
            if not cm:
                break
            inner_end = cm.end()

        start, end = m.start(), inner_end

        # Absorb an enclosing block comment pair, if this element sits inside one.
        prefix = html[:start]
        bm = None
        for candidate in _BLOCK_OPEN_RE.finditer(prefix):
            bm = candidate
        if bm and not prefix[bm.end():].strip():
            closing = re.compile(rf"<!--\s*/wp:{re.escape(bm.group(1))}\s*-->", re.IGNORECASE)
            cm2 = closing.search(html, end)
            if cm2 and not html[end:cm2.start()].strip():
                start, end = bm.start(), cm2.end()

        nodes.append({
            "index": len(nodes),
            "tag": tag,
            "text": _strip_tags(html[m.start():inner_end]),
            "html": html[start:end],
            "start": start,
            "end": end,
        })
        pos = inner_end
    return nodes


def outline_for_prompt(nodes: list[dict], max_text: int = 160) -> str:
    """Compact, numbered view of the page the model plans against. Deliberately truncated:
    the model needs structure and enough text to identify a node, not the whole document."""
    lines = []
    for n in nodes:
        text = n["text"]
        if len(text) > max_text:
            text = text[:max_text] + "…"
        lines.append(f'[{n["index"]}] <{n["tag"]}> {text}')
    return "\n".join(lines) if lines else "(the page body is empty)"


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip().lower()


def locate(nodes: list[dict], target: EditTarget) -> tuple[Optional[dict], Optional[str]]:
    """Find the single node a target refers to.

    Returns (node, None) on a confident match, or (None, reason) when the target is missing
    or ambiguous. Ambiguity is deliberately a failure: two paragraphs with the same text
    means we cannot know which one the recommendation meant, and picking one at random is
    exactly the blind behaviour this module exists to prevent.
    """
    needle = _norm(target.identifier)
    if not needle:
        return None, "the plan did not say which part of the page to change"

    wanted_tag = {"heading": ("h1", "h2", "h3", "h4", "h5", "h6"), "paragraph": ("p",)}.get(target.type)

    def candidates(pred):
        return [n for n in nodes if pred(n) and (not wanted_tag or n["tag"] in wanted_tag)]

    exact = candidates(lambda n: _norm(n["text"]) == needle)
    if len(exact) == 1:
        return exact[0], None
    if len(exact) > 1:
        return None, f"'{target.identifier[:60]}' appears {len(exact)} times — cannot tell which one was meant"

    partial = candidates(lambda n: needle in _norm(n["text"]) or _norm(n["text"]) in needle)
    if len(partial) == 1:
        return partial[0], None
    if len(partial) > 1:
        return None, f"'{target.identifier[:60]}' matches {len(partial)} places on the page"

    # Ignore tag filter as a last resort — the model may have mislabelled the node type
    # while still naming the right text.
    loose = [n for n in nodes if _norm(n["text"]) == needle]
    if len(loose) == 1:
        return loose[0], None
    return None, f"could not find '{target.identifier[:60]}' on the page"


def validate(op: EditOperation, nodes: list[dict]) -> tuple[Optional[dict], Optional[str]]:
    """Structural checks before anything is spliced. Returns (node, error)."""
    if op.action not in ("replace", "insert", "delete"):
        return None, f"unsupported action '{op.action}'"
    if op.action in ("replace", "insert") and not (op.content or "").strip():
        return None, "the plan produced no replacement content"
    if op.action == "insert" and op.position not in ("before", "after"):
        return None, "an insert must say whether it goes before or after the target"

    node, why = locate(nodes, op.target)
    if not node:
        return None, why

    # Staleness: the model planned against content that has since changed underneath us.
    # The claim must still be FOUND in the live node. Containment in the other direction is
    # deliberately not accepted — a live node shorter than what the model quoted means text
    # was removed from the page, which is exactly the case we must not write over.
    # The outline the model reads is truncated with an ellipsis, so a quote cut short at that
    # boundary is legitimate and gets the marker stripped before comparing.
    if op.target.existing_content:
        claimed = _norm(op.target.existing_content).rstrip("… .")
        actual = _norm(node["text"])
        if claimed and claimed not in actual:
            return None, ("the page changed since this recommendation was generated "
                         "(the targeted text no longer matches)")

    # A second <h1> in the body is a real SEO regression, so refuse to add one. Replacing an
    # existing h1 in place is fine.
    if "<h1" in (op.content or "").lower() and not (op.action == "replace" and node["tag"] == "h1"):
        return None, "the plan would add a second H1 to the page body"
    return node, None


def apply_operations(html: str, ops: list[EditOperation]) -> dict:
    """Apply every valid operation to `html` by splicing at known offsets.

    Applied back-to-front so each splice cannot invalidate the offsets of the ones still
    pending. Returns {content, applied, manual_review} where `applied` carries a per-change
    before/after for the preview, and `manual_review` carries the ones we refused to guess at.
    """
    nodes = outline(html)
    planned, manual_review = [], []

    for op in ops:
        node, err = validate(op, nodes)
        if err:
            manual_review.append({
                "fix": op.fix, "action": op.action, "reason": op.reason,
                "target": op.target.identifier, "content": op.content, "error": err,
            })
            continue
        planned.append((node, op))

    # Two operations targeting the same node would corrupt each other's offsets; the second
    # is sent to manual review rather than silently clobbering the first.
    seen: set[int] = set()
    final = []
    for node, op in planned:
        if node["start"] in seen:
            manual_review.append({
                "fix": op.fix, "action": op.action, "reason": op.reason,
                "target": op.target.identifier, "content": op.content,
                "error": "another approved change already edits this same part of the page",
            })
            continue
        seen.add(node["start"])
        final.append((node, op))

    applied = []
    for node, op in sorted(final, key=lambda x: x[0]["start"], reverse=True):
        before = node["html"]
        if op.action == "delete":
            after = ""
        elif op.action == "replace":
            after = op.content
        elif op.position == "before":
            after = f"{op.content}\n\n{before}"
        else:
            after = f"{before}\n\n{op.content}"

        html = html[:node["start"]] + after + html[node["end"]:]
        applied.append({
            "fix": op.fix, "action": op.action, "position": op.position,
            "reason": op.reason, "target": op.target.identifier,
            "target_tag": node["tag"], "before": before, "after": after,
        })

    applied.reverse()   # report in document order, not the reverse order we spliced in
    return {"content": html, "applied": applied, "manual_review": manual_review}


_SYSTEM = (
    "You are a precise WordPress content editor. You do NOT rewrite pages — you produce a "
    "minimal, targeted EDIT PLAN describing exactly which existing element to change and how.\n\n"
    "You are given a numbered outline of the page's top-level elements and a list of approved "
    "SEO recommendations. For each recommendation, emit ONE operation that changes the "
    "smallest piece of the page that satisfies it.\n\n"
    "RULES:\n"
    "- Target an element by quoting its EXACT visible text in target.identifier. Copy it from "
    "the outline verbatim; do not paraphrase, or the edit cannot be located.\n"
    "- 'Improve/rewrite X' -> action 'replace' on the element that holds X.\n"
    "- 'Add a section about X' -> action 'insert', position 'after', targeting the most "
    "topically related existing element.\n"
    "- 'Add an internal link' -> action 'replace' on the single most relevant existing "
    "paragraph, returning that paragraph with the link woven into its existing sentences.\n"
    "- Never target the same element twice. Never add a second <h1>.\n"
    "- If you cannot confidently identify which element a recommendation refers to, OMIT that "
    "recommendation entirely. A missing operation is handled safely; a wrongly-placed one is not.\n\n"
    "MARKUP: plain semantic HTML only (h2, h3, p, ul, ol, li, strong, em, a, blockquote). "
    "Never emit div, span, class=, style=, or id=. Never invent facts, prices, statistics, "
    "testimonials or contact details.\n\n"
    'Return ONLY JSON: {"operations": [{"action": "replace|insert|delete", '
    '"target": {"type": "heading|paragraph|section", "identifier": "<exact existing text>", '
    '"existing_content": "<exact existing text>"}, "position": "before|after|replace", '
    '"content": "<new HTML>", "reason": "<one short sentence>", "fix": "<the recommendation '
    'this serves, copied verbatim>"}]} — no prose, no markdown fences.'
)


async def generate_edit_plan(*, html: str, page_title: str, fixes: list[str],
                             brand_context: str = "", site_name: str = "",
                             page_url: str = "") -> list[EditOperation]:
    """Ask the model for a plan. It sees an OUTLINE, never the full body, so it cannot
    return a rewritten page even if it wanted to — the only thing it can express is a set of
    targeted operations."""
    from core.providers.llm_providers import GeminiProvider

    nodes = outline(html)
    context_block = ""
    if brand_context or site_name:
        context_block = (f"\n\nABOUT THIS BUSINESS (write specifically, never generically; "
                        f"do not contradict or embellish it):\nSite: {site_name}\n{brand_context}\n")

    prompt = (
        f"Page title: {page_title}\nPage URL: {page_url}{context_block}\n\n"
        f"PAGE OUTLINE (numbered top-level elements):\n{outline_for_prompt(nodes)}\n\n"
        f"APPROVED RECOMMENDATIONS TO PLAN FOR:\n" + "\n".join(f"- {f}" for f in fixes) +
        "\n\nReturn the edit plan as JSON."
    )
    raw = (await GeminiProvider().generate_text(prompt=prompt, system_prompt=_SYSTEM)).strip()
    raw = re.sub(r"^```[a-zA-Z0-9]*\n", "", raw)
    raw = re.sub(r"\n```\s*$", "", raw)
    try:
        data = json.loads(raw)
    except Exception as e:
        raise RuntimeError(f"The model did not return a valid edit plan ({e}).")

    ops: list[EditOperation] = []
    for item in (data.get("operations") or []):
        try:
            ops.append(EditOperation(**item))
        except Exception:
            # One malformed operation must not discard the rest of a usable plan.
            continue
    return ops


def unplanned_fixes(fixes: list[str], ops: list[EditOperation]) -> list[str]:
    """Approved recommendations the model declined to plan for — it was told to omit
    anything it could not place confidently, so these need a human, not a guess."""
    planned = {_norm(o.fix) for o in ops if o.fix}
    out = []
    for f in fixes:
        nf = _norm(f)
        if not any(nf in p or p in nf for p in planned if p):
            out.append(f)
    return out
