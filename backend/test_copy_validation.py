"""An advertisement must carry copy, and a wordless one must say so.

The failure these tests pin down was silent. 31 production creatives were rendered, marked
`completed` and handed to a user with no headline, no body text and no call to action. The
database could not tell them apart from a clean background plate somebody actually wanted.

Causes, measured across 139 stored specifications:
  * 50 came from the analyser's FALLBACK path - all 50 had no copy. That path is now rare
    (66% of generations in August, 0% in November) and nothing here touches it.
  * 32 had copy missing although the analyser SUCCEEDED. 17 of those were sent one of our
    own placeholder strings as the prompt, so the model was asked to write advertising copy
    about a label containing no subject, product or offer.
"""
import pytest

from core.creative.spec import CreativeSpec
from core.creative.validation import (NO_COPY_OPTION, PLACEHOLDER_PROMPTS, describe_missing,
                                      is_placeholder_prompt, missing_ad_copy, wants_no_copy)

GOOD_BRIEF = "Instagram post promoting our DSA interview prep course for final-year students"


# ------------------------------------------------------- placeholder prompts

@pytest.mark.parametrize("prompt", [
    "Brand Knowledge Generation",
    "brand knowledge generation",
    "  Brand   Knowledge   Generation  ",
    "Generate fresh ad variants.",
    "Generate fresh ad variants",
    "GENERATE FRESH AD VARIANTS.",
])
def test_our_own_placeholders_are_rejected(prompt):
    """The exact strings found on 17 production creatives, plus the casing and spacing
    variants a client might send."""
    assert is_placeholder_prompt(prompt) is True


@pytest.mark.parametrize("prompt", [
    GOOD_BRIEF,
    "Brand knowledge generation for our winter range",
    "Generate fresh ad variants for the Diwali sale",
    "Joy.",
    "make an instagram story ad for my coffee brand",
    "Sleek product floating over a dark obsidian desk lit with neon rim light",
    # Narrowed deliberately: an earlier draft also refused these on speculation. They are
    # plausible things a person types while experimenting, and refusing a real brief is a
    # worse failure than accepting a weak one.
    "test",
    "generate",
    "untitled",
    "generate ad",
])
def test_real_briefs_are_not_rejected(prompt):
    """Matching is exact, not substring. A brief that happens to contain these words - or a
    very short one a person genuinely typed, like "Joy." - must still generate. Rejecting a
    real brief is worse than accepting a weak one."""
    assert is_placeholder_prompt(prompt) is False


def test_the_placeholder_list_is_matched_whole_not_as_a_substring():
    for placeholder in PLACEHOLDER_PROMPTS:
        assert is_placeholder_prompt(placeholder) is True
        assert is_placeholder_prompt(f"{placeholder} for our spring campaign") is False


# ------------------------------------------------------- missing copy detection

def test_missing_headline_and_cta_are_detected():
    assert missing_ad_copy(CreativeSpec(media_type="image")) == ["headline", "cta"]


def test_a_headline_without_a_cta_is_still_incomplete():
    spec = CreativeSpec(media_type="image", headline="Ace your next coding interview")
    assert missing_ad_copy(spec) == ["cta"]


def test_a_complete_image_ad_passes():
    spec = CreativeSpec(media_type="image", headline="Ace your next coding interview",
                        cta="Start Practicing Now")
    assert missing_ad_copy(spec) == []


def test_body_copy_is_not_required():
    """Plenty of good ads are a headline and a button. Requiring primary_text would fail
    them, so it is deliberately not in REQUIRED_IMAGE_COPY."""
    spec = CreativeSpec(media_type="image", headline="H", cta="Go", primary_text="")
    assert missing_ad_copy(spec) == []


def test_whitespace_is_not_copy():
    spec = CreativeSpec(media_type="image", headline="   ", cta="\n")
    assert missing_ad_copy(spec) == ["headline", "cta"]


# ------------------------------------------------------- video unchanged

@pytest.mark.parametrize("spec", [
    CreativeSpec(media_type="video"),
    CreativeSpec(media_type="video", headline="", cta=""),
])
def test_video_behaviour_is_unchanged(spec):
    """Zero of the 32 observed cases were video; video copy belongs to captions and
    voiceover, neither of which this pipeline produces. Applying the image rule here would
    invent a constraint with no evidence behind it and fail working generations."""
    assert missing_ad_copy(spec) == []


