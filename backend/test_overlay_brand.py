"""The brand name must survive the trip from Postgres to the rendered pixels.

The bug these tests pin down was a single key name. `core.rag.brand_facts()` emits the
brand under `"name"`; `overlay.build_overlay_spec()` read `facts.get("brand_name")`, a key
that dict has never contained. So the overlay's brand field was always empty, the brand
line was silently dropped at render time, and every generated creative shipped unbranded -
on a pipeline whose entire reason for existing is to put the brand's words on the image in
real type.

Nothing raised. `brand_facts` returned a perfectly good dict, the overlay returned a
perfectly good spec, and the renderer just had nothing to draw. That is why the first test
here asserts on the CONTRACT between the two functions rather than on either one alone:
either side can be refactored, but they must keep agreeing about the key.
"""
import pytest

from core.creative.overlay import build_overlay_spec, has_copy


class _Spec:
    """Minimal stand-in. CreativeSpec is a pydantic model with 42 fields; the overlay only
    reads these, via getattr, so a plain object exercises the same code path."""

    def __init__(self, brand="", headline="", primary_text="", cta=""):
        self.brand = brand
        self.headline = headline
        self.primary_text = primary_text
        self.cta = cta


def test_the_regression_brand_facts_name_reaches_the_overlay():
    """The exact failure: facts carry the brand under "name" and nothing else."""
    facts = {"name": "DSA", "url": "https://dsahelper.onrender.com", "color_palette": ["#38bdf8"]}
    ov = build_overlay_spec(_Spec(headline="Ace your next coding interview", cta="Start Now"), facts)
    assert ov["brand"] == "DSA"


def test_the_contract_between_brand_facts_and_the_overlay():
    """Guards the key itself. If brand_facts stops emitting "name", or the overlay starts
    reading something else, this fails - which is the thing that silently broke before."""
    from core.rag import brand_facts
    import inspect

    src = inspect.getsource(brand_facts)
    assert '"name":' in src, "brand_facts no longer emits 'name'"

    ov = build_overlay_spec(_Spec(headline="H"), {"name": "Acme"})
    assert ov["brand"] == "Acme"


def test_spec_brand_wins_over_stored_facts():
    """What the analyser read from the user's own words outranks the stored brand: the user
    may be writing for a sub-brand or a campaign name."""
    ov = build_overlay_spec(_Spec(brand="Nike Running", headline="H"), {"name": "Nike"})
    assert ov["brand"] == "Nike Running"


def test_no_brand_anywhere_is_empty_not_invented():
    """An absent brand must stay absent. Inventing one puts a wrong name on a published ad,
    which is worse than an unbranded one."""
    ov = build_overlay_spec(_Spec(headline="H"), {})
    assert ov["brand"] == ""


def test_whitespace_only_brand_is_treated_as_absent():
    ov = build_overlay_spec(_Spec(headline="H"), {"name": "   "})
    assert ov["brand"] == ""


def test_brand_alone_is_not_enough_copy_to_render():
    """has_copy gates the whole overlay. A brand with no headline and no CTA is not an ad,
    and rendering a bare wordmark over a photograph is worse than leaving the image clean."""
    assert has_copy(build_overlay_spec(_Spec(headline="H"), {"name": "Acme"})) is True
    assert has_copy(build_overlay_spec(_Spec(), {"name": "Acme"})) is False


@pytest.mark.parametrize("facts", [
    {"name": "Acme"},
    {"name": "Acme", "color_palette": []},
    {"name": "Acme", "color_palette": ["#10b981", "#111827"]},
])
def test_brand_survives_whatever_palette_accompanies_it(facts):
    """The palette and the brand are read from the same dict; a missing or empty palette
    must not take the brand down with it."""
    ov = build_overlay_spec(_Spec(headline="H"), facts)
    assert ov["brand"] == "Acme"
    assert ov["accent"].startswith("#")
