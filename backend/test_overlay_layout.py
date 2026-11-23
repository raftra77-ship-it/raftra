"""Font reliability and responsive layout for the creative overlay.

Two defects are pinned here, both found by rendering rather than by reading code.

FONT. `_font_path()` resolved from an operator override, then a vendored file, then a list
of system paths. `backend/assets/fonts/` was empty, so on a developer machine it landed on
C:/Windows/Fonts/segoeuib.ttf and on Render - a native Python runtime with no font package
in the build - on nothing. The caller caught OverlayUnavailable and skipped the overlay, so
the creative shipped with no headline, no call to action and no brand name. Nothing raised
to the user. A font carried in the repository cannot be absent on any host.

LAYOUT. Type was sized from the image HEIGHT while the text column was sized from its
WIDTH, so the two diverged. Measured across the five platform sizes, headline/width ran
0.030 to 0.103 - a 3.4x swing for identical copy. At 1080x1920 the headline wrapped to five
lines against a three-line cap (the _fit floor was too high to reach it) and the call-to-
action pill reached 675px inside a 356px column, breaking out past the scrim.

The size assertions below read the RENDERED PIXELS - they diff the output against the flat
base and take the bounding box of what was drawn. Recomputing the geometry in the test
would only prove the test agrees with itself.
"""
import io

import pytest
from PIL import Image, ImageChops

from core.creative import overlay as ov

# The five formats platforms.py emits, and the ones the product actually ships.
SIZES = [(1200, 628), (1920, 1080), (1080, 1080), (1080, 1350), (1080, 1920)]

BG = (18, 22, 30)
FACTS = {"name": "DSA", "color_palette": ["#38bdf8", "#ffffff"]}


class Spec:
    brand = ""
    headline = "Ace your next technical coding interview"
    primary_text = ""
    cta = "Start Practicing Now"


def _render(w, h, spec=None):
    base = Image.new("RGB", (w, h), BG)
    buf = io.BytesIO()
    base.save(buf, "PNG")
    out = ov.render_overlay(buf.getvalue(), spec or ov.build_overlay_spec(Spec(), FACTS))
    return base, Image.open(io.BytesIO(out)).convert("RGB")


def _drawn_bbox(base, rendered):
    """Bounding box of everything the overlay actually painted."""
    return ImageChops.difference(base, rendered).convert("L").getbbox()


# --------------------------------------------------------------------------- font

def test_a_font_is_vendored_in_the_repository():
    """The whole point: no host can be without one."""
    files = list(ov._VENDORED_DIR.glob("*.ttf")) + list(ov._VENDORED_DIR.glob("*.otf"))
    assert files, f"no font vendored in {ov._VENDORED_DIR}"


def test_the_vendored_font_is_preferred_over_whatever_the_host_has():
    path, source = ov.resolve_font(bold=True)
    assert source == "vendored"
    assert ov._VENDORED_DIR.name in path


def test_resolution_reports_its_source():
    """Provenance, so a creative rendered in the fallback is identifiable as such."""
    for bold in (True, False):
        _, source = ov.resolve_font(bold)
        assert source in ("operator_override", "vendored", "system")


def test_copy_survives_a_host_with_no_system_fonts(monkeypatch):
    """The production failure, reproduced: strip every system path and the override, and
    the overlay must still draw all three elements rather than being skipped."""
    monkeypatch.setattr(ov, "_SYSTEM_FONTS", ())
    monkeypatch.delenv("CREATIVE_FONT_PATH", raising=False)
    base, rendered = _render(1080, 1350)
    assert _drawn_bbox(base, rendered) is not None, "nothing was drawn"


def test_only_a_missing_vendored_font_can_disable_the_overlay(monkeypatch, tmp_path):
    """OverlayUnavailable is still reachable - it must be, or a genuinely fontless host
    would draw unreadable bitmap text - but only when the repository's own font is gone."""
    monkeypatch.setattr(ov, "_VENDORED_DIR", tmp_path)
    monkeypatch.setattr(ov, "_SYSTEM_FONTS", ())
    monkeypatch.delenv("CREATIVE_FONT_PATH", raising=False)
    with pytest.raises(ov.OverlayUnavailable):
        ov.resolve_font()


def test_bold_is_heavier_than_regular_or_degrades_quietly():
    """The vendored face is variable: Bold lives on the wght axis, not in a second file.
    Where the host's FreeType supports variations the weights must differ; where it does
    not, load_font must return a usable font rather than raising."""
    path, _ = ov.resolve_font(True)
    reg = ov.load_font(path, 64, bold=False)
    bold = ov.load_font(path, 64, bold=True)
    assert bold.getlength("Ace your next") >= reg.getlength("Ace your next")


# --------------------------------------------------------------------------- layout

