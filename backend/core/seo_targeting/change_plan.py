"""The structured SEO change instruction, and the state machine it moves through.

One ChangePlan == one SEO property on one page. It is deliberately narrower than
UniversalSeoFix (core/seo_fix_schema.py), which bundles every field into a single payload
with no target: a bundle cannot express "the title already exists and is fine, but the
description is missing", which is precisely the distinction that decides insert vs update
vs do-nothing. Splitting per property is what makes idempotency checkable.

UniversalSeoFix is still how copy gets generated — see planner.explode_universal_fix(),
which turns one generated payload into per-property plans. Nothing about the existing
generation or approval path changes.
"""
from __future__ import annotations

from enum import Enum
from typing import Optional, Any

from pydantic import BaseModel, Field


class FixState(str, Enum):
    """Lifecycle of a single fix. Deliberately distinguishes "the API accepted it" from
    "the issue is actually gone" — the old path collapsed both into success on HTTP 200."""

    PLANNED = "PLANNED"                                   # value generated, target not resolved yet
    TARGET_RESOLVED = "TARGET_RESOLVED"                   # we know the exact resource + mechanism
    READY_FOR_REVIEW = "READY_FOR_REVIEW"                 # diff/preview built, awaiting human
    APPLYING = "APPLYING"
    APPLIED = "APPLIED"                                   # write accepted by the platform
    VERIFYING = "VERIFYING"
    FIXED = "FIXED"                                       # re-fetched AND re-checked clean
    APPLIED_BUT_NOT_VERIFIED = "APPLIED_BUT_NOT_VERIFIED"  # wrote fine, could not confirm live
    FAILED = "FAILED"
    AMBIGUOUS = "AMBIGUOUS"                               # >1 plausible target — never guessed
    CONFLICT_DETECTED = "CONFLICT_DETECTED"               # another plan touches the same target
    NOOP = "NOOP"                                         # already correct; nothing to do

    @property
    def is_terminal(self) -> bool:
        return self in (FixState.FIXED, FixState.FAILED, FixState.NOOP,
                        FixState.APPLIED_BUT_NOT_VERIFIED)

    @property
    def blocks_apply(self) -> bool:
        """States a human must clear before any write may happen."""
        return self in (FixState.AMBIGUOUS, FixState.CONFLICT_DETECTED, FixState.FAILED)


class TargetType(str, Enum):
    """The SEO property being changed. Drives which modifier and which verifier run,
    so it must name a single concrete property — never a category like "Metadata"."""

    TITLE = "title"
    META_DESCRIPTION = "meta_description"
    CANONICAL = "canonical"
    ROBOTS_META = "robots_meta"
    OG_TITLE = "og:title"
    OG_DESCRIPTION = "og:description"
    OG_TYPE = "og:type"
    TWITTER_CARD = "twitter:card"
    TWITTER_TITLE = "twitter:title"
    TWITTER_DESCRIPTION = "twitter:description"
    JSON_LD = "json_ld"
    H1 = "h1"
    IMAGE_ALT = "image_alt"

    @property
    def is_head_tag(self) -> bool:
        """Properties that live in <head> and therefore need real head control — the
        distinction that decides whether WordPress can write it without a plugin."""
        return self not in (TargetType.H1, TargetType.IMAGE_ALT)


class ChangeAction(str, Enum):
    INSERT = "insert"            # property absent -> add it
    UPDATE = "update"            # property present with a different value -> change it
    NOOP = "noop"                # present and already correct -> do nothing (idempotency)
    CONSOLIDATE = "consolidate"  # duplicates found -> collapse to one
    DELETE = "delete"


class Mechanism(str, Enum):
    """HOW a page's metadata is actually controlled. Resolving this is the whole point:
    the same "missing meta description" issue is a different edit in each case."""

    HTML_HEAD = "html_head"                      # raw <head> in a .html file
    NEXT_METADATA_EXPORT = "next_metadata_export"  # export const metadata = {...}
    NEXT_HEAD_COMPONENT = "next_head_component"  # <Head> from next/head (pages router)
    REACT_HELMET = "react_helmet"                # <Helmet>/<HelmetProvider>
    ASTRO_FRONTMATTER = "astro_frontmatter"
    WP_SEO_PLUGIN = "wp_seo_plugin"              # Yoast / Rank Math / AIOSEO field
    WP_CORE_FIELD = "wp_core_field"              # post title / excerpt
    WP_CONTENT_BODY = "wp_content_body"          # inside post_content (JSON-LD only)
    SHOPIFY_RESOURCE_FIELD = "shopify_resource_field"  # product/page/collection SEO field
    SHOPIFY_THEME_LIQUID = "shopify_theme_liquid"      # layout/theme.liquid <head>
    UNKNOWN = "unknown"


