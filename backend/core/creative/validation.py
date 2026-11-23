"""Is this actually an advertisement, or just a picture?

Why this exists
---------------
A creative with no headline, no primary text and no call to action is not an advertisement.
The pipeline produced them anyway, silently, and marked them `completed`. Measured on
production across 139 stored specifications:

  * 50 came from the analyser's fallback path, and ALL 50 had no copy - a 100% correlation.
    That path is now rare (66% of generations in August, 0% in November) because `analyze()`
    learned to retry and to walk its model chain. Nothing here changes that logic.
  * 32 more had copy missing although the analyser itself SUCCEEDED. Of those, 17 were sent
    one of our own placeholder strings as the prompt - "Generate fresh ad variants." or
    "Brand Knowledge Generation" - so the model was asked to write advertising copy about a
    label with no subject, product or offer in it. It had nothing to write about.
  * 31 of the 32 rendered and were handed to a user as a bare image.

Two rules follow, and they are deliberately different in kind:

`is_placeholder_prompt` rejects a request BEFORE any model is called, because a contentless
prompt is a defect in the caller, not something a model can recover from. It is a fixed
list, matched exactly, not a heuristic - guessing at "is this brief good enough" would
reject real briefs like "Joy." that a person genuinely typed.

`missing_ad_copy` reports what a finished specification lacks, so the renderer can refuse
to pass a bare image off as a finished advertisement. It describes; it never invents copy.

On `no_copy`
------------
Some requests legitimately want a clean image: a background plate, a product shot for a
designer to lay out themselves. Eight of the 32 look like exactly that ("Sleek Hssh product
floating over a dark obsidian desk lit with neon rim light"). They are indistinguishable in
the database from the broken ones, which is the real problem - so intent is recorded
EXPLICITLY by the caller and never inferred from the prompt text. A wrong guess ships an
advertisement with no words on it.
"""
from __future__ import annotations

# Our own strings, sent as the prompt by callers that had no brief to send.
#
# Only the two strings actually observed in production. An earlier draft also carried
# "generate", "test" and "untitled" on speculation; they were removed because they are
# plausible things a person types while experimenting, and refusing a real brief is a worse
# failure than accepting a weak one.
#
# Matched against normalise_prompt() - whitespace collapsed, trailing sentence punctuation
# dropped, casefolded - and compared WHOLE, never as a substring. "Brand Knowledge
# Generation" as the entire prompt is a bug; "Brand knowledge generation for our winter
# range" is a brief.
PLACEHOLDER_PROMPTS = frozenset({
    "brand knowledge generation",
    "generate fresh ad variants",
})

# The option a caller sets to ask for a picture rather than an advertisement.
NO_COPY_OPTION = "no_copy"

# What an image advertisement must carry. primary_text is NOT here: plenty of good ads are a
# headline and a button, and requiring body copy would fail them.
REQUIRED_IMAGE_COPY = ("headline", "cta")


def normalise_prompt(prompt) -> str:
    """Collapse whitespace, casefold, and drop trailing sentence punctuation.

    The production string is "Generate fresh ad variants." WITH a full stop, so matching
    the bare phrase alone would miss the exact value that caused the defect. Normalising
    here keeps the set to one entry per phrase instead of one per punctuation variant.
    """
    return " ".join(str(prompt or "").split()).strip().rstrip(".!").strip().casefold()


def is_placeholder_prompt(prompt) -> bool:
    """True when the prompt is one of our own placeholders rather than a brief."""
    return normalise_prompt(prompt) in PLACEHOLDER_PROMPTS


def wants_no_copy(options) -> bool:
    """Explicit caller opt-out. Anything other than a true-ish flag means copy is wanted."""
    if not isinstance(options, dict):
        return False
    value = options.get(NO_COPY_OPTION)
    if isinstance(value, str):
        return value.strip().lower() in ("1", "true", "yes", "on")
    return bool(value)


def missing_ad_copy(spec) -> list:
    """Which required copy fields this specification lacks.

    Video is exempt and returns []: zero of the 32 observed cases were video, video copy
    belongs to captions and voiceover, and neither exists yet. Inventing a constraint with
    no evidence behind it would fail working video generations.
    """
    if getattr(spec, "media_type", "image") == "video":
        return []
    if getattr(spec, "no_copy", False):
        return []
    return [f for f in REQUIRED_IMAGE_COPY
            if not str(getattr(spec, f, "") or "").strip()]


def describe_missing(missing: list) -> str:
    """A sentence for the API, the row and the log. Says what to do, not just what is wrong."""
    if not missing:
        return ""
    fields = " and ".join(missing)
    return (f"The generated creative has no {fields}, so it is a picture rather than an "
            f"advertisement. Regenerate with a brief that states what is being advertised, "
            f"or set no_copy if a clean image is what you wanted.")


# Terminal status for a creative whose copy is missing.
#
# Not "failed": the picture exists, it cost a provider call, and it may be exactly the
# background someone wanted - discarding it would be worse than mislabelling it. Not
# "completed" either, which is what 31 production creatives claimed while carrying no copy
# at all. The web client treats any non-processing, non-failed status with an asset as
# displayable, so an image still reaches the user; what changes is that the row says what it
# actually is and the job endpoint reports the reason.
STATUS_INCOMPLETE = "incomplete"


def final_generation_status(current_status: str, missing: list) -> str:
    """Downgrade a 'completed' creative that has no copy. Everything else passes through.

    Kept here rather than inlined in service.run so the rule can be asserted on directly.
    """
    if missing and current_status == "completed":
        return STATUS_INCOMPLETE
    return current_status
