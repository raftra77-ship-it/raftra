"""Brand-consistency evaluator: behaviour that must not drift.

Pure and offline, like test_extraction_budgets.py - no database, no network, no model. The
evaluator was built in layers specifically so this file could exist: criteria, objective
checks and scoring are all functions over plain dicts.

Run: .venv/Scripts/python.exe -m pytest test_brand_consistency.py -q
"""
import io

from core.creative.evaluate import evaluate_output
from core.creative.evaluate.criteria import build_criteria, profile_fingerprint
from core.creative.evaluate.models import SEVERITY_PENALTY, EvaluationInput

# --------------------------------------------------------------------------- fixtures
#
# Two brands that could not plausibly share an advert. The contrast is the instrument: any
# check that passes output from one against the other is not reading the brand at all.

SKINCARE = {
    "name": "Verdalis",
    "url": "https://verdalis.example",
    "color_tokens": [
        {"name": "sage", "hex": "#7C9A80", "role": "primary"},
        {"name": "ivory", "hex": "#F6F1E7", "role": "background"},
    ],
    "color_palette": ["#F6F1E7", "#7C9A80", "#D9C9B0"],
    "typography": {"primary": "Canela"},
    "audience": "environmentally conscious women aged 25-40",
    "target_audiences": [{"persona": "eco-conscious buyer", "need": "clean ingredients"}],
    "voice": {
        "traits": [{"trait": "calm", "sounds_like": "measured and unhurried"}],
        "avoid_words": ["miracle", "blast", "cheap", "guaranteed"],
    },
    "unsupported_topics": ["clinically proven results", "dermatologist certification"],
    "verified_claims": ["formulated without animal-derived ingredients"],
    "catalogue": [{"name": "moisturisers", "products": ["Verdalis Daily Moisturiser"]}],
}

ELECTRONICS = {
    "name": "Voltiq",
    "url": "https://voltiq.example",
    "color_tokens": [{"name": "electric blue", "hex": "#1E5BFF", "role": "primary"}],
    "color_palette": ["#0B0B0B", "#1E5BFF"],
    "audience": "value-seeking students aged 18-24",
    "voice": {
        "traits": [{"trait": "blunt", "sounds_like": "short and loud"}],
        # The skincare brand's compliant copy uses "gentle" - deliberately, so the
        # cross-brand test has a real mechanism to catch rather than a coincidence.
        "avoid_words": ["gentle", "botanical", "serum"],
    },
    "unsupported_topics": ["fastest charger in India"],
    "catalogue": [{"name": "chargers", "products": ["Voltiq 65W"]}],
}

COMPLIANT = EvaluationInput(
    media_type="text",
    headline="Quiet care for everyday skin",
    primary_text="A gentle plant-based moisturiser, made without animal-derived ingredients.",
    cta="Discover the range",
    optimized_prompt=("a ceramic jar of pale cream on a linen cloth, soft morning light, "
                      "muted green and ivory tones, shallow depth of field"),
)

# Tone drifts off-brand and trips the avoid-list, but asserts nothing untrue.
PARTIAL = EvaluationInput(
    media_type="text",
    headline="The miracle your skin has waited for",
    primary_text="A plant-based moisturiser for everyday use.",
    cta="Shop now",
    optimized_prompt="a ceramic jar of pale cream on a linen cloth, soft morning light",
)

NONCOMPLIANT = EvaluationInput(
    media_type="text",
    headline="Cures eczema in 24 hours",
    primary_text="Clinically proven results from the first application.",
    cta="Buy now",
    optimized_prompt="a ceramic jar of pale cream on a linen cloth",
)


def _solid_png(hex_colour: str, size=(64, 64)) -> bytes:
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", size, hex_colour).save(buf, format="PNG")
    return buf.getvalue()


# ----------------------------------------------------------------- the four headline cases

def test_compliant_output_passes():
    r = evaluate_output(SKINCARE, COMPLIANT)
    assert r.status == "PASS", (r.status, [v.evidence for v in r.violations])
    assert not r.violations


def test_partially_compliant_is_review_never_pass():
    r = evaluate_output(SKINCARE, PARTIAL)
    assert r.status == "REVIEW"
    assert not r.critical()
    assert any(v.severity == "HIGH" and "miracle" in v.evidence.lower()
               for v in r.violations)


def test_noncompliant_fails_with_a_critical_violation():
    r = evaluate_output(SKINCARE, NONCOMPLIANT)
    assert r.status == "FAIL"
    crit = r.critical()
    assert crit, "an unsupported medical claim must be CRITICAL"
    # The report has to show the offending words and name the rule, not just a score.
    assert any("eczema" in v.evidence.lower() for v in crit)
    assert all(v.rule for v in crit)
    assert all(v.recommendation for v in crit)


def test_empty_brand_is_unknown_and_never_passes():
    """No saved knowledge means nothing was checked against a brand."""
    r = evaluate_output({}, COMPLIANT)
    assert r.status == "UNKNOWN"
    assert r.status != "PASS"
    assert "claims.unsupported" in r.unknowns
    assert "voice.avoid_words" in r.unknowns


