"""Turn a brand's saved vault into the explicit rules its output is judged against.

Pure: a dict in, a list of Criterion out. No database, no network, no model. That is what
makes the whole evaluator testable in CI, and it is the same shape `brand_facts()` already
returns (core/rag.py), so nothing new has to be extracted or stored to use this.

Two kinds of rule come out of here, and they are labelled rather than blended:

  * vault rules, whose `source_field` names the brand_facts key they came from. These are
    the brand's own words and the report quotes them back.
  * policy rules, prefixed `policy.`. There is exactly one - unsupported medical claims -
    and it exists because a brand that never wrote down "do not claim we cure things" has
    still not licensed that claim. Labelling it keeps requirement 5 honest: it is visibly
    ours, so nobody can mistake it for something the brand stated.

A criterion whose source field is missing is still emitted, with evaluable=False. The
report then says "this rule could not be applied", which is the difference between an
untested brand and a compliant one.
"""
from __future__ import annotations

import hashlib
import json

from .models import Criterion

# Verbs that turn a product sentence into a medical claim. Matched as whole words against
# the copy; the pairing with a health noun is what makes it a claim rather than marketing
# ("cures boredom" is not a medical claim, "cures eczema" is), so both halves are required
# by objective.py rather than this list standing alone.
MEDICAL_VERBS = (
    "cure", "cures", "cured", "curing",
    "heal", "heals", "healed", "healing",
    "treat", "treats", "treated", "treating",
    "prevent", "prevents", "prevented", "preventing",
    "eliminate", "eliminates", "eliminated", "eliminating",
    "reverse", "reverses", "reversed", "reversing",
)

# Phrases that are a regulated claim ON THEIR OWN, with no condition named. These used to
# sit in MEDICAL_VERBS, which meant they only fired when paired with a health noun - so
# "clinically proven injury prevention" passed, because "injury" is not a listed condition.
# Measured on workspace 15, whose vault records no prohibited claims: the generator
# produced "Clinically proven injury prevention ... the cheapest running shoes you can buy"
# and the evaluator raised nothing. Asserting a clinical trial is a claim whatever follows
# it, so these are matched alone.
STANDALONE_MEDICAL = (
    "clinically proven", "clinically tested", "dermatologist proven",
    "dermatologist tested", "medically proven", "doctor recommended",
    "fda approved", "fda-approved", "pharmaceutical grade",
)

# Health nouns a claim would attach to. Short and conservative on purpose: this list only
# ever raises a CRITICAL, and a CRITICAL forces FAIL, so a loose list would reject good
# work. Anything subtler than this belongs to the vision/LLM tier, not here.
HEALTH_NOUNS = (
    "eczema", "acne", "psoriasis", "rosacea", "dermatitis", "cancer", "diabetes",
    "arthritis", "asthma", "depression", "anxiety", "insomnia", "infection",
    "wrinkles", "hair loss", "baldness", "scars", "allergies", "inflammation",
    # "prevents injury" is the claim a footwear or fitness brand reaches for, and it is a
    # health outcome like any other. Added after it was generated unchecked for a brand
    # with an empty prohibited-claims list.
    "injury", "injuries", "pain", "soreness",
)

# Absolute and comparative claims that need substantiation nobody has supplied. Separate
# from the medical list because the risk is advertising law rather than health: "cheapest"
# and "best" are comparative claims a brand must be able to evidence.
#
# A brand MAY license these by writing them into verified_claims - build_criteria passes
# that list through, and objective.py skips any phrase the brand has already stood behind,
# so a genuine "India's #1" that the brand can evidence is not blocked.
ABSOLUTE_CLAIMS = (
    "cheapest", "most affordable", "lowest price", "lowest priced",
    "best in the world", "best in the market", "world's best", "number one",
    "no. 1", "#1", "guaranteed results", "risk free", "risk-free",
    "unbeatable", "100% effective", "miracle",
)


def _text(value) -> str:
    return value.strip() if isinstance(value, str) else ""