# ------------------------------------------------------- explicit no_copy

def test_no_copy_allows_a_clean_image():
    spec = CreativeSpec(media_type="image", no_copy=True)
    assert missing_ad_copy(spec) == []


def test_no_copy_defaults_to_false():
    assert CreativeSpec(media_type="image").no_copy is False


@pytest.mark.parametrize("value,expected", [
    (True, True), ("true", True), ("True", True), ("1", True), ("yes", True), ("on", True),
    (False, False), ("false", False), ("0", False), ("", False), (None, False),
    ("maybe", False),
])
def test_no_copy_option_parsing(value, expected):
    assert wants_no_copy({NO_COPY_OPTION: value}) is expected


@pytest.mark.parametrize("options", [None, {}, {"style": "luxury"}, "not-a-dict", 42])
def test_absent_or_malformed_options_mean_copy_is_wanted(options):
    assert wants_no_copy(options) is False


def test_no_copy_survives_regeneration():
    """`variation()` deep-copies the spec and edits only style fields, so the flag carries
    over - but that is a property worth pinning, because a regeneration that lost it would
    start reporting an intentional background plate as a broken advertisement."""
    spec = CreativeSpec(media_type="image", no_copy=True, subject="a desk")
    for kind in ("minimal", "luxury", "energetic", "ugc", "different_background"):
        assert spec.variation(kind).no_copy is True


def test_no_copy_survives_serialisation():
    """It is persisted inside ad_assets.creative_spec, so it has to round-trip."""
    spec = CreativeSpec(media_type="image", no_copy=True)
    restored = CreativeSpec(**spec.model_dump())
    assert restored.no_copy is True
    assert "no_copy" in spec.model_dump()


def test_regeneration_preserves_the_original_copy():
    """A variation must not silently become an incomplete advertisement: it inherits the
    parent's headline and call to action rather than re-analysing the prompt."""
    parent = CreativeSpec(media_type="image", headline="Ace your next coding interview",
                          cta="Start Practicing Now", subject="a student at a desk")
    child = parent.variation("minimal")
    assert child.headline == parent.headline
    assert child.cta == parent.cta
    assert missing_ad_copy(child) == []


# ------------------------------------------------------- the message

def test_the_message_says_what_to_do():
    note = describe_missing(["headline", "cta"])
    assert "headline and cta" in note
    assert "no_copy" in note
    assert note.endswith(".")


def test_no_message_when_nothing_is_missing():
    assert describe_missing([]) == ""


# ------------------------------------- the status a creative is recorded with

from core.creative.validation import STATUS_INCOMPLETE, final_generation_status  # noqa: E402


def test_an_image_with_no_copy_is_not_recorded_as_completed():
    """The headline finding: 31 production creatives said `completed` while carrying no
    headline, no body and no call to action."""
    assert final_generation_status("completed", ["headline", "cta"]) == STATUS_INCOMPLETE


def test_a_complete_creative_stays_completed():
    assert final_generation_status("completed", []) == "completed"


@pytest.mark.parametrize("status", ["failed", "processing", "incomplete"])
def test_other_statuses_are_never_overwritten(status):
    """A failure must stay a failure - reporting it as merely 'incomplete' would imply an
    asset exists when none does."""
    assert final_generation_status(status, ["headline", "cta"]) == status


def test_the_image_is_never_discarded():
    """'incomplete' is deliberately not 'failed': the web client treats any non-processing,
    non-failed status carrying an asset as displayable, so the picture still reaches the
    user. This pins that choice."""
    assert final_generation_status("completed", ["headline"]) != "failed"


def test_no_copy_creatives_are_recorded_as_completed():
    """End to end through both rules: an explicit clean-image request yields no gaps, so the
    status is never downgraded."""
    spec = CreativeSpec(media_type="image", no_copy=True)
    assert final_generation_status("completed", missing_ad_copy(spec)) == "completed"


def test_video_creatives_are_recorded_as_completed():
    spec = CreativeSpec(media_type="video")
    assert final_generation_status("completed", missing_ad_copy(spec)) == "completed"