# ------------------------------------------------------------------------- cross-brand

def test_output_for_one_brand_does_not_pass_against_another():
    """The instrument test: identical copy, two brands, different verdicts."""
    own = evaluate_output(SKINCARE, COMPLIANT)
    other = evaluate_output(ELECTRONICS, COMPLIANT)
    assert own.status == "PASS"
    assert other.status != "PASS"
    assert any("gentle" in v.evidence.lower() for v in other.violations)


def test_cross_brand_verdicts_are_not_accidentally_identical():
    a = evaluate_output(SKINCARE, COMPLIANT)
    b = evaluate_output(ELECTRONICS, COMPLIANT)
    assert a.profile_fingerprint != b.profile_fingerprint
    assert (a.status, a.overall_score) != (b.status, b.overall_score)


# ------------------------------------------------------------- UNKNOWN is never a pass

def test_missing_claims_list_is_unknown_not_satisfied():
    facts = dict(SKINCARE)
    facts.pop("unsupported_topics")
    r = evaluate_output(facts, COMPLIANT)
    assert "claims.unsupported" in r.unknowns
    assert all(v.criterion_id != "claims.unsupported" for v in r.violations)


def test_logo_is_always_reported_unknown_in_this_build():
    r = evaluate_output(SKINCARE, COMPLIANT)
    assert "visual.logo" in r.unknowns


def test_tone_and_audience_are_unknown_without_a_vision_tier():
    r = evaluate_output(SKINCARE, COMPLIANT)
    by_dim = {d.dimension: d for d in r.dimensions}
    assert by_dim["tone"].status == "UNKNOWN"
    assert by_dim["audience_fit"].status == "UNKNOWN"
    assert by_dim["tone"].score is None     # UNKNOWN is not zero
    assert r.models_used.get("vision") == "none"


def test_image_without_bytes_cannot_pass_on_visual_identity():
    data = COMPLIANT.model_copy(update={"media_type": "image", "image_bytes": None})
    r = evaluate_output(SKINCARE, data)
    assert "visual.palette" in r.unknowns
    assert r.status != "PASS"       # too much unevaluated weight to claim a pass


# ------------------------------------------------------------------- critical overrides

def test_a_critical_forces_fail_even_when_everything_else_is_clean():
    data = COMPLIANT.model_copy(update={
        "primary_text": COMPLIANT.primary_text + " It cures eczema."})
    r = evaluate_output(SKINCARE, data)
    assert r.status == "FAIL"
    # And not because the average dropped - the gate fires regardless of the mean.
    assert r.overall_score is not None and r.overall_score > 60


def test_negated_claim_is_not_flagged():
    """'does not cure eczema' is the opposite of a violation."""
    data = COMPLIANT.model_copy(update={
        "primary_text": "This moisturiser does not cure eczema or any medical condition."})
    r = evaluate_output(SKINCARE, data)
    assert not r.critical()


def test_marketing_verb_without_a_health_noun_is_not_a_medical_claim():
    data = COMPLIANT.model_copy(update={"headline": "Cures dull afternoons"})
    r = evaluate_output(SKINCARE, data)
    assert not r.critical()


# --------------------------------------------------------------------- prompt hygiene

def test_brand_name_reaching_the_image_model_is_flagged():
    data = COMPLIANT.model_copy(update={
        "optimized_prompt": "a jar of Verdalis Daily Moisturiser on linen"})
    r = evaluate_output(SKINCARE, data)
    assert any(v.criterion_id == "prompt.proper_noun_leak" for v in r.violations)


def test_missing_headline_or_cta_is_a_violation():
    data = COMPLIANT.model_copy(update={"cta": ""})
    r = evaluate_output(SKINCARE, data)
    assert any(v.criterion_id == "copy.required_fields" for v in r.violations)


# ------------------------------------------------------------------------- palette tier

def test_brand_colour_in_the_image_passes_the_palette_check():
    data = COMPLIANT.model_copy(update={
        "media_type": "image", "image_bytes": _solid_png("#7C9A80")})
    r = evaluate_output(SKINCARE, data)
    assert all(v.criterion_id != "visual.palette" for v in r.violations)


def test_off_brand_image_violates_the_palette_check():
    data = COMPLIANT.model_copy(update={
        "media_type": "image", "image_bytes": _solid_png("#FF00FF")})
    r = evaluate_output(SKINCARE, data)
    assert any(v.criterion_id == "visual.palette" for v in r.violations)


def test_a_neutral_only_palette_is_unknown_not_passed():
    """White and black match any photograph, so they cannot evidence brand identity."""
    facts = dict(SKINCARE, color_tokens=[], color_palette=["#FFFFFF", "#000000"])
    data = COMPLIANT.model_copy(update={
        "media_type": "image", "image_bytes": _solid_png("#FF00FF")})
    r = evaluate_output(facts, data)
    assert "visual.palette" in r.unknowns


