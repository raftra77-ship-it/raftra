"""Render the ad's words onto the generated image, as real text.

Why this exists
---------------
An image model cannot type. It paints letter-SHAPED pixels, so every word a prompt asks it
to show comes back misspelled - measured on this product, "DSA Mastery Hub" was rendered as
"Data Mastery Arts St Aseles" by FLUX.1 Schnell and "DSA Masteery Hub" by FLUX.2 Klein 4B.
No amount of prompt engineering fixes that; it is what the architecture does.

So the pipeline stopped asking. `core.creative.optimizer` now ends every prompt with an
explicit no-text instruction and leaves a named empty region, and the words are drawn here
afterwards with a real font, at the exact spelling the copy layer produced. The brand name,
headline, call to action and offer never reach the image model at all.

This also means the cheapest models are good enough. The premium charged by text-capable
models buys legible lettering, and legible lettering is no longer something we need to buy.

What it does NOT do
-------------------
No green-screen compositing of customer screenshots. That belongs in the same place and is
the obvious next step, but it needs a screenshot source and a perspective warp, and is not
attempted here.
"""
from __future__ import annotations

import io
import os
from pathlib import Path
from typing import Optional

# Where the empty region sits, mirroring the wording optimizer.build_image_prompt puts in
# the prompt. If one changes the other must: the text is drawn blind into the area the
# prompt asked the model to leave clear.
LAYOUTS = {
    "text-left": {"x": 0.06, "y": 0.18, "w": 0.33},
    "text-right": {"x": 0.61, "y": 0.18, "w": 0.33},
    "text-top-left": {"x": 0.06, "y": 0.08, "w": 0.45},
}
DEFAULT_LAYOUT = "text-left"

# Resolution order for a usable typeface.
#
# Pillow ships no scalable font - only a tiny bitmap default that is unreadable at ad sizes.
# A vendored file wins, then an operator override, then whatever the host happens to have.
# Most Linux images carry DejaVu or Liberation; slim Python images sometimes carry neither,
# which is why dropping a .ttf into backend/assets/fonts/ is supported and documented.
_VENDORED_DIR = Path(__file__).resolve().parents[2] / "assets" / "fonts"
_SYSTEM_FONTS = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
    "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
    "C:/Windows/Fonts/segoeuib.ttf",
    "C:/Windows/Fonts/segoeui.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
    "C:/Windows/Fonts/arial.ttf",
)


class OverlayUnavailable(RuntimeError):
    """No scalable font on this host, so drawing text would make the image worse."""


def resolve_font(bold: bool = False) -> tuple:
    """(path, source) for a usable typeface. `source` is recorded, never guessed.

    The order is deliberate: an operator override wins, then the font vendored into this
    repository, then whatever the host happens to carry.

    The vendored face is why this can no longer come up empty. Before it existed the chain
    ended at _SYSTEM_FONTS, which lists Linux and Windows paths; it resolved on a developer
    machine to C:/Windows/Fonts/segoeuib.ttf and on Render - a native Python runtime with
    no font package installed by the build - to nothing at all. The caller then skipped the
    overlay, so the creative shipped with no headline, no call to action and no brand name.
    A font the repository carries cannot be absent on any host.
    """
    override = (os.getenv("CREATIVE_FONT_PATH") or "").strip()
    if override and Path(override).is_file():
        return override, "operator_override"

    if _VENDORED_DIR.is_dir():
        files = sorted(_VENDORED_DIR.glob("*.ttf")) + sorted(_VENDORED_DIR.glob("*.otf"))
        if files:
            # A folder offering a named bold face is preferred for headlines; a single
            # variable file (what we vendor) is handled by the weight axis in load_font().
            if bold:
                for f in files:
                    if "bold" in f.name.lower():
                        return str(f), "vendored"
            return str(files[0]), "vendored"

    for candidate in _SYSTEM_FONTS:
        if Path(candidate).is_file():
            if bold and "bold" not in candidate.lower() and "b.ttf" not in candidate.lower():
                continue
            return candidate, "system"
    # Second pass without the bold preference, so a host with only a regular face still works.
    for candidate in _SYSTEM_FONTS:
        if Path(candidate).is_file():
            return candidate, "system"

    raise OverlayUnavailable(
        "No scalable font found, and the vendored fallback at backend/assets/fonts/ is "
        "missing. Restore it, or set CREATIVE_FONT_PATH to a .ttf. Pillow's built-in font "
        "is a bitmap and is unreadable at advertising sizes.")


