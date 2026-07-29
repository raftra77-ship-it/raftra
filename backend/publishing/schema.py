"""Step 1 — the generic, platform-independent recommendation schema.

The existing audit pipeline (core/seo_scoring.py `build_seo_audit` / `build_geo_audit`)
already produces `priority_issues`: a list of
    {"severity": ..., "area": "<Category> · <Sub-area>", "issue": "<free text fix>", "impact": ...}
That shape is free-text and report-oriented — great for the human-facing report, not
structured enough to hand to a platform converter. `normalize_audit()` below reuses that
exact JSON (no re-crawling, no re-scoring) and maps it onto the generic fields a converter
needs: page, action, target, currentValue, newValue, priority, reasoning.

Honesty constraint carried over from the audit pipeline itself: currentValue/newValue are
left None when we cannot point to a literal, measured replacement value — the same
"Not Verified rather than guessed" principle the scoring engine already follows. They get
filled in once a publisher actually reads the live target (file/post/page) to diff against.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urlparse

# Category name (from the "area" field, e.g. "SEO · Metadata" -> "Metadata") -> generic action.
# Best-effort classification of *what kind* of change a recommendation represents. Keep this
# small and additive — new categories simply fall back to ACTION_FALLBACK.
ACTION_BY_CATEGORY = {
    "Content": "update_content",
    "Metadata": "update_metadata",
    "Technical SEO": "update_technical_config",
    "Performance": "update_technical_config",
    "Accessibility": "update_content",
    "Internal Linking": "update_content",
    "Structured Data": "add_structured_data",
    "AI Readability": "update_metadata",
    "Content Structure": "update_content",
    "AI Citation Readiness": "update_content",
    "Authority Signals": "update_content",
    "Structured Knowledge": "add_structured_data",
}
ACTION_FALLBACK = "update_content"

# Ordered (substring in the recommendation text, lowercase) -> specific target field.
# First match wins, so more specific phrases are listed before their generic parents.
TARGET_KEYWORDS: list[tuple[str, str]] = [
    ("meta description", "meta.description"),
    ("open graph", "meta.og_tags"),
    ("canonical", "meta.canonical"),
    ("title", "meta.title"),
    ("organization schema", "structured_data.organization"),
    ("faqpage", "structured_data.faq_page"),
    ("product or softwareapplication schema", "structured_data.product"),
    ("json-ld", "structured_data.json_ld"),
    ("schema", "structured_data.json_ld"),
    ("robots.txt", "technical.robots_txt"),
    ("sitemap", "technical.sitemap"),
    ("alt-text", "content.image_alt"),
    ("alt text", "content.image_alt"),
    ("sub-heading", "content.headings"),
    ("sub headings", "content.headings"),
    ("heading", "content.headings"),
    ("h1", "content.headings"),
    ("bulleted", "content.lists"),
    ("bullet", "content.lists"),
    (" lists", "content.lists"),
    ("word count", "content.body"),
    ("expand to", "content.body"),
    ("internal link", "content.internal_links"),
    ("about page", "content.about_page"),
    ("contact info", "content.contact_info"),
    ("documentation", "content.documentation_link"),
    ("official profiles", "content.social_links"),
    ("social", "content.social_links"),
    ("stats", "content.statistics"),
    ("definition", "content.definitions"),
    ("cite authoritative", "content.citations"),
    ("who it's for", "content.audience_statement"),
    ("built for", "content.audience_statement"),
]


def _infer_category(area: str) -> str:
    """"SEO · Metadata" -> "Metadata" (the part after the last '·')."""
    return area.split("·")[-1].strip() if area else "General"


def _infer_action(category: str) -> str:
    return ACTION_BY_CATEGORY.get(category, ACTION_FALLBACK)


def _infer_target(category: str, issue_text: str) -> str:
    lowered = (issue_text or "").lower()
    for needle, target in TARGET_KEYWORDS:
        # Word-boundary match, not substring — plain `in` would let "title" match inside
        # "more clearly-titled sections", misclassifying a content-structure fix as a
        # meta-title fix.
        if re.search(rf"\b{re.escape(needle.strip())}\b", lowered):
            return target
    # Fall back to a category-scoped generic target, e.g. "content.general".
    slug = category.lower().replace(" ", "_")
    return f"{slug}.general"


def _page_path(url: Optional[str]) -> str:
    if not url:
        return "/"
    return urlparse(url).path or "/"


@dataclass
class GenericRecommendation:
    """Platform-independent shape a PlatformConverter can turn into a platform payload."""

    id: str                          # stable id: f"{audit_id}:{key}"
    page: str                        # the page this applies to (currently the audit's target_url —
                                      # one page per audit today; multi-page ready via `page` alone)
    action: str                      # update_content | update_metadata | add_structured_data | update_technical_config
    target: str                      # e.g. "meta.title", "structured_data.json_ld", "content.headings"
    current_value: Optional[str]     # None when not literally measured (kept honest, never invented)
    new_value: Optional[str]         # None until a publisher can diff against the live target
    priority: str                    # Critical | High | Medium | Low (reused verbatim from the audit)
    reasoning: str                   # why this matters + the suggested fix (from the audit's own text)
    pipeline: str                    # SEO | GEO
    category: str                    # e.g. "Metadata", "Structured Data"
    source_audit_id: int
    decision: Optional[str] = None       # approved | edited | rejected | None (human review state)
    edited_text: Optional[str] = None    # human-edited version of `reasoning`, if any

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "page": self.page,
            "action": self.action,
            "target": self.target,
            "currentValue": self.current_value,
            "newValue": self.new_value,
            "priority": self.priority,
            "reasoning": self.edited_text or self.reasoning,
            "pipeline": self.pipeline,
            "category": self.category,
            "sourceAuditId": self.source_audit_id,
            "decision": self.decision,
        }


def normalize_issue(issue: dict, *, target_url: str, pipeline: str, audit_id: int,
                    decision: Optional[str] = None, edited_text: Optional[str] = None) -> GenericRecommendation:
    """One `priority_issues` entry -> one GenericRecommendation. Pure mapping, no I/O."""
    area = issue.get("area") or ""
    category = _infer_category(area)
    issue_text = issue.get("issue") or ""
    key = f"{area}::{issue_text}"
    return GenericRecommendation(
        id=f"{audit_id}:{key}",
        page=_page_path(target_url),
        action=_infer_action(category),
        target=_infer_target(category, issue_text),
        current_value=None,
        new_value=None,
        priority=issue.get("severity") or "Medium",
        reasoning=issue_text,
        pipeline=pipeline,
        category=category,
        source_audit_id=audit_id,
        decision=decision,
        edited_text=edited_text,
    )


def normalize_audit(audit: dict, *, pipeline: str, audit_id: int,
                    decisions: Optional[dict] = None,
                    approved_only: bool = False) -> list[GenericRecommendation]:
    """`build_seo_audit()` / `build_geo_audit()` output -> list[GenericRecommendation].

    `decisions` is the same dict already stored on SEOAudit.keywords_data["decisions"]
    (keyed by "<area>::<issue>"). When `approved_only` is True, only recommendations the
    user has approved or edited are included — this is what the real publish step will use
    later, since nothing should ever be pushed to a platform without human approval.
    """
    target_url = audit.get("target_url")
    decisions = decisions or {}
    out = []
    for issue in (audit.get("priority_issues") or []):
        key = f"{issue.get('area')}::{issue.get('issue')}"
        dec = decisions.get(key) or {}
        decision = dec.get("decision")
        if approved_only and decision not in ("approved", "edited"):
            continue
        out.append(normalize_issue(
            issue, target_url=target_url, pipeline=pipeline, audit_id=audit_id,
            decision=decision, edited_text=dec.get("edited_text"),
        ))
    return out
