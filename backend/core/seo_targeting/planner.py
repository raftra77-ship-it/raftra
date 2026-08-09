"""ChangePlanner — turns one generated UniversalSeoFix into per-property ChangePlans, then
resolves a target for each and detects conflicts between them.

The existing generation path is reused unchanged: core/seo_fix_schema.generate_universal_seo_fix()
still writes the copy, and connector_routes._get_approved_fixes() is still the approval gate.
This module only splits that bundle into individually-targetable units, which is what makes
"the title is fine but the description is missing" expressible.

Conflict detection (Step 14) matters because several plans routinely land in the same file:
title, description, canonical and OG tags on one page are four plans against one <head>. They
are compatible — applied in sequence to the same buffer — so the engine batches them into a
single patch. A genuine conflict is two plans proposing DIFFERENT values for the SAME
property, which is never resolved automatically.
"""
from __future__ import annotations

import json
from typing import Optional

from .change_plan import (ChangeAction, ChangePlan, FixState, TargetLocation, TargetType,
                          VerificationSpec)
from .resolver import ReadFile, ResolutionError, resolve_github_target


def _fix_id(audit_id: Optional[int], page_url: str, t: TargetType) -> str:
    return f"fix::{audit_id or 0}::{page_url or '/'}::{t.value}"


def explode_universal_fix(fix, *, audit_id: Optional[int], page_url: str,
                          issue_id: str = "", issue: str = "") -> list[ChangePlan]:
    """One UniversalSeoFix -> one ChangePlan per populated property.

    Only fields the generator actually filled become plans, which preserves the existing
    guarantee that nothing is applied beyond what the user approved.
    """
    pairs: list[tuple[TargetType, Optional[str]]] = [
        (TargetType.TITLE, fix.title),
        (TargetType.META_DESCRIPTION, fix.meta_description),
        (TargetType.CANONICAL, fix.canonical),
    ]
    if fix.open_graph:
        pairs += [
            (TargetType.OG_TITLE, fix.open_graph.title),
            (TargetType.OG_DESCRIPTION, fix.open_graph.description),
            (TargetType.OG_TYPE, fix.open_graph.type),
        ]
    if fix.twitter:
        pairs += [
            (TargetType.TWITTER_CARD, fix.twitter.card),
            (TargetType.TWITTER_TITLE, fix.twitter.title),
            (TargetType.TWITTER_DESCRIPTION, fix.twitter.description),
        ]
    if fix.schema_jsonld:
        pairs.append((TargetType.JSON_LD, json.dumps(fix.schema_jsonld, indent=2)))

    plans: list[ChangePlan] = []
    for target_type, value in pairs:
        if not value:
            continue
        plans.append(ChangePlan(
            audit_id=audit_id,
            issue_id=issue_id or f"{page_url}::{target_type.value}",
            fix_id=_fix_id(audit_id, page_url, target_type),
            issue=issue or f"{target_type.value} needs to be set",
            page_url=page_url,
            target_type=target_type,
            proposed_value=value,
            action=ChangeAction.INSERT,       # refined once current_value is known
            target=TargetLocation(platform="github", resource_kind="file"),
            state=FixState.PLANNED,
        ))
    return plans


async def resolve_github_plans(plans: list[ChangePlan], *, framework: str, pages: list[dict],
                               read_file: ReadFile, site_base_url: Optional[str] = None
                               ) -> list[ChangePlan]:
    """Attach a TargetLocation to each plan. A plan whose target cannot be resolved becomes
    AMBIGUOUS and carries its candidates — it is never dropped silently, because the user
    needs to see that it was skipped and why."""
    for plan in plans:
        try:
            loc = await resolve_github_target(
                framework=framework, pages=pages, page_url=plan.page_url,
                target_type=plan.target_type, read_file=read_file)
        except ResolutionError as e:
            plan.state = FixState.AMBIGUOUS
            plan.message = e.message
            plan.target.candidates = e.candidates
            continue
        plan.target = loc
        if not loc.is_confident():
            plan.state = FixState.AMBIGUOUS
            plan.message = (f"Only {loc.confidence:.0%} confident that {loc.resource_id} owns "
                            f"{plan.target_type.value}.")
            continue
        plan.state = FixState.TARGET_RESOLVED
        plan.verification = VerificationSpec(
            refetch=True,
            recrawl_url=_absolute(site_base_url, plan.page_url),
            expected_value=plan.proposed_value,
            # A GitHub write is a pull request. Nothing is live until it is merged AND
            # deployed, so verification can never legitimately report FIXED here.
            requires_merge=True,
            notes=("Opened as a pull request — the change is not live until it is merged and "
                   "deployed, so the fix cannot be verified against the live URL yet."),
        )
    return plans


def _absolute(base: Optional[str], page_url: str) -> Optional[str]:
    if not base:
        return None
    return base.rstrip("/") + (page_url if page_url.startswith("/") else f"/{page_url}")


def detect_conflicts(plans: list[ChangePlan]) -> list[ChangePlan]:
    """Flag plans that fight over the same property.

    Same resource + same property + same value is a duplicate, not a conflict: the second is
    marked NOOP. Different values is a real conflict and both sides stop.
    """
    by_key: dict[tuple[str, str], list[ChangePlan]] = {}
    for p in plans:
        if p.state.blocks_apply:
            continue
        by_key.setdefault((p.target.resource_id, p.target_type.value), []).append(p)

    for (_resource, _prop), group in by_key.items():
        if len(group) < 2:
            continue
        values = {(p.proposed_value or "").strip() for p in group}
        if len(values) == 1:
            for dup in group[1:]:
                dup.state = FixState.NOOP
                dup.action = ChangeAction.NOOP
                dup.message = "Duplicate of another approved fix for the same property."
            continue
        ids = [p.fix_id for p in group]
        for p in group:
            p.state = FixState.CONFLICT_DETECTED
            p.conflicts_with = [i for i in ids if i != p.fix_id]
            p.message = (f"{len(group)} approved fixes propose different values for "
                         f"{p.target_type.value} on {p.target.resource_id}. Resolve which one "
                         "should win before applying.")
    return plans


def group_by_resource(plans: list[ChangePlan]) -> dict[str, list[ChangePlan]]:
    """Applicable plans bucketed per file, so several tags become ONE patch to ONE file
    rather than N independent writes racing each other."""
    out: dict[str, list[ChangePlan]] = {}
    for p in plans:
        if p.state.blocks_apply or p.state is FixState.NOOP:
            continue
        if not p.target.resource_id:
            continue
        out.setdefault(p.target.resource_id, []).append(p)
    return out
