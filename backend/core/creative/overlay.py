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


def _font_path(bold: bool = False) -> str:
    override = (os.getenv("CREATIVE_FONT_PATH") or "").strip()
    if override and Path(override).is_file():
        return override

    if _VENDORED_DIR.is_dir():
        files = sorted(_VENDORED_DIR.glob("*.ttf")) + sorted(_VENDORED_DIR.glob("*.otf"))
        if files:
            # Prefer a bold face for headlines when the folder offers one.
            if bold:
                for f in files:
                    if "bold" in f.name.lower():
                        return str(f)
            return str(files[0])

    for candidate in _SYSTEM_FONTS:
        if Path(candidate).is_file():
            if bold and "bold" not in candidate.lower() and "b.ttf" not in candidate.lower():
                continue
            return candidate
    # Second pass without the bold preference, so a host with only a regular face still works.
    for candidate in _SYSTEM_FONTS:
        if Path(candidate).is_file():
            return candidate

    raise OverlayUnavailable(
        "No scalable font found. Set CREATIVE_FONT_PATH to a .ttf, or drop one into "
        "backend/assets/fonts/. Pillow's built-in font is a bitmap and is unreadable at "
        "advertising sizes, so the overlay is skipped rather than drawn badly.")


def build_overlay_spec(spec, facts: Optional[dict] = None,
                       layout: str = DEFAULT_LAYOUT) -> dict:
    """The words and colours to draw, taken from the spec the analyser already produced.

    No new model call: `headline`, `primary_text` and `cta` are fields the analyser fills on
    every run, and until now they were only ever shown in the UI's interpretation panel.
    They are the ad's actual copy, spelled correctly, and this is what puts them on the
    picture.
    """
    facts = facts or {}
    palette = [c for c in (facts.get("color_palette") or []) if isinstance(c, str)]
    return {
        "layout": layout if layout in LAYOUTS else DEFAULT_LAYOUT,
        "brand": (getattr(spec, "brand", "") or facts.get("brand_name") or "").strip(),
        "headline": (getattr(spec, "headline", "") or "").strip(),
        "subtext": (getattr(spec, "primary_text", "") or "").strip(),
        "cta": (getattr(spec, "cta", "") or "").strip(),
        "accent": palette[0] if palette else "#FFFFFF",
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
         max_lines: int, floor: int):
    """Largest size at which `text` wraps into at most `max_lines`.

    A fixed headline size only suits a headline of the expected length. "Crack coding
    interviews, one problem at a time." at a size chosen for four words wrapped to six
    lines and swamped the creative. Shrinking to fit keeps long and short headlines looking
    like the same template.
    """
    from PIL import ImageFont

    size = start
    while size > floor:
        font = ImageFont.truetype(font_path, size)
        if len(_wrap(draw, text, font, max_width)) <= max_lines:
            return font
        size = int(size * 0.92)
    return ImageFont.truetype(font_path, floor)


def render_overlay(image_bytes: bytes, overlay: dict) -> bytes:
    """Draw the overlay onto the image and return PNG bytes.

    Raises OverlayUnavailable when no font is present; the caller keeps the plain image
    rather than shipping one with unreadable bitmap text on it.
    """
    from PIL import Image, ImageDraw, ImageFont

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    W, H = img.size
    box = LAYOUTS.get(overlay.get("layout"), LAYOUTS[DEFAULT_LAYOUT])
    x = int(W * box["x"])
    y = int(H * box["y"])
    max_w = int(W * box["w"])

    regular, bold = _font_path(False), _font_path(True)
    draw = ImageDraw.Draw(img)

    # Sized from the image height so a 1080px square and a 1920px landscape look alike.
    head_size = max(28, int(H * 0.058))
    body_size = max(16, int(H * 0.026))
    cta_size = max(16, int(H * 0.028))

    f_body = ImageFont.truetype(regular, body_size)
    f_cta = ImageFont.truetype(bold, cta_size)
    f_brand = ImageFont.truetype(bold, max(14, int(H * 0.022)))
    # Shrunk to fit rather than fixed, so a long headline does not wrap into a wall.
    f_head = _fit(draw, overlay.get("headline") or "", bold, max_w,
                  head_size, max_lines=3, floor=max(20, int(H * 0.030)))

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
        f_body = _fit(draw, overlay["subtext"], regular, max_w,
                      body_size, max_lines=4, floor=max(12, int(H * 0.018)))
        for line in _wrap(draw, overlay["subtext"], f_body, max_w):
            draw.text((x, cursor), line, font=f_body, fill=(226, 232, 240))
            cursor += int(f_body.size * 1.45)
        cursor += int(f_body.size * 0.8)

    if overlay.get("cta"):
        label = overlay["cta"].strip()
        pad_x, pad_y = int(cta_size * 0.9), int(cta_size * 0.55)
        tw = int(draw.textlength(label, font=f_cta))
        draw.rounded_rectangle(
            [x, cursor, x + tw + pad_x * 2, cursor + cta_size + pad_y * 2],
            radius=int(cta_size * 0.45), fill=accent)
        # Dark text on a light accent, light on a dark one.
        luminance = 0.299 * accent[0] + 0.587 * accent[1] + 0.114 * accent[2]
        draw.text((x + pad_x, cursor + pad_y), label, font=f_cta,
                  fill=(15, 23, 42) if luminance > 140 else (255, 255, 255))

    out = io.BytesIO()
    img.save(out, format="PNG", optimize=True)
    return out.getvalue()
