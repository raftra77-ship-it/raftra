"""Tier 1: checks that are decided, not judged.

Everything here is a literal or near-literal match against the brand's own recorded words.
No model is called, nothing is inferred, and `confidence` stays None on every violation
because a string match is not a probability.

On the deliberate conservatism
------------------------------
`claims.unsupported` and `policy.medical_claims` raise CRITICAL, and a CRITICAL forces the
whole report to FAIL. A false positive therefore rejects good work, so both checks are
built to under-report rather than over-report:

  * a topic must have essentially all of its content words present before it counts;
  * a medical claim needs a prohibited VERB and a health NOUN in the same sentence, since
    "cures boredom" is marketing and "cures eczema" is a regulated claim;
  * any negation in the matched sentence suppresses the finding entirely.

That last rule is the honest limitation. "This is not a cure - but it cures eczema" is
missed. Lexical matching cannot resolve scope of negation, and the alternative - flagging
anything near a prohibited word - would FAIL ordinary copy like "free from parabens". The
entailment judgement that would get this right belongs to the model tier, which this build
does not enable; until then this check finds the blatant cases and says nothing about the
subtle ones.
"""
from __future__ import annotations

import re

from .models import CheckResult, Criterion, EvaluationInput, Violation

# Words too common to carry meaning in a topic match. Keeping this tiny and explicit beats
# a dependency on an NLP stopword corpus for a list this short.
_STOP = {
    "the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "with", "is", "are",
    "be", "it", "that", "this", "our", "your", "we", "you", "from", "by", "at", "as",
}

_NEGATION = (
    "not", "no", "never", "without", "cannot", "can't", "don't", "doesn't", "isn't",
    "aren't", "won't", "free from", "free of", "avoid", "neither", "nor",
)

_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+|\n+")
_WORD = re.compile(r"[a-z0-9']+")


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in _SENT_SPLIT.split(text or "") if s.strip()]


def _words(text: str) -> set:
    return set(_WORD.findall((text or "").lower()))


def _content_words(phrase: str) -> list[str]:
    return [w for w in _WORD.findall((phrase or "").lower())
            if w not in _STOP and len(w) > 2]


def _negated(sentence: str) -> bool:
    low = f" {(sentence or '').lower()} "
    if any(f" {n} " in low for n in _NEGATION if " " not in n):
        return True
    return any(n in low for n in _NEGATION if " " in n)


def _contains_word(haystack: str, needle: str) -> bool:
    """Whole-word / whole-phrase containment, case-insensitive."""
    if not needle.strip():
        return False
    pattern = r"(?<!\w)" + re.escape(needle.strip().lower()) + r"(?!\w)"
    return re.search(pattern, (haystack or "").lower()) is not None


# --------------------------------------------------------------------------- the checks

def _check_unsupported_claims(c: Criterion, data: EvaluationInput) -> CheckResult:
    text = data.copy_text()
    violations = []
    for topic in c.params.get("topics") or []:
        needed = _content_words(topic)
        if not needed:
            continue
        for sentence in _sentences(text):
            present = _words(sentence)
            hit = [w for w in needed if w in present]
            # "essentially all": every content word, or all but one on longer topics.
            threshold = len(needed) if len(needed) <= 2 else len(needed) - 1
            if len(hit) < threshold:
                continue
            if _negated(sentence):
                continue
            violations.append(Violation(
                criterion_id=c.id, dimension=c.dimension,
                severity=c.severity_if_violated, method=c.method,
                evidence=sentence,
                rule=f"The brand vault lists \"{topic}\" as unsupported.",
                recommendation=(
                    f"Remove or soften the claim about \"{topic}\". If the brand can "
                    f"substantiate it, add it to verified_claims in Brand Knowledge first."),
            ))
            break   # one finding per topic is enough to fail; do not pile on
    return CheckResult(criterion_id=c.id, passed=not violations, violations=violations)


def _check_medical_claims(c: Criterion, data: EvaluationInput) -> CheckResult:
    text = data.copy_text()
    verbs = c.params.get("verbs") or []
    nouns = c.params.get("nouns") or []
    standalone = c.params.get("standalone") or []
    violations = []
    for sentence in _sentences(text):
        if _negated(sentence):
            continue
        # A regulated phrase is a claim with or without a named condition, so it is tested
        # before the verb+noun pairing rather than through it.
        alone = next((p for p in standalone if _contains_word(sentence, p)), None)
        if alone:
            violations.append(Violation(
                criterion_id=c.id, dimension=c.dimension,
                severity=c.severity_if_violated, method=c.method,
                evidence=sentence,
                rule=c.rule,
                recommendation=(
                    f"\"{alone}\" asserts clinical or regulatory endorsement. Remove it "
                    f"unless the brand holds that evidence, in which case record it in "
                    f"verified_claims in Brand Knowledge."),
            ))
            break
        verb = next((v for v in verbs if _contains_word(sentence, v)), None)
        noun = next((n for n in nouns if _contains_word(sentence, n)), None)
        if verb and noun:
            violations.append(Violation(
                criterion_id=c.id, dimension=c.dimension,
                severity=c.severity_if_violated, method=c.method,
                evidence=sentence,
                rule=c.rule,
                recommendation=(
                    f"\"{verb}\" applied to \"{noun}\" is a medical claim. Rewrite as an "
                    f"observation about the product rather than an outcome for a "
                    f"condition, or remove it."),
            ))
            break
    return CheckResult(criterion_id=c.id, passed=not violations, violations=violations)