def build_criteria(facts: dict, media_type: str = "image") -> list[Criterion]:
    """The rule set for this brand and medium, in report order."""
    facts = facts or {}
    out: list[Criterion] = []

    # ---- factual accuracy -----------------------------------------------------------
    unsupported = [c for c in (facts.get("unsupported_topics") or []) if _text(c)]
    out.append(Criterion(
        id="claims.unsupported",
        dimension="factual_accuracy",
        method="DETERMINISTIC",
        rule=("The brand's vault lists these as unsupported: "
              + "; ".join(unsupported[:10])) if unsupported else
             "No prohibited-claims list is recorded for this brand.",
        source_field="unsupported_topics",
        severity_if_violated="CRITICAL",
        params={"topics": unsupported},
        evaluable=bool(unsupported),
        unknown_reason=None if unsupported else
            "The brand vault records no unsupported_topics, so prohibited claims cannot be "
            "checked against this brand. Absence of a list is not permission.",
    ))

    # Ours, not the brand's - and said so in `source_field` and `rule`.
    out.append(Criterion(
        id="policy.medical_claims",
        dimension="factual_accuracy",
        method="DETERMINISTIC",
        rule=("Platform policy (not a brand-stated rule): advertising copy may not claim to "
              "cure, treat, heal, prevent or reverse a named medical condition, nor assert "
              "clinical or regulatory endorsement."),
        source_field="policy.medical_claims",
        severity_if_violated="CRITICAL",
        params={"verbs": list(MEDICAL_VERBS), "nouns": list(HEALTH_NOUNS),
                "standalone": list(STANDALONE_MEDICAL)},
        evaluable=True,
    ))

    # Also ours. Applies to every brand for the same reason the medical rule does: a brand
    # that never wrote down "we are not the cheapest" has still not substantiated being so.
    # verified_claims is passed through so a brand that CAN evidence the claim keeps it.
    verified = [v for v in (facts.get("verified_claims") or []) if _text(v)]
    out.append(Criterion(
        id="policy.absolute_claims",
        dimension="factual_accuracy",
        method="DETERMINISTIC",
        rule=("Platform policy (not a brand-stated rule): superlative and comparative "
              "claims such as cheapest, best or number one need substantiation. Add the "
              "claim to verified_claims in Brand Knowledge to license it."),
        source_field="policy.absolute_claims",
        severity_if_violated="HIGH",
        params={"phrases": list(ABSOLUTE_CLAIMS), "verified": verified},
        evaluable=True,
    ))

    # ---- guideline compliance -------------------------------------------------------
    voice = facts.get("voice") if isinstance(facts.get("voice"), dict) else {}
    avoid = [w for w in (voice.get("avoid_words") or []) if _text(w)]
    out.append(Criterion(
        id="voice.avoid_words",
        dimension="guideline_compliance",
        method="DETERMINISTIC",
        rule=("The brand's voice guide forbids these words: " + ", ".join(avoid[:12]))
             if avoid else "No forbidden-word list is recorded for this brand.",
        source_field="voice.avoid_words",
        severity_if_violated="HIGH",
        params={"words": avoid},
        evaluable=bool(avoid),
        unknown_reason=None if avoid else
            "The brand vault records no voice.avoid_words, so forbidden wording cannot be "
            "checked.",
    ))

    out.append(Criterion(
        id="copy.required_fields",
        dimension="guideline_compliance",
        method="DETERMINISTIC",
        rule="A finished creative carries a headline and a call to action.",
        source_field="policy.required_copy",
        severity_if_violated="MEDIUM",
        params={},
        evaluable=True,
    ))

    brand_name = _text(facts.get("name"))
    product_terms = []
    for c in (facts.get("catalogue") or []):
        if isinstance(c, dict):
            product_terms.extend(str(p) for p in (c.get("products") or [])[:6])
    out.append(Criterion(
        id="prompt.proper_noun_leak",
        dimension="guideline_compliance",
        method="DETERMINISTIC",
        rule=("The brand name and product names must not reach the image model: it cannot "
              "type, so a proper noun in the prompt returns as garbled lettering baked "
              "into the picture."),
        source_field="name + catalogue.products",
        severity_if_violated="MEDIUM",
        params={"terms": ([brand_name] if brand_name else []) + product_terms},
        evaluable=bool(brand_name or product_terms),
        unknown_reason=None if (brand_name or product_terms) else
            "The brand vault records no name or catalogue products to look for.",
    ))

    # ---- visual identity ------------------------------------------------------------
    tokens = [t for t in (facts.get("color_tokens") or []) if isinstance(t, dict) and t.get("hex")]
    palette = [h for h in (facts.get("color_palette") or []) if isinstance(h, str)]
    has_colour = bool(tokens or palette)
    out.append(Criterion(
        id="visual.palette",
        dimension="visual_identity",
        method="DETERMINISTIC",
        rule=("The creative's dominant colours should include the brand palette: "
              + ", ".join([t.get("hex", "") for t in tokens[:6]] or palette[:6]))
             if has_colour else "No brand palette is recorded.",
        source_field="color_tokens / color_palette",
        severity_if_violated="MEDIUM",
        params={"tokens": tokens, "palette": palette},
        evaluable=has_colour,
        unknown_reason=None if has_colour else
            "The brand vault records no colour palette, so visual identity cannot be "
            "checked against one.",
    ))

    # Deliberately never evaluable in this cut. Two independent reasons, and saying so in
    # the report is the point: a silent PASS here would be a lie about an untested property.
    out.append(Criterion(
        id="visual.logo",
        dimension="visual_identity",
        method="MODEL",
        rule="Approved brand logo present and undistorted.",
        source_field="logos",
        severity_if_violated="HIGH",
        params={"logos": facts.get("logos") or []},
        evaluable=False,
        unknown_reason=(
            "Not evaluated. Logo identity needs template matching that is unreliable under "
            "the scaling, rotation and compression these providers emit, and the generation "
            "pipeline does not composite a logo at all, so absence here would not indicate "
            "a violation."),
    ))

    # ---- tone and audience: subjective, so Tier 3 only ------------------------------
    traits = (voice.get("traits") or []) if isinstance(voice, dict) else []
    out.append(Criterion(
        id="tone.voice_match",
        dimension="tone",
        method="MODEL",
        rule=("Copy is written in the brand's stated voice: "
              + "; ".join(t.get("trait", "") for t in traits[:5] if isinstance(t, dict)))
             if traits else "No voice traits are recorded for this brand.",
        source_field="voice.traits",
        severity_if_violated="MEDIUM",
        params={"traits": traits},
        evaluable=False,
        unknown_reason=(
            "Tone is a subjective judgement and needs the vision/LLM tier, which is not "
            "enabled in this build." if traits else
            "The brand vault records no voice traits, and tone needs the model tier."),
    ))

    personas = [p for p in (facts.get("target_audiences") or []) if isinstance(p, dict)]
    audience = _text(facts.get("audience"))
    out.append(Criterion(
        id="audience.fit",
        dimension="audience_fit",
        method="MODEL",
        rule=("Copy addresses the brand's stated audience: "
              + (audience or "; ".join(p.get("persona", "") for p in personas[:4])))
             if (audience or personas) else "No audience is recorded for this brand.",
        source_field="audience / target_audiences",
        severity_if_violated="MEDIUM",
        params={"audience": audience, "personas": personas},
        evaluable=False,
        unknown_reason=(
            "Audience fit is a subjective judgement and needs the vision/LLM tier, which is "
            "not enabled in this build." if (audience or personas) else
            "The brand vault records no audience, and audience fit needs the model tier."),
    ))

    return out


def criteria_version(criteria: list[Criterion]) -> str:
    """A stable hash of the rule set, so two reports can be compared like for like.

    Covers the identity and severity of every rule and whether it could be applied - the
    things that change what a score MEANS - and deliberately not `params`, so re-running
    against the same rules with an edited word list is still recognisably the same criteria
    set. The brand side of that change is already carried by profile_fingerprint.
    """
    payload = [
        {"id": c.id, "dimension": c.dimension, "method": c.method,
         "severity": c.severity_if_violated, "evaluable": c.evaluable}
        for c in sorted(criteria, key=lambda c: c.id)
    ]
    blob = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]


def profile_fingerprint(facts: dict) -> str:
    """A stable hash of the brand facts the evaluation saw.

    BrandProfile carries no version column and no updated_at - checked - so there is no
    cheap way to say "which revision of the brand was this judged against". Hashing the
    canonical facts answers the same question without a migration, and changes on any edit,
    including one made inside the guidelines JSON.
    """
    blob = json.dumps(facts or {}, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]
