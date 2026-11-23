"""Tier 2: what can be measured off the rendered image without a model.

PIL only - no numpy, because requirements.txt lists neither and the overlay already proves
PIL is present everywhere this runs.

Scope is one check: does the creative actually use the brand's palette. That is measurable.
"Is the composition premium", "does this look like a discount flyer" are not, and they are
left to the model tier rather than approximated here with something that would look
objective and not be.

Why only CHROMATIC brand colours count
--------------------------------------
Most palettes contain a near-white and a near-black - the documented example on
BrandProfile is ["#FFFFFF", "#030303", "#5A52FF"]. Nearly every photograph contains both,
so matching on them would pass any image ever generated and the check would measure
nothing. Only colours with real chroma are required to appear; a brand whose palette is
entirely neutral is reported UNKNOWN, because for that brand this check genuinely cannot
distinguish on-brand from off-brand.

Limits worth knowing: this measures PRESENCE, not harmony or proportion. An image can carry
the brand blue in one corner and be hideous, and it passes. Compression and lighting move
colours around, which is why the tolerance is wide.
"""
from __future__ import annotations

import io
import math

from .models import CheckResult, Criterion, EvaluationInput, Violation

# CIE76 distance below which two colours read as the same brand colour. Wide on purpose:
# JPEG artifacts and scene lighting routinely move a hue 10-15 units on their own.
DELTA_E_TOLERANCE = 25.0

# Below this chroma a colour is a neutral and cannot discriminate between brands.
#
# Measured against real palettes rather than guessed. An earlier value of 20 excluded sage
# #7C9A80 (chroma 18.8) and beige #D9C9B0 (14.6) - which is to say it excluded the entire
# palette of a muted premium brand and reported UNKNOWN for exactly the kind of brand that
# cares most about colour. 12 keeps those and still drops the neutrals that would make the
# check meaningless: ivory #F6F1E7 is 5.4, white and near-black are 0.
#
# The cost of going this low is honest: a beige brand colour can be matched by skin tones
# or wood in an otherwise off-brand photograph. This check raises MEDIUM, never CRITICAL,
# partly for that reason.
MIN_CHROMA = 12.0

# A dominant colour must cover at least this share of the image to count as present.
MIN_SHARE = 0.03


def _hex_to_rgb(value: str):
    text = (value or "").strip().lstrip("#")
    if len(text) == 3:
        text = "".join(ch * 2 for ch in text)
    if len(text) != 6:
        return None
    try:
        return tuple(int(text[i:i + 2], 16) for i in (0, 2, 4))
    except ValueError:
        return None


def _rgb_to_lab(rgb):
    """sRGB (0-255) to CIELAB, D65. Standard conversion, written out to avoid a dependency."""
    def _linear(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (_linear(v) for v in rgb)
    x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
    y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000
    z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883

    def _f(t):
        return t ** (1 / 3) if t > 0.008856 else (7.787 * t) + (16 / 116)

    fx, fy, fz = _f(x), _f(y), _f(z)
    return (116 * fy) - 16, 500 * (fx - fy), 200 * (fy - fz)


def _delta_e(lab1, lab2) -> float:
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(lab1, lab2)))


def _chroma(lab) -> float:
    return math.sqrt(lab[1] ** 2 + lab[2] ** 2)


def dominant_colours(image_bytes: bytes, top: int = 8) -> list:
    """[(hex, share)] for the image's main colours, largest share first.

    Downsampled hard and quantised: the question is "which colours is this image made of",
    and a 160px thumbnail answers it as well as the full frame for a fraction of the work.
    """
    from PIL import Image

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img.thumbnail((160, 160))
    quantised = img.quantize(colors=16, method=Image.MEDIANCUT).convert("RGB")
    counts = quantised.getcolors(maxcolors=1 << 16) or []
    total = sum(n for n, _ in counts) or 1
    counts.sort(key=lambda pair: pair[0], reverse=True)
    return [("#%02X%02X%02X" % rgb, n / total) for n, rgb in counts[:top]]


def _check_palette(c: Criterion, data: EvaluationInput) -> CheckResult:
    if not data.image_bytes:
        return CheckResult(
            criterion_id=c.id, passed=None,
            unknown_reason="No image bytes were supplied, so the palette could not be "
                           "measured. Not evaluated is not the same as compliant.")

    hexes = [t.get("hex") for t in (c.params.get("tokens") or []) if isinstance(t, dict)]
    hexes += list(c.params.get("palette") or [])
    brand_labs = []
    for h in hexes:
        rgb = _hex_to_rgb(h)
        if rgb is None:
            continue
        lab = _rgb_to_lab(rgb)
        if _chroma(lab) >= MIN_CHROMA:
            brand_labs.append((h.upper(), lab))

    if not brand_labs:
        return CheckResult(
            criterion_id=c.id, passed=None,
            unknown_reason="The brand palette contains no chromatic colour (only neutrals), "
                           "so palette presence cannot distinguish on-brand from off-brand "
                           "for this brand.")

    try:
        dominant = dominant_colours(data.image_bytes)
    except Exception as e:
        return CheckResult(
            criterion_id=c.id, passed=None,
            unknown_reason=f"The image could not be decoded ({type(e).__name__}), so the "
                           f"palette was not measured.")

    present = [(h, share) for h, share in dominant if share >= MIN_SHARE]
    if not present:
        return CheckResult(
            criterion_id=c.id, passed=None,
            unknown_reason="No colour covered a measurable share of the image.")

    present_labs = [(h, _rgb_to_lab(_hex_to_rgb(h))) for h, _ in present]
    best = None
    for brand_hex, brand_lab in brand_labs:
        for img_hex, img_lab in present_labs:
            d = _delta_e(brand_lab, img_lab)
            if best is None or d < best[0]:
                best = (d, brand_hex, img_hex)

    if best and best[0] <= DELTA_E_TOLERANCE:
        return CheckResult(criterion_id=c.id, passed=True)

    found = ", ".join(h for h, _ in present[:5])
    nearest = f"{best[1]} vs {best[2]} (dE {best[0]:.0f})" if best else "n/a"
    return CheckResult(
        criterion_id=c.id, passed=False,
        violations=[Violation(
            criterion_id=c.id, dimension=c.dimension,
            severity=c.severity_if_violated, method=c.method,
            evidence=f"dominant colours: {found}; nearest brand colour {nearest}",
            rule=c.rule,
            recommendation=("No brand colour appears in the image's dominant palette. Set "
                            "color_direction from the brand's stated palette, or regenerate "
                            "with the brand colours named in the brief."),
        )])


_HANDLERS = {"visual.palette": _check_palette}


def run_pixels(criteria: list[Criterion], data: EvaluationInput) -> list[CheckResult]:
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