class TargetLocation(BaseModel):
    """WHERE the change lands, resolved to something addressable.

    `confidence` and `candidates` exist so the resolver can express doubt. A resolver that
    cannot reach high confidence must return candidates and let the plan go AMBIGUOUS —
    writing to a guessed target is the failure this whole package exists to prevent.
    """

    platform: str                                  # github | wordpress | shopify
    resource_kind: str                             # file | wp_page | wp_post | shopify_product | ...
    resource_id: str = ""                          # file path, numeric id, or gid
    resource_label: str = ""                       # human-readable, for the review screen
    mechanism: Mechanism = Mechanism.UNKNOWN
    # Where inside the resource. For files this is a structural hint (the <head> element,
    # the metadata export); for APIs it's the field name. Never a byte offset on its own —
    # offsets are recomputed against current content at apply time, never trusted from here.
    selector: Optional[str] = None
    api_field: Optional[str] = None
    confidence: float = 0.0                        # 0..1
    candidates: list[str] = Field(default_factory=list)
    reason: str = ""                               # why this target, shown in review

    def is_confident(self, threshold: float = 0.8) -> bool:
        return self.confidence >= threshold and bool(self.resource_id)


class VerificationSpec(BaseModel):
    """How to prove the fix actually landed. Filled by the resolver, run by
    verification.py after the write."""

    # Re-read the resource through the platform API and compare the field.
    refetch: bool = True
    # Re-crawl the public URL and re-run the deterministic check for this TargetType.
    recrawl_url: Optional[str] = None
    expected_value: Optional[str] = None
    # GitHub only: a PR is not live until merged and deployed, so a green write here can
    # never mean FIXED. Set so the verifier reports honestly instead of over-claiming.
    requires_merge: bool = False
    notes: str = ""


class ChangePlan(BaseModel):
    """One SEO property, one page, one action — fully resolved before anything is written."""

    # --- Step 16: the audit -> fix chain, so the UI can trace issue -> change -> verified
    audit_id: Optional[int] = None
    issue_id: str = ""            # "{area}::{issue}", the same key decisions are stored under
    fix_id: str = ""

    issue: str = ""               # the human-readable finding this serves
    page_url: str = ""
    target_type: TargetType
    current_value: Optional[str] = None
    proposed_value: Optional[str] = None
    action: ChangeAction = ChangeAction.INSERT
    target: TargetLocation
    verification: VerificationSpec = Field(default_factory=VerificationSpec)

    state: FixState = FixState.PLANNED
    risk: str = "low"             # low | medium | high — surfaced in review
    message: str = ""             # why it failed / why it is ambiguous / what was skipped
    # Populated at preview time so review shows the real change, not a description of it.
    diff: Optional[str] = None
    conflicts_with: list[str] = Field(default_factory=list)   # fix_ids

    def decide_action(self) -> ChangeAction:
        """Compare current vs proposed and pick the action. This is the idempotency gate:
        running auto-apply twice must reach NOOP the second time, not append a duplicate."""
        proposed = (self.proposed_value or "").strip()
        current = self.current_value.strip() if self.current_value is not None else None
        if not proposed:
            return ChangeAction.NOOP
        if current is None:
            return ChangeAction.INSERT
        if current == proposed:
            return ChangeAction.NOOP
        return ChangeAction.UPDATE

    def summary(self) -> dict:
        """The Step 11 review payload — the user must see exactly where the change lands."""
        return {
            "fix_id": self.fix_id,
            "issue": self.issue,
            "page": self.page_url,
            "platform": self.target.platform,
            "target": self.target.resource_label or self.target.resource_id,
            "mechanism": self.target.mechanism.value,
            "target_property": self.target_type.value,
            "current": self.current_value if self.current_value is not None else "Missing",
            "proposed": self.proposed_value,
            "action": self.action.value,
            "risk": self.risk,
            "state": self.state.value,
            "confidence": round(self.target.confidence, 2),
            "candidates": self.target.candidates,
            "diff": self.diff,
            "message": self.message,
        }
