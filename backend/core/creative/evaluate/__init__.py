"""Brand-consistency evaluation: does this generated asset follow the brand's saved vault?

Entry points
------------
`evaluate_output(facts, data)`  - pure. A brand_facts dict and the generated output in,
                                  a report out. No database, no network. This is what the
                                  tests drive.
`evaluate_asset(creative_id, workspace_id)` - loads the asset and the brand from Postgres,
                                  runs the same thing, persists the report.

Two rules this module exists to keep
------------------------------------
Brand facts are read STRAIGHT FROM POSTGRES, via core.rag.brand_facts. Never through
core.brand_context.brand_facts_context, whose 300s per-workspace cache can still hold the
previous brand after a workspace is re-pointed at a new site. An evaluator reading that
cache would certify an asset against the wrong brand and report it as compliant, which is
worse than not evaluating at all.

Evaluation never changes an asset. There is no path from here to regeneration: these
functions return a report and persist it, and nothing else. Acting on a finding is a
separate, explicit call made by a person.
"""
from __future__ import annotations

from .criteria import build_criteria, criteria_version, profile_fingerprint
from .models import (Criterion, DimensionScore, EvaluationInput, EvaluationReport,
                     Violation)
from .objective import run_objective
from .pixels import run_pixels
from .scoring import score
from .vision import run_vision

__all__ = [
    "evaluate_output", "evaluate_asset", "build_criteria",
    "EvaluationInput", "EvaluationReport", "Criterion", "Violation", "DimensionScore",
]


def evaluate_output(facts: dict, data: EvaluationInput, *,
                    workspace_id: int = 0) -> EvaluationReport:
    """Evaluate generated output against a brand facts dict. Pure - no I/O."""
    criteria = build_criteria(facts, media_type=data.media_type)

    results = list(run_objective(criteria, data))
    tiers = ["objective"]

    if data.media_type in ("image", "video"):
        results.extend(run_pixels(criteria, data))
        tiers.append("pixels")

    vision_results, vision_model = run_vision(criteria, data)
    results.extend(vision_results)
    if vision_model and vision_model != "none":
        tiers.append("vision")

    return score(
        criteria, results,
        media_type=data.media_type,
        workspace_id=workspace_id,
        profile_fingerprint=profile_fingerprint(facts),
        criteria_version=criteria_version(criteria),
        models_used={"vision": vision_model},
        tiers_run=tiers,
    )


def _input_from_asset(asset, *, fetch_image: bool) -> EvaluationInput:
    spec = asset.creative_spec if isinstance(asset.creative_spec, dict) else {}
    data = EvaluationInput(
        media_type=(asset.media_type or "image"),
        headline=asset.headline or spec.get("headline") or "",
        primary_text=asset.body_text or spec.get("primary_text") or "",
        cta=asset.cta or spec.get("cta") or "",
        optimized_prompt=asset.optimized_prompt or "",
    )
    if fetch_image:
        # The image as the model made it when we kept it, otherwise the finished creative.
        # background_url is the pre-overlay frame (service.run records it); measuring the
        # palette there judges what the image model produced rather than the scrim our own
        # overlay paints over it.
        url = (spec.get("background_url") or asset.image_url or "").strip()
        if url:
            try:
                from core.creative.service import _fetch_image_bytes
                data.image_bytes = _fetch_image_bytes(url) or None
            except Exception as e:
                print(f"[brand_eval] could not fetch image for asset {asset.id}: {e}")
    return data


def evaluate_asset(creative_id: int, workspace_id: int, *,
                   fetch_image: bool = True, persist: bool = True):
    """Evaluate a stored creative. Returns the report, or None if the asset is not found.

    The workspace_id filter is not optional and not derived from the asset: it is the
    caller's authorisation, applied in the query, exactly as service.get does it.
    """
    from database import SessionLocal
    import models as db_models
    from core.rag import brand_facts        # authoritative: straight from Postgres

    with SessionLocal() as db:
        asset = db.query(db_models.AdAsset).filter(
            db_models.AdAsset.id == creative_id,
            db_models.AdAsset.workspace_id == workspace_id).first()
        if not asset:
            return None
        data = _input_from_asset(asset, fetch_image=fetch_image)

    facts = brand_facts(workspace_id) or {}
    report = evaluate_output(facts, data, workspace_id=workspace_id)

    if persist:
        save_report(creative_id, workspace_id, report)
    return report


def save_report(creative_id: int, workspace_id: int, report: EvaluationReport) -> None:
    """Append the report to the evaluation history. Never raises."""
    try:
        from database import SessionLocal
        import models as db_models

        with SessionLocal() as db:
            db.add(db_models.BrandEvaluation(
                workspace_id=workspace_id,
                ad_asset_id=creative_id,
                media_type=report.media_type,
                status=report.status,
                overall_score=report.overall_score,
                dimension_scores=[d.model_dump() for d in report.dimensions],
                violations=[v.model_dump() for v in report.violations],
                unknowns=report.unknowns,
                profile_fingerprint=report.profile_fingerprint,
                criteria_version=report.criteria_version,
                models_used=report.models_used,
                tiers_run=report.tiers_run,
                created_at=report.evaluated_at,
            ))
            db.commit()
    except Exception as e:
        # A failed evaluation must never take down whatever generated the asset.
        print(f"[brand_eval] could not persist evaluation for {creative_id}: {e}")
