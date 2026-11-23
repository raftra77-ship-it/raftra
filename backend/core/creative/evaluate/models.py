"""Result types for brand-consistency evaluation.

Shapes only - no logic, no I/O. Kept apart from the checks so that a caller can read a
stored report without importing PIL, httpx or anything that touches a model.

Two ideas drive the shapes here.

UNKNOWN is a first-class state, not a zero. A brand that never recorded a prohibited-claims
list has not passed the claims check; it has not taken it. Scoring a missing rule as 100
would manufacture confidence out of absence, which is the single most dangerous thing an
evaluator can do, so `DimensionScore.score` is Optional and `status` says which it is.

DETERMINISTIC and MODEL findings never merge into an undifferentiated number. A string that
appears in a brand's own avoid-list is a fact; "this image feels premium" is an opinion. The
`method` field travels on every violation so a reviewer can trust one and weigh the other,
and `confidence` is None for deterministic checks because a literal match is not a guess.
"""
from __future__ import annotations

import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

Severity = Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]
Method = Literal["DETERMINISTIC", "MODEL"]
Dimension = Literal["factual_accuracy", "tone", "audience_fit",
                    "visual_identity", "guideline_compliance"]
Status = Literal["PASS", "REVIEW", "FAIL", "UNKNOWN"]

# How much a single violation costs its dimension. Deliberately coarse and published: a
# reader can reconstruct every dimension score from the violation list by hand, which an
# opaque model score does not allow.
SEVERITY_PENALTY: dict[str, int] = {
    "CRITICAL": 50,
    "HIGH": 25,
    "MEDIUM": 10,
    "LOW": 3,
}


class EvaluationInput(BaseModel):
    """The generated output under evaluation, assembled by the caller.

    Deliberately not an AdAsset: the copy endpoint produces carousel and storyboard slots
    that are never persisted as assets, and they have to be evaluable too. Whoever has the
    output fills this in.
    """
    media_type: str = "image"
    headline: str = ""
    primary_text: str = ""
    cta: str = ""
    # Carousel cards or storyboard scenes, in order. Evaluated as copy alongside the rest.
    scene_texts: list[str] = Field(default_factory=list)
    # What the image model actually received - the proper-noun-leak check reads this.
    optimized_prompt: str = ""
    # Raw bytes of the generated image, when the caller could fetch them. Absent means the
    # pixel tier reports UNKNOWN rather than passing.
    image_bytes: Optional[bytes] = None

    def copy_text(self) -> str:
        """Every word that reaches a viewer, as one block."""
        parts = [self.headline, self.primary_text, self.cta, *self.scene_texts]
        return "\n".join(p for p in parts if (p or "").strip())


class Criterion(BaseModel):
    """One rule this brand is to be judged against, derived from its saved vault.

    `evaluable` is the UNKNOWN carrier. A criterion whose source field is empty is still
    emitted - so the report can say which rules could not be applied and why - but it
    contributes nothing to any score.
    """
    id: str
    dimension: Dimension
    method: Method
    rule: str                      # human-readable, quoted from the vault where possible
    source_field: str              # which brand_facts key produced it; "policy.*" if ours
    severity_if_violated: Severity
    params: dict = Field(default_factory=dict)
    evaluable: bool = True
    unknown_reason: Optional[str] = None


class Violation(BaseModel):
    criterion_id: str
    dimension: Dimension
    severity: Severity
    method: Method
    evidence: str                  # verbatim span from the generated output
    rule: str                      # the brand rule that was violated
    recommendation: str
    confidence: Optional[float] = None   # None for DETERMINISTIC - not a probability


class CheckResult(BaseModel):
    """What one criterion produced. `passed` is None when the check could not run."""
    criterion_id: str
    passed: Optional[bool]
    violations: list[Violation] = Field(default_factory=list)
    unknown_reason: Optional[str] = None


class DimensionScore(BaseModel):
    dimension: Dimension
    score: Optional[int]           # None == UNKNOWN
    status: Literal["SCORED", "UNKNOWN"]
    unknown_reason: Optional[str] = None
    weight: float = 0.0            # the renormalised weight actually applied


class EvaluationReport(BaseModel):
    overall_score: Optional[int]
    status: Status
    dimensions: list[DimensionScore]
    violations: list[Violation]
    unknowns: list[str]            # criterion ids that could not be evaluated

    # --- reproducibility (requirement 8) ---------------------------------------------
    workspace_id: int
    media_type: str
    profile_fingerprint: str       # sha256 of the canonical brand_facts JSON
    criteria_version: str          # sha256 of the criteria set that was applied
    models_used: dict[str, str] = Field(default_factory=dict)
    tiers_run: list[str] = Field(default_factory=list)
    evaluated_at: datetime.datetime = Field(
        default_factory=datetime.datetime.utcnow)

    def critical(self) -> list[Violation]:
        return [v for v in self.violations if v.severity == "CRITICAL"]