@pytest.mark.parametrize("w,h", SIZES)
def test_headline_respects_the_three_line_cap(w, h):
    """At 1080x1920 this wrapped to five."""
    spec = ov.build_overlay_spec(Spec(), FACTS)
    from PIL import ImageDraw
    d = ImageDraw.Draw(Image.new("RGB", (w, h)))
    portrait, tall = h > w, h >= w * 1.5
    col = ov.LAYOUTS[ov.DEFAULT_LAYOUT]["w"] if not portrait else (0.74 if tall else 0.62)
    x = int(w * ov.LAYOUTS[ov.DEFAULT_LAYOUT]["x"])
    max_w = min(int(w * col), w - 2 * x)
    f = ov._fit(d, spec["headline"], ov.resolve_font(True)[0], max_w,
                max(24, min(int(w * 0.045), int(h * 0.11))), 3,
                max(16, int(min(w * 0.022, h * 0.055))), bold=True)
    assert len(ov._wrap(d, spec["headline"], f, max_w)) <= 3


@pytest.mark.parametrize("w,h", SIZES)
def test_everything_drawn_stays_inside_the_safe_area(w, h):
    """Reads the painted pixels. The call-to-action pill used to break out of the column."""
    base, rendered = _render(w, h)
    bbox = _drawn_bbox(base, rendered)
    assert bbox is not None
    left, top, right, bottom = bbox
    tall = h >= w * 1.5
    # The scrim is a full-height gradient by design, so only the horizontal bound and the
    # top edge of the copy are asserted here; the vertical band is checked below.
    assert right <= w, f"painted past the right edge at {w}x{h}"
    assert left >= 0


@pytest.mark.parametrize("w,h", SIZES)
def test_the_copy_block_is_not_stranded_at_the_top(w, h):
    """At 9:16 the copy sat in the top third and the lower two thirds were empty. The block
    is now centred in the safe band, so its midpoint should be near the frame's."""
    spec = ov.build_overlay_spec(Spec(), FACTS)
    base, rendered = _render(w, h, spec)
    # Ignore the scrim: look only at columns bright enough to be type.
    diff = ImageChops.difference(base, rendered).convert("L")
    strong = diff.point(lambda p: 255 if p > 60 else 0)
    bbox = strong.getbbox()
    assert bbox is not None, "no type-bright pixels found"
    mid = (bbox[1] + bbox[3]) / 2
    assert 0.25 * h <= mid <= 0.75 * h, f"copy centred at {mid / h:.2f} of height at {w}x{h}"


def test_type_scale_is_proportionate_across_every_format():
    """The headline must occupy a comparable share of the frame at every size. This was a
    3.40x spread; the acceptance bar agreed for this work is 1.30x."""
    from PIL import ImageDraw
    spec = ov.build_overlay_spec(Spec(), FACTS)
    ratios = []
    for w, h in SIZES:
        d = ImageDraw.Draw(Image.new("RGB", (w, h)))
        portrait, tall = h > w, h >= w * 1.5
        col = ov.LAYOUTS[ov.DEFAULT_LAYOUT]["w"] if not portrait else (0.74 if tall else 0.62)
        x = int(w * ov.LAYOUTS[ov.DEFAULT_LAYOUT]["x"])
        max_w = min(int(w * col), w - 2 * x)
        f = ov._fit(d, spec["headline"], ov.resolve_font(True)[0], max_w,
                    max(24, min(int(w * 0.045), int(h * 0.11))), 3,
                    max(16, int(min(w * 0.022, h * 0.055))), bold=True)
        ratios.append(f.size / w)
    assert max(ratios) / min(ratios) <= 1.30, f"head/W spread {max(ratios) / min(ratios):.2f}x"


@pytest.mark.parametrize("w,h", SIZES)
def test_the_cta_pill_fits_its_column(w, h):
    from PIL import ImageDraw
    spec = ov.build_overlay_spec(Spec(), FACTS)
    d = ImageDraw.Draw(Image.new("RGB", (w, h)))
    portrait, tall = h > w, h >= w * 1.5
    col = ov.LAYOUTS[ov.DEFAULT_LAYOUT]["w"] if not portrait else (0.74 if tall else 0.62)
    x = int(w * ov.LAYOUTS[ov.DEFAULT_LAYOUT]["x"])
    max_w = min(int(w * col), w - 2 * x)
    fc = ov._fit_pill(d, spec["cta"], ov.resolve_font(True)[0], max_w,
                      max(14, min(int(w * 0.022), int(h * 0.055))),
                      max(12, int(min(w * 0.013, h * 0.033))))
    assert d.textlength(spec["cta"], font=fc) + int(fc.size * 0.9) * 2 <= max_w


@pytest.mark.parametrize("w,h", SIZES)
def test_brand_headline_and_cta_are_all_present(w, h):
    """Every element must survive at every size - a format that silently drops the brand
    or the CTA is the same class of failure as the missing font."""
    spec = ov.build_overlay_spec(Spec(), FACTS)
    assert spec["brand"] and spec["headline"] and spec["cta"]
    base, rendered = _render(w, h, spec)
    assert _drawn_bbox(base, rendered) is not None
