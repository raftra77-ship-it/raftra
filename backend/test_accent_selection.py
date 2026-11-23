"""Choosing the call-to-action colour by meaning rather than by array position.

The overlay painted its CTA with `color_palette[0]`. On workspaces 4, 12 and 20 position 0
happens to hold the brand accent, so the output looked right - by luck of ordering, not by
any rule. A brand whose extractor listed a background first would have had its button
painted in the page background.

Roles cannot be trusted on their own either. Real data from workspace 4:

    Accent Color  #38bdf8  role="Key CTAs & highlights (painted)"  source=computed-cta
    Bg Primary    #ffffff  role="Key CTAs & highlights"            source=css-variable
    Text Primary  #212529  role="Key CTAs & highlights"            source=css-variable

Three tokens, one role, and two of them are a background and body text. A role-first rule
paints the button white. So the order is: explicit computation (`computed-cta`), then the
token NAME, then the role, then any saturated non-surface colour - with neutrals excluded
throughout by is_brand_colour(), which is why white and near-black can never win however
they are labelled.
"""
import pytest

from core.brand_kit import DEFAULT_ACCENT, select_accent

ACCENT = "#38bdf8"
BRAND_BLUE = "#006dff"
WHITE = "#ffffff"
NEAR_BLACK = "#212529"
GREY = "#adb5bd"


def test_the_production_shape_computed_cta_wins():
    """Workspace 4, exactly as stored - including the mislabelled background and text."""
    tokens = [
        {"name": "Accent Color", "hex": ACCENT, "role": "Key CTAs & highlights (painted)",
         "source": "computed-cta"},
        {"name": "Bg Primary", "hex": WHITE, "role": "Key CTAs & highlights",
         "source": "css-variable"},
        {"name": "Text Primary", "hex": NEAR_BLACK, "role": "Key CTAs & highlights",
         "source": "css-variable"},
    ]
    hex_, why = select_accent(tokens, [ACCENT, WHITE])
    assert hex_ == ACCENT
    assert "computed-cta" in why


def test_accent_first_in_the_array():
    tokens = [{"name": "Primary Accent", "hex": BRAND_BLUE, "role": "Key CTAs & highlights"},
              {"name": "Bg Primary", "hex": WHITE, "role": "Backgrounds & surfaces"}]
    assert select_accent(tokens, [BRAND_BLUE])[0] == BRAND_BLUE


def test_background_first_in_the_array_is_skipped():
    """The defect the old code had. A background in position 0 must not become the button."""
    tokens = [{"name": "Bg Primary", "hex": WHITE, "role": "Key CTAs & highlights"},
              {"name": "Navbar Bg", "hex": "#000000", "role": "Backgrounds & surfaces"},
              {"name": "Primary Accent", "hex": BRAND_BLUE, "role": "Accents"}]
    hex_, why = select_accent(tokens, [WHITE, "#000000", BRAND_BLUE])
    assert hex_ == BRAND_BLUE, "a background was chosen as the accent"
    assert WHITE not in hex_


def test_accent_appears_late_in_the_array():
    tokens = ([{"name": f"Bg {i}", "hex": GREY, "role": "Backgrounds & surfaces"}
               for i in range(6)]
              + [{"name": "Brand Accent", "hex": ACCENT, "role": "Accents"}])
    assert select_accent(tokens, [GREY])[0] == ACCENT


def test_multiple_accent_like_tokens_resolve_deterministically():
    """Several candidates must always yield the same answer, and it must be the first."""
    tokens = [{"name": "Primary Accent", "hex": BRAND_BLUE, "role": "Accents"},
              {"name": "Secondary Accent", "hex": "#e80071", "role": "Accents"},
              {"name": "Brand Highlight", "hex": "#00ff00", "role": "Accents"}]
    first = select_accent(tokens, [])
    assert first[0] == BRAND_BLUE
    for _ in range(5):
        assert select_accent(tokens, []) == first


def test_computed_cta_outranks_an_earlier_named_accent():
    """Provenance beats naming: computed-cta was derived from the site's real buttons."""
    tokens = [{"name": "Primary Accent", "hex": BRAND_BLUE, "role": "Accents"},
              {"name": "Whatever", "hex": ACCENT, "source": "computed-cta"}]
    assert select_accent(tokens, [])[0] == ACCENT


def test_empty_palette_and_no_tokens():
    hex_, why = select_accent([], [])
    assert hex_ == DEFAULT_ACCENT
    assert why == "no colour data"


def test_tokens_with_missing_roles_still_resolve_by_name():
    tokens = [{"name": "Bg Primary", "hex": WHITE},
              {"name": "Brand Accent", "hex": ACCENT}]
    assert select_accent(tokens, [])[0] == ACCENT


def test_tokens_with_conflicting_roles_prefer_the_name():
    """Name beats role, because the extractor's role labels are demonstrably noisy."""
    tokens = [{"name": "Bg Primary", "hex": "#e80071", "role": "Key CTAs & highlights"},
              {"name": "Primary Accent", "hex": BRAND_BLUE, "role": "Backgrounds & surfaces"}]
    assert select_accent(tokens, [])[0] == BRAND_BLUE


def test_only_neutral_tokens_falls_through_to_the_palette():
    """No saturated colour anywhere: the legacy behaviour is preserved, and the reason
    records that it was a fallback rather than a choice."""
    tokens = [{"name": "Bg", "hex": WHITE}, {"name": "Text", "hex": NEAR_BLACK}]
    hex_, why = select_accent(tokens, [WHITE, NEAR_BLACK])
    assert hex_ == WHITE
    assert "no saturated colour" in why


def test_a_saturated_palette_entry_beats_an_unsaturated_first_one():
    hex_, why = select_accent([], [WHITE, GREY, ACCENT])
    assert hex_ == ACCENT
    assert "saturated palette" in why


@pytest.mark.parametrize("junk", [None, [], [None], ["notahex"], [{"no": "hex"}]])
def test_malformed_input_never_raises(junk):
    hex_, why = select_accent(junk, junk)
    assert hex_.startswith("#") and why


@pytest.mark.parametrize("neutral", [WHITE, "#000000", GREY, "#f8f9fa", NEAR_BLACK])
def test_a_neutral_can_never_be_chosen_as_an_accent_from_tokens(neutral):
    """However it is named or labelled. A white or black CTA pill is indistinguishable
    from a rendering fault."""
    tokens = [{"name": "Primary Accent", "hex": neutral, "role": "Key CTAs & highlights",
               "source": "computed-cta"},
              {"name": "Other", "hex": ACCENT, "role": "Accents"}]
    assert select_accent(tokens, [])[0] == ACCENT


def test_the_reason_is_always_populated():
    for tokens, palette in ([], []), ([{"name": "A", "hex": ACCENT}], []), ([], [ACCENT]):
        assert select_accent(tokens, palette)[1]
