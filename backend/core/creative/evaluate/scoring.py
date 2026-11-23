"""Turn check results into a report.

Pure arithmetic over the violation list, published so a reader can reproduce it by hand:
each dimension starts at 100 and loses SEVERITY_PENALTY per violation. That transparency is
the reason for a deduction model rather than a learned score - when an ad is rejected, the
person who wrote it is owed an account of why, and "the model said 71" is not one.

Three rules carry more weight than the numbers.

A CRITICAL forces FAIL, outright. An unsupported medical claim inside otherwise excellent
copy must not average away to 85; it is a gate, not a term in a sum.

UNKNOWN never becomes PASS. A dimension nobody could evaluate is excluded from the mean
rather than scored zero - scoring it zero would punish a brand for an incomplete vault -
but if too much of the weight goes unevaluated the report caps at REVIEW. Otherwise a brand
with an empty vault would sail to PASS on the strength of the two checks that happened to
run, which is precisely the false confidence this whole exercise exists to prevent.

A dimension that does not apply to the medium carries weight 0 and is left out entirely, so
text is never marked down for having no visual identity to check.
"""
from __future__ import annotations

from .models import (SEVERITY_PENALTY, CheckResult, Criterion, DimensionScore,
                     EvaluationReport, Violation)

# Per-medium dimension weights. They differ because the same failure does not cost the same
# thing: wording is most of what a caption is, and very little of what a product shot is.
WEIGHTS: dict[str, dict[str, float]] = {
    "text":  {"factual_accuracy": 0.35, "guideline_compliance": 0.30,
              "tone": 0.20, "audience_fit": 0.15, "visual_identity": 0.00},
    "image": {"factual_accuracy": 0.20, "guideline_compliance": 0.15,
              "tone": 0.15, "audience_fit": 0.15, "visual_identity": 0.35},
    "video": {"factual_accuracy": 0.25, "guideline_compliance": 0.15,
              "tone": 0.20, "audience_fit": 0.10, "visual_identity": 0.30},
}

PASS_THRESHOLD = 80
REVIEW_THRESHOLD = 60
# Above this share of unevaluated weight the report cannot claim PASS.
MAX_UNKNOWN_SHARE = 0.40

DIMENSIONS = ("factual_accuracy", "tone", "audience_fit",
              "visual_identity", "guideline_compliance")


def _weights_for(media_type: str) -> dict:
    return WEIGHTS.get((media_type or "image").lower(), WEIGHTS["image"])


def score(criteria: list[Criterion], results: list[CheckResult],
          *, media_type: str, workspace_id: int, profile_fingerprint: str,
          criteria_version: str, models_used: dict, tiers_run: list) -> EvaluationReport:
    by_id = {c.id: c for c in criteria}
    weights = _weights_for(media_type)

    violations: list[Violation] = []
    for r in results:
        violations.extend(r.violations)

    # ---- per-dimension ---------------------------------------------------------------
    dimension_scores: list[DimensionScore] = []
    unknowns: list[str] = []

    for dim in DIMENSIONS:
        weight = weights.get(dim, 0.0)
        dim_results = [r for r in results
                       if by_id.get(r.criterion_id) and by_id[r.criterion_id].dimension == dim]

        evaluated = [r for r in dim_results if r.passed is not None]
        unevaluated = [r for r in dim_results if r.passed is None]
        unknowns.extend(r.criterion_id for r in unevaluated)

        if weight <= 0:
            # Not applicable to this medium: reported, but outside the arithmetic.
            dimension_scores.append(DimensionScore(
                dimension=dim, score=None, status="UNKNOWN", weight=0.0,
                unknown_reason=f"Not applicable to {media_type} output."))
            continue

        if not evaluated:
            reason = next((r.unknown_reason for r in unevaluated if r.unknown_reason),
                          "No criterion for this dimension could be evaluated.")
            dimension_scores.append(DimensionScore(
                dimension=dim, score=None, status="UNKNOWN",
                unknown_reason=reason, weight=weight))
            continue

        penalty = sum(SEVERITY_PENALTY.get(v.severity, 0)
                      for v in violations if v.dimension == dim)
        dimension_scores.append(DimensionScore(
            dimension=dim, score=max(0, 100 - penalty), status="SCORED", weight=weight))

    # ---- overall ---------------------------------------------------------------------
    scored = [d for d in dimension_scores if d.status == "SCORED" and d.weight > 0]
    applicable_weight = sum(weights.get(d.dimension, 0.0) for d in dimension_scores
                            if weights.get(d.dimension, 0.0) > 0)
    scored_weight = sum(d.weight for d in scored)

    if not scored or scored_weight <= 0:
        overall = None
    else:
        overall = round(sum(d.score * d.weight for d in scored) / scored_weight)

    unknown_share = (1.0 - (scored_weight / applicable_weight)) if applicable_weight else 1.0

    has_critical = any(v.severity == "CRITICAL" for v in violations)
    has_high = any(v.severity == "HIGH" for v in violations)

    # How many of the rules that actually ran came from the BRAND, as opposed to our own
    # platform policy and field-presence checks.
    #
    # Without this gate an empty vault scores 100 and passes: the medical-claim policy and
    # "has a headline" both run and both succeed, and nothing else is evaluable. That would
    # certify an unonboarded workspace as on-brand, which is the exact false confidence this
    # evaluator exists to prevent. Zero brand rules applied means the output was never
    # compared to a brand at all, and the only honest verdict is UNKNOWN.
    brand_rules_applied = sum(
        1 for r in results
        if r.passed is not None
        and by_id.get(r.criterion_id)
        and not by_id[r.criterion_id].source_field.startswith("policy.")
    )

    if has_critical:
        status = "FAIL"
    elif brand_rules_applied == 0:
        status = "UNKNOWN"
    elif overall is None:
        status = "UNKNOWN"
    elif overall < REVIEW_THRESHOLD:
        status = "FAIL"
    elif has_high or overall < PASS_THRESHOLD or unknown_share > MAX_UNKNOWN_SHARE:
        status = "REVIEW"
    else:
        status = "PASS"

    return EvaluationReport(
        overall_score=overall,
        status=status,
        dimensions=dimension_scores,
        violations=violations,
        unknowns=sorted(set(unknowns)),
        workspace_id=workspace_id,
        media_type=media_type,
        profile_fingerprint=profile_fingerprint,
        criteria_version=criteria_version,
        models_used=models_used,
        tiers_run=tiers_run,
    )