# ------------------------------------------------------------- scoring and provenance

def test_dimension_score_is_reproducible_from_the_violation_list():
    r = evaluate_output(SKINCARE, PARTIAL)
    by_dim = {d.dimension: d for d in r.dimensions}
    expected = 100 - sum(SEVERITY_PENALTY[v.severity]
                         for v in r.violations if v.dimension == "guideline_compliance")
    assert by_dim["guideline_compliance"].score == max(0, expected)


def test_fingerprint_is_stable_and_changes_on_a_brand_edit():
    assert profile_fingerprint(SKINCARE) == profile_fingerprint(dict(SKINCARE))
    edited = dict(SKINCARE, audience="teenagers")
    assert profile_fingerprint(edited) != profile_fingerprint(SKINCARE)


def test_report_records_what_it_needs_to_be_reproduced():
    r = evaluate_output(SKINCARE, COMPLIANT, workspace_id=7)
    assert r.workspace_id == 7
    assert r.profile_fingerprint and r.criteria_version
    assert "objective" in r.tiers_run
    assert r.evaluated_at is not None


def test_every_criterion_cites_a_source_field():
    """A rule with no provenance cannot be defended to the person whose ad was rejected."""
    for c in build_criteria(SKINCARE, media_type="image"):
        assert c.source_field, c.id
        assert c.rule, c.id
        if not c.evaluable:
            assert c.unknown_reason, c.id


def test_evaluation_does_not_mutate_its_inputs():
    facts_before = dict(SKINCARE)
    data_before = COMPLIANT.model_dump()
    evaluate_output(SKINCARE, COMPLIANT)
    assert SKINCARE == facts_before
    assert COMPLIANT.model_dump() == data_before


# ---------------------------------------------------------------------------------------
# Platform-policy claim floor.
#
# These exist because of a measured failure, not a hypothetical. Workspace 15's vault
# records no unsupported_topics, and asked for "the cheapest running shoes, clinically
# proven to prevent injury" the pipeline produced exactly that - "Clinically proven injury
# prevention ... the cheapest running shoes you can buy" - and the evaluator raised nothing,
# because every claim rule it had was sourced from a vault field that was empty. Workspace
# 12, whose vault lists six prohibited topics, refused the same prompt. Safety that depends
# entirely on how completely a customer filled in their vault is not safety, so the two
# policy.* criteria below apply to every brand.

from core.creative.evaluate import evaluate_output
from core.creative.evaluate.models import EvaluationInput

_UNSAFE = EvaluationInput(
    media_type="image",
    headline="The Most Affordable Running Shoes, Built to Prevent Injury",
    primary_text=("Clinically proven injury prevention combined with maximum support "
                  "makes these the cheapest running shoes you can buy."),
    cta="Shop Now",
    optimized_prompt="studio shot of a running shoe",
)


def test_empty_vault_still_fails_regulated_and_comparative_claims():
    """The ws15 case: no prohibited-claims list, so the vault rule is UNKNOWN - the policy
    rules have to carry it."""
    report = evaluate_output({"name": "Thin Brand"}, _UNSAFE)
    ids = {v.criterion_id for v in report.violations}
    assert "policy.medical_claims" in ids
    assert "policy.absolute_claims" in ids
    assert report.status == "FAIL"


def test_standalone_regulated_phrase_fires_without_a_named_condition():
    """"clinically proven" used to need a health noun beside it to count, so "clinically
    proven injury prevention" passed - "injury" was not a listed condition."""
    data = EvaluationInput(media_type="image", headline="Clinically proven performance",
                           primary_text="Built for runners.", cta="Shop")
    report = evaluate_output({"name": "Thin Brand"}, data)
    assert any(v.criterion_id == "policy.medical_claims" for v in report.violations)


def test_a_brand_may_license_a_superlative_through_verified_claims():
    """The rule is 'unsubstantiated', not 'never'. A brand that can evidence the claim and
    has recorded it keeps it."""
    data = EvaluationInput(media_type="image", headline="India's number one running shoe",
                           primary_text="Built for runners.", cta="Shop")
    facts = {"name": "Evidenced Brand",
             "verified_claims": ["number one running shoe by 2026 retail volume"]}
    report = evaluate_output(facts, data)
    assert not any(v.criterion_id == "policy.absolute_claims" for v in report.violations)


def test_ordinary_copy_is_not_blocked_by_the_policy_floor():
    """The floor must not fire on normal marketing language, or it is worse than useless."""
    data = EvaluationInput(
        media_type="image", headline="Every. Day. Speed.",
        primary_text="Responsive cushioning engineered for daily training and long runs.",
        cta="Shop Now", optimized_prompt="runner mid-stride on a track at sunrise")
    report = evaluate_output({"name": "Nike"}, data)
    policy_hits = [v.criterion_id for v in report.violations
                   if v.criterion_id.startswith("policy.")]
    assert policy_hits == []
