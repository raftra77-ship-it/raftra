"""SafeModifier front door — dispatch a ChangePlan to the modifier for its Mechanism, apply
every plan for a file as ONE patch, then validate the result before anyone publishes it.

Batching per file is deliberate. Title, description, canonical and the OG tags for a page are
four plans against one <head>; applying them as four independent writes would race, and each
would compute its diff against a stale buffer. Here they run in sequence over a single
buffer, so the diff shown for review is the diff that gets committed.

Nothing in this module talks to GitHub. It takes file contents in and hands patched contents
back, which keeps it unit-testable and keeps publishing in the connector layer where the
existing auth already lives.
"""
from __future__ import annotations

import difflib

from pydantic import BaseModel, Field

from .change_plan import ChangeAction, ChangePlan, FixState, Mechanism
from .modifiers import html_head, jsx_helmet, next_metadata
from .validator import ValidationResult, validate

_MODIFIERS = {
    Mechanism.HTML_HEAD: html_head,
    Mechanism.NEXT_METADATA_EXPORT: next_metadata,
    Mechanism.REACT_HELMET: jsx_helmet,
}


class FilePatch(BaseModel):
    path: str
    mechanism: Mechanism
    before: str
    after: str
    changed: bool = False
    diff: str = ""
    applied: list[ChangePlan] = Field(default_factory=list)
    skipped: list[ChangePlan] = Field(default_factory=list)
    validation: ValidationResult = Field(default_factory=ValidationResult)

    @property
    def publishable(self) -> bool:
        return self.changed and self.validation.ok


def supported(mechanism: Mechanism) -> bool:
    return mechanism in _MODIFIERS


def apply_plans_to_file(source: str, plans: list[ChangePlan], *, path: str) -> FilePatch:
    """Run every plan for one file over a single buffer, then validate the end state."""
    mechanism = plans[0].target.mechanism if plans else Mechanism.UNKNOWN
    patch = FilePatch(path=path, mechanism=mechanism, before=source, after=source)

    mod = _MODIFIERS.get(mechanism)
    if mod is None:
        for p in plans:
            p.state = FixState.FAILED
            p.message = (f"No modifier implements {mechanism.value}, so this change cannot be "
                         "made safely.")
            patch.skipped.append(p)
        return patch

    buffer = source
    for plan in plans:
        # Recompute the action against the CURRENT buffer, not against whatever was true
        # when the plan was built — an earlier plan in this same batch may have changed it.
        occurrences = mod.inspect(buffer, plan.target_type)
        plan.current_value = occurrences[0].value if occurrences else None
        plan.action = plan.decide_action()

        if plan.action is ChangeAction.NOOP:
            plan.state = FixState.NOOP
            plan.message = plan.message or f"{plan.target_type.value} is already correct."
            patch.skipped.append(plan)
            continue

        result = mod.apply(buffer, plan, path=path)
        if not result.ok:
            plan.state = FixState.FAILED
            plan.message = result.reason
            plan.target.candidates = plan.target.candidates or result.candidates
            patch.skipped.append(plan)
            continue
        if not result.changed:
            plan.state = FixState.NOOP
            plan.message = result.reason
            patch.skipped.append(plan)
            continue

        buffer = result.content
        plan.diff = result.diff
        plan.state = FixState.READY_FOR_REVIEW
        patch.applied.append(plan)

    patch.after = buffer
    patch.changed = buffer != source
    if patch.changed:
        patch.diff = "".join(difflib.unified_diff(
            source.splitlines(keepends=True), buffer.splitlines(keepends=True),
            fromfile=f"a/{path}", tofile=f"b/{path}", n=3))
        patch.validation = validate(buffer, mechanism, path=path)
        if not patch.validation.ok:
            # Validation failing means the combination is unsafe even though each step
            # succeeded. Nothing from this file may be published.
            for p in patch.applied:
                p.state = FixState.FAILED
                p.message = "Blocked by validation: " + "; ".join(patch.validation.errors)
            patch.skipped.extend(patch.applied)
            patch.applied = []
    return patch


def review_payload(patches: list[FilePatch], blocked: list[ChangePlan]) -> dict:
    """Step 11: exactly what will happen, per change, before anything is written."""
    changes = []
    for patch in patches:
        for plan in patch.applied:
            item = plan.summary()
            item["file"] = patch.path
            changes.append(item)
    return {
        "changes": changes,
        "files": [{"path": p.path, "mechanism": p.mechanism.value, "diff": p.diff,
                   "valid": p.validation.ok, "errors": p.validation.errors}
                  for p in patches if p.changed],
        "skipped": [p.summary() for patch in patches for p in patch.skipped],
        "blocked": [p.summary() for p in blocked],
        "publishable": any(p.publishable for p in patches),
    }