def _font_path(bold: bool = False) -> str:
    """Path only. Kept so callers that do not care about provenance stay simple."""
    return resolve_font(bold)[0]


# Whether this host's FreeType can select a weight on a variable font. Probed once: the
# answer is a property of the build, not of the request, and the vendored Inter is a
# variable file whose Bold lives on the wght axis rather than in a separate file.
_VARIATIONS_OK = None


def load_font(path: str, size: int, bold: bool = False):
    """A sized font, with the bold axis applied when the host supports variations.

    Degrades to the regular weight rather than failing: a headline in regular weight is a
    cosmetic loss, and no headline at all is not.
    """
    global _VARIATIONS_OK
    from PIL import ImageFont

    font = ImageFont.truetype(path, size)
    if not bold:
        return font
    if _VARIATIONS_OK is False:
        return font
    try:
        font.set_variation_by_name("Bold")
        _VARIATIONS_OK = True
    except Exception as e:
        if _VARIATIONS_OK is None:
            # Once, loudly. A silent regular-weight headline looks like a design choice.
            print(f"[overlay] variable-font weights unavailable on this host "
                  f"({type(e).__name__}); headlines render at regular weight.")
        _VARIATIONS_OK = False
    return font


def build_overlay_spec(spec, facts: Optional[dict] = None,
                       layout: str = DEFAULT_LAYOUT) -> dict:
    """The words and colours to draw, taken from the spec the analyser already produced.

    No new model call: `headline`, `primary_text` and `cta` are fields the analyser fills on
    every run, and until now they were only ever shown in the UI's interpretation panel.
    They are the ad's actual copy, spelled correctly, and this is what puts them on the
    picture.
    """
    facts = facts or {}
    # Accent by MEANING, not by position. palette[0] is whichever colour the extractor
    # happened to list first; on a brand whose first colour is a background that painted
    # the call to action in the page background. select_accent reads the roles, names and
    # provenance the extractor already records, and says which one it used.
    from core.brand_kit import select_accent
    palette = [c for c in (facts.get("color_palette") or []) if isinstance(c, str)]
    accent_hex, accent_reason = select_accent(facts.get("color_tokens"), palette)
    return {
        "layout": layout if layout in LAYOUTS else DEFAULT_LAYOUT,
        # core.rag.brand_facts() emits this under "name" - it has never had a
        # "brand_name" key, so this read was always empty and the brand line was silently
        # dropped from every overlay. Measured on workspace 4: facts["name"] == "DSA" while
        # facts.get("brand_name") is None, so every generated creative shipped unbranded.
        # spec.brand still wins when the analyser filled it from what the user actually
        # said; this is the fallback to the stored brand, which is the only other place a
        # brand name may legitimately come from. "name" is the contract - see
        # rag.format_brand_kit and evaluate/criteria.py, which both read it.
        "brand": (getattr(spec, "brand", "") or facts.get("name") or "").strip(),
        "headline": (getattr(spec, "headline", "") or "").strip(),
        "subtext": (getattr(spec, "primary_text", "") or "").strip(),
        "cta": (getattr(spec, "cta", "") or "").strip(),
        "accent": accent_hex,
        # Recorded so a questionable button colour is traceable to the token behind it.
        "accent_source": accent_reason,
    }


def has_copy(overlay: dict) -> bool:
    return bool((overlay.get("headline") or overlay.get("cta") or "").strip())


def _hex_to_rgb(value: str, fallback=(255, 255, 255)):
    text = (value or "").strip().lstrip("#")
    if len(text) == 3:
        text = "".join(c * 2 for c in text)
    if len(text) != 6:
        return fallback
    try:
        return tuple(int(text[i:i + 2], 16) for i in (0, 2, 4))
    except ValueError:
        return fallback


def _wrap(draw, text: str, font, max_width: int) -> list:
    words, lines, current = text.split(), [], ""
    for word in words:
        trial = f"{current} {word}".strip()
        if draw.textlength(trial, font=font) <= max_width or not current:
            current = trial
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def _fit(draw, text: str, font_path: str, max_width: int, start: int,
         max_lines: int, floor: int, bold: bool = False):
    """Largest size at which `text` wraps into at most `max_lines`.

    A fixed headline size only suits a headline of the expected length. "Crack coding
    interviews, one problem at a time." at a size chosen for four words wrapped to six
    lines and swamped the creative. Shrinking to fit keeps long and short headlines looking
    like the same template.
    """
    from PIL import ImageFont

    size = start
    while size > floor:
        font = load_font(font_path, size, bold=bold)
        if len(_wrap(draw, text, font, max_width)) <= max_lines:
            return font
        size = int(size * 0.92)
    return load_font(font_path, floor, bold=bold)