def _check_avoid_words(c: Criterion, data: EvaluationInput) -> CheckResult:
    text = data.copy_text()
    violations = []
    for word in c.params.get("words") or []:
        if not _contains_word(text, word):
            continue
        sentence = next((s for s in _sentences(text) if _contains_word(s, word)), text)
        violations.append(Violation(
            criterion_id=c.id, dimension=c.dimension,
            severity=c.severity_if_violated, method=c.method,
            evidence=sentence,
            rule=f"The brand's voice guide lists \"{word}\" as a word to avoid.",
            recommendation=f"Replace \"{word}\" with wording from the brand's preferred list.",
        ))
    return CheckResult(criterion_id=c.id, passed=not violations, violations=violations)


def _check_required_fields(c: Criterion, data: EvaluationInput) -> CheckResult:
    missing = [name for name, value in (("headline", data.headline), ("cta", data.cta))
               if not (value or "").strip()]
    if not missing:
        return CheckResult(criterion_id=c.id, passed=True)
    return CheckResult(
        criterion_id=c.id, passed=False,
        violations=[Violation(
            criterion_id=c.id, dimension=c.dimension,
            severity=c.severity_if_violated, method=c.method,
            evidence=f"missing: {', '.join(missing)}",
            rule=c.rule,
            recommendation=("The copy layer is the only place words are guaranteed to be "
                            "spelled correctly; an empty field means the finished ad "
                            "carries no message."),
        )])


def _check_proper_noun_leak(c: Criterion, data: EvaluationInput) -> CheckResult:
    prompt = data.optimized_prompt or ""
    if not prompt.strip():
        return CheckResult(
            criterion_id=c.id, passed=None,
            unknown_reason="No optimized_prompt was supplied, so prompt leakage could not "
                           "be checked.")
    violations = []
    for term in c.params.get("terms") or []:
        if len(term.strip()) < 3 or not _contains_word(prompt, term):
            continue
        violations.append(Violation(
            criterion_id=c.id, dimension=c.dimension,
            severity=c.severity_if_violated, method=c.method,
            evidence=term.strip(),
            rule=c.rule,
            recommendation=(
                f"\"{term.strip()}\" reached the image model. Describe the object's visible "
                f"form instead of naming it; the name belongs in the copy layer, which is "
                f"rendered as real text afterwards."),
        ))
    return CheckResult(criterion_id=c.id, passed=not violations, violations=violations)


def _check_absolute_claims(c: Criterion, data: EvaluationInput) -> CheckResult:
    """Superlatives the brand has not substantiated.

    A phrase the brand already stands behind in verified_claims is skipped: the rule is
    "unsubstantiated", not "never". Matching is case-insensitive substring rather than
    whole-word because several entries are multi-word or punctuated ("no. 1", "#1").
    """
    text = data.copy_text()
    phrases = c.params.get("phrases") or []
    licensed = " ".join(c.params.get("verified") or []).lower()
    violations = []
    for sentence in _sentences(text):
        if _negated(sentence):
            continue
        hit = next((p for p in phrases
                    if p in sentence.lower() and p not in licensed), None)
        if hit:
            violations.append(Violation(
                criterion_id=c.id, dimension=c.dimension,
                severity=c.severity_if_violated, method=c.method,
                evidence=sentence,
                rule=c.rule,
                recommendation=(
                    f"\"{hit}\" is a comparative claim that needs evidence. Say what the "
                    f"product does instead, or add the claim to verified_claims in Brand "
                    f"Knowledge if the brand can substantiate it."),
            ))
            break
    return CheckResult(criterion_id=c.id, passed=not violations, violations=violations)


_HANDLERS = {
    "claims.unsupported": _check_unsupported_claims,
    "policy.medical_claims": _check_medical_claims,
    "policy.absolute_claims": _check_absolute_claims,
    "voice.avoid_words": _check_avoid_words,
    "copy.required_fields": _check_required_fields,
    "prompt.proper_noun_leak": _check_proper_noun_leak,
}


def run_objective(criteria: list[Criterion], data: EvaluationInput) -> list[CheckResult]:
    """Every Tier 1 criterion that can be applied. Unevaluable ones are reported, not run."""
    results = []
    for c in criteria:
        handler = _HANDLERS.get(c.id)
        if handler is None:
            continue
        if not c.evaluable:
            results.append(CheckResult(criterion_id=c.id, passed=None,
                                       unknown_reason=c.unknown_reason))
            continue
        results.append(handler(c, data))
    return results
