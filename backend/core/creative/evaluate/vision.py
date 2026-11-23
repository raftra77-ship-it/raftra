"""Tier 3: the seam a vision model plugs into. Nothing in this build calls one.

The interface exists now so that enabling vision later is a registration, not a refactor:
`run_vision` already runs in the pipeline, already receives the MODEL criteria, and already
has its results folded into scoring. Today the only implementation returns UNKNOWN for
every criterion it is handed.

That is the whole point of the file. The alternative - leaving tone and audience out of the
report entirely - would produce a document that looks complete and silently omits the two
dimensions nobody has checked. Reporting them as UNKNOWN, with the reason, is what keeps a
PASS from meaning more than it should; scoring.py then caps the overall status at REVIEW
whenever too much of the weight is unevaluated.
"""
from __future__ import annotations

import os
from typing import Optional, Protocol

from .models import CheckResult, Criterion, EvaluationInput


class VisionEvaluator(Protocol):
    """What a real Tier 3 implementation has to provide.

    `name` is recorded in the report's models_used, because a subjective score is only
    comparable against another score from the same model.
    """
    name: str

    def evaluate(self, criteria: list[Criterion],
                 data: EvaluationInput) -> list[CheckResult]:
        ...


class NullVisionEvaluator:
    """Answers every MODEL criterion with UNKNOWN, never with a pass."""

    name = "none"

    def evaluate(self, criteria: list[Criterion],
                 data: EvaluationInput) -> list[CheckResult]:
        return [
            CheckResult(
                criterion_id=c.id, passed=None,
                unknown_reason=(c.unknown_reason or
                                "No vision/LLM evaluator is enabled in this build."))
            for c in criteria if c.method == "MODEL"
        ]


_REGISTRY: dict = {}


def register(name: str, factory) -> None:
    """Make an implementation available to BRAND_EVAL_VISION. Called by whoever adds one."""
    _REGISTRY[name] = factory


def get_vision_evaluator() -> VisionEvaluator:
    """The configured evaluator, or the null one.

    Opt-in by design: Tier 3 costs money per evaluation, so an unset variable must never
    start spending. An unknown name falls back to null rather than raising - a
    misconfiguration should degrade the report, not break generation.
    """
    name = (os.getenv("BRAND_EVAL_VISION") or "").strip().lower()
    if not name or name == "none":
        return NullVisionEvaluator()
    factory = _REGISTRY.get(name)
    if factory is None:
        print(f"[brand_eval] BRAND_EVAL_VISION={name!r} is not registered; "
              f"MODEL criteria will be reported UNKNOWN.")
        return NullVisionEvaluator()
    try:
        return factory()
    except Exception as e:
        print(f"[brand_eval] vision evaluator {name!r} failed to start ({e}); "
              f"MODEL criteria will be reported UNKNOWN.")
        return NullVisionEvaluator()


def run_vision(criteria: list[Criterion], data: EvaluationInput,
               evaluator: Optional[VisionEvaluator] = None) -> tuple:
    """(results, model_name). Never raises - a dead evaluator yields UNKNOWN, not a 500."""
    ev = evaluator or get_vision_evaluator()
    model_criteria = [c for c in criteria if c.method == "MODEL"]
    if not model_criteria:
        return [], getattr(ev, "name", "none")
    try:
        return ev.evaluate(model_criteria, data), getattr(ev, "name", "none")
    except Exception as e:
        return ([CheckResult(criterion_id=c.id, passed=None,
                             unknown_reason=f"Vision evaluation failed: {e}")
                 for c in model_criteria], getattr(ev, "name", "none"))