def _fit_pill(draw, label: str, font_path: str, max_width: int, start: int, floor: int):
    """Largest size at which the CTA *and its padding* fit the text column.

    _fit measures wrapped text; a CTA is a pill, so its width is the label plus two pads
    and it cannot wrap. Measured at 1080x1920 the pill reached 675px inside a 356px
    column - it broke out of the copy block and past the scrim entirely.
    """
    size = start
    while size > floor:
        font = load_font(font_path, size, bold=True)
        if draw.textlength(label, font=font) + int(size * 0.9) * 2 <= max_width:
            return font
        size = int(size * 0.92)
    return load_font(font_path, floor, bold=True)


def render_overlay(image_bytes: bytes, overlay: dict) -> bytes:
    """Draw the overlay onto the image and return PNG bytes.

    Raises OverlayUnavailable when no font is present; the caller keeps the plain image
    rather than shipping one with unreadable bitmap text on it.
    """
    from PIL import Image, ImageDraw, ImageFont

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    W, H = img.size
    box = LAYOUTS.get(overlay.get("layout"), LAYOUTS[DEFAULT_LAYOUT])

    # Scale from the SHORT edge, not the height.
    #
    # Sizing from H while the column is sized from W made the two diverge: measured across
    # the five platform sizes, headline/width ran from 0.030 at 1200x628 to 0.103 at
    # 1080x1920 - a 3.4x swing for identical copy. The short edge is the dimension that
    # actually governs how large type reads in a frame, so the same spec now renders at
    # comparable weight everywhere.
    S = min(W, H)
    portrait = H > W
    tall = H >= W * 1.5                      # stories and reels

    # A 33% column is right for landscape and far too narrow for a story, where it forced
    # the headline to five lines against a three-line cap.
    col_frac = box["w"] if not portrait else (0.74 if tall else 0.62)
    x = int(W * box["x"])
    max_w = min(int(W * col_frac), W - 2 * x)

    # Platform safe areas: stories put UI chrome over the top and bottom of the frame.
    safe_top = int(H * (0.12 if tall else 0.07))
    safe_bot = int(H * (0.16 if tall else 0.07))
    y = max(int(H * box["y"]), safe_top)

    regular, reg_src = resolve_font(False)
    bold, bold_src = resolve_font(True)
    # Provenance, so a creative rendered in the fallback is identifiable as such rather
    # than being mistaken for the brand's own typeface.
    print(f"[overlay] font regular={Path(regular).name} ({reg_src}) "
          f"bold={Path(bold).name} ({bold_src}) "
          f"accent={overlay.get('accent')} ({overlay.get('accent_source')})")
    draw = ImageDraw.Draw(img)

    # Scale from WIDTH, capped by height.
    #
    # min(W,H) was the first attempt and still left a 1.93x spread in headline/width,
    # because a landscape frame takes its short edge from the height and so got small type
    # relative to the frame. How large a headline *reads* tracks the frame's width, so that
    # is the reference; the height cap keeps a short wide banner (a 970x250 leaderboard)
    # from being given type taller than its own frame.
    head_size = max(24, min(int(W * 0.045), int(H * 0.11)))
    body_size = max(14, min(int(W * 0.020), int(H * 0.050)))
    cta_size = max(14, min(int(W * 0.022), int(H * 0.055)))
    brand_size = max(12, min(int(W * 0.018), int(H * 0.044)))

    f_brand = load_font(bold, brand_size, bold=True)
    # The floor is low enough that the three-line cap is reachable. It used to be
    # max(20, H*0.030) = 57px at 1080x1920, which the headline could not fit into three
    # lines of a 356px column, so _fit returned the floor and the text wrapped to five.
    f_head = _fit(draw, overlay.get("headline") or "", bold, max_w,
                  head_size, max_lines=3, floor=max(16, int(min(W * 0.022, H * 0.055))), bold=True)
    f_cta = _fit_pill(draw, (overlay.get("cta") or "").strip(), bold, max_w,
                      cta_size, floor=max(12, int(min(W * 0.013, H * 0.033))))
    f_body = _fit(draw, overlay.get("subtext") or "", regular, max_w,
                  body_size, max_lines=4, floor=max(11, int(min(W * 0.013, H * 0.033))))

    # Measure the whole block before placing it, so it can be centred in the safe band
    # instead of being pinned near the top. At 9:16 the fixed y left the lower two thirds
    # of the frame empty while the copy crowded the top.
    def _block_height():
        h = 0
        if overlay.get("brand"):
            h += int(f_brand.size * 1.9)
        if overlay.get("headline"):
            lines = _wrap(draw, overlay["headline"], f_head, max_w)
            h += len(lines) * int(f_head.size * 1.18) + int(f_head.size * 0.35)
        if overlay.get("subtext"):
            lines = _wrap(draw, overlay["subtext"], f_body, max_w)
            h += len(lines) * int(f_body.size * 1.45) + int(f_body.size * 0.8)
        if overlay.get("cta"):
            h += f_cta.size + int(f_cta.size * 0.55) * 2
        return h

    block_h = _block_height()
    avail = H - safe_top - safe_bot
    y = safe_top + max(0, (avail - block_h) // 2)

    accent = _hex_to_rgb(overlay.get("accent"), (255, 255, 255))

    # A scrim so the copy is legible whatever shade the model left behind.
    #
    # A flat rectangle reads as a grey slab pasted over the photograph - it was the single
    # thing that made the first render look unprofessional. This fades to fully transparent
    # across its last 40%, so the type sits on a dark field that dissolves into the image
    # instead of ending at a hard vertical edge.
    band_x = max(0, x - int(W * 0.045))
    band_w = min(W - band_x, max_w + int(W * 0.12))
    if band_w > 0:
        gradient = Image.new("L", (band_w, 1))
        solid_to = int(band_w * 0.60)
        gradient.putdata([
            255 if i <= solid_to
            else max(0, int(255 * (1 - (i - solid_to) / max(1, band_w - solid_to))))
            for i in range(band_w)
        ])
        mask = gradient.resize((band_w, H))
        shade = Image.new("RGB", (band_w, H), (8, 11, 18))
        region = img.crop((band_x, 0, band_x + band_w, H))
        # 0.62 keeps the underlying photograph visible through the darkest part; a fully
        # opaque scrim would make the left third dead space rather than part of the image.
        blended = Image.blend(region, shade, 0.62)
        img.paste(Image.composite(blended, region, mask), (band_x, 0))
        draw = ImageDraw.Draw(img)

    cursor = y
    if overlay.get("brand"):
        draw.text((x, cursor), overlay["brand"].upper(), font=f_brand, fill=accent)
        cursor += int(f_brand.size * 1.9)

    if overlay.get("headline"):
        for line in _wrap(draw, overlay["headline"], f_head, max_w):
            draw.text((x, cursor), line, font=f_head, fill=(255, 255, 255))
            cursor += int(f_head.size * 1.18)
        cursor += int(f_head.size * 0.35)

    if overlay.get("subtext"):
        # Shrink to fit rather than cut. This took the first four wrapped lines and dropped
        # the rest, which severed a real sentence mid-clause - "...beginner-friendly DSA
        # lessons and guided" with "challenges." simply gone. A half-sentence on an advert
        # reads as a rendering fault, and the copy layer exists so the words are right.
        for line in _wrap(draw, overlay["subtext"], f_body, max_w):
            draw.text((x, cursor), line, font=f_body, fill=(226, 232, 240))
            cursor += int(f_body.size * 1.45)
        cursor += int(f_body.size * 0.8)

    if overlay.get("cta"):
        label = overlay["cta"].strip()
        pad_x, pad_y = int(f_cta.size * 0.9), int(f_cta.size * 0.55)
        tw = int(draw.textlength(label, font=f_cta))
        # Hard clamp as well as the fitted size: the pill must never leave the column.
        pill_right = min(x + tw + pad_x * 2, x + max_w)
        draw.rounded_rectangle(
            [x, cursor, pill_right, cursor + f_cta.size + pad_y * 2],
            radius=int(f_cta.size * 0.45), fill=accent)
        # Dark text on a light accent, light on a dark one.
        luminance = 0.299 * accent[0] + 0.587 * accent[1] + 0.114 * accent[2]
        draw.text((x + pad_x, cursor + pad_y), label, font=f_cta,
                  fill=(15, 23, 42) if luminance > 140 else (255, 255, 255))
        cursor += f_cta.size + pad_y * 2

    out = io.BytesIO()
    img.save(out, format="PNG", optimize=True)
    return out.getvalue()
