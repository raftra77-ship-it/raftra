"""Text overlay specification and FFmpeg filter compilation.

Text is composited AFTER video generation, never asked of the video model. Diffusion
models render lettering unreliably — a headline that says "RUN FUTHRER" ruins an ad — so
the words are drawn deterministically by ffmpeg's drawtext filter instead.

Two rules that make one creative work across every placement:

  * Positions are RELATIVE (0..1), never pixels. x=0.5,y=0.8 is centred and 80% down
    whether the canvas is 576x1024 or 1024x576, so the same overlay set survives a
    9:16 -> 1:1 -> 16:9 change without repositioning.
  * Font size is expressed as a fraction of video HEIGHT, so text scales with the frame
    rather than becoming unreadable on a small render.

This module is pure: it builds filter strings and does no I/O. The renderer that shells
out to ffmpeg consumes build_filtergraph() and is deliberately separate, so the
compilation logic stays unit-testable without invoking a binary.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

# Fraction of the frame kept clear at each edge. Social platforms overlay their own UI
# (captions, profile row, action buttons) near the top and bottom of 9:16 placements, so
# text placed flush to an edge gets covered in the real feed.
SAFE_AREA = {
    "9:16": {"top": 0.14, "bottom": 0.18, "left": 0.06, "right": 0.06},
    "4:5":  {"top": 0.08, "bottom": 0.12, "left": 0.06, "right": 0.06},
    "1:1":  {"top": 0.08, "bottom": 0.10, "left": 0.06, "right": 0.06},
    "16:9": {"top": 0.08, "bottom": 0.10, "left": 0.05, "right": 0.05},
}
_DEFAULT_SAFE = SAFE_AREA["1:1"]

Anchor = Literal["top", "center", "bottom", "top_left", "top_right",
                 "bottom_left", "bottom_right"]

# Named anchors -> relative (x, y). Authors can still supply explicit coordinates.
_ANCHORS: dict[str, tuple[float, float]] = {
    "top": (0.5, 0.12), "center": (0.5, 0.5), "bottom": (0.5, 0.85),
    "top_left": (0.15, 0.12), "top_right": (0.85, 0.12),
    "bottom_left": (0.15, 0.85), "bottom_right": (0.85, 0.85),
}

Animation = Literal["none", "fade_in", "fade_out", "fade_up", "fade_down",
                    "slide_left", "slide_right", "scale_in", "pop", "typewriter"]


class TextOverlay(BaseModel):
    """One piece of text on the video."""

    text: str
    type: str = "headline"                 # headline | subheadline | cta | brand | discount
    # Relative position. None means "use the anchor".
    x: Optional[float] = None
    y: Optional[float] = None
    anchor: Anchor = "center"
    font_size: float = 0.075               # fraction of video HEIGHT, not pixels
    font_file: Optional[str] = None
    color: str = "#FFFFFF"
    box_color: Optional[str] = None        # background pill; None = transparent
    box_opacity: float = 0.55
    border_width: int = 0                  # outline, for legibility over busy footage
    border_color: str = "#000000"
    start_time: float = 0.0
    end_time: float = 5.0
    animation: Animation = "fade_in"
    anim_duration: float = 0.4

    def resolved_xy(self) -> tuple[float, float]:
        ax, ay = _ANCHORS.get(self.anchor, _ANCHORS["center"])
        return (self.x if self.x is not None else ax,
                self.y if self.y is not None else ay)


def clamp_to_safe_area(overlay: TextOverlay, aspect_ratio: str) -> tuple[float, float]:
    """Pull a position inside the platform's safe area.

    Returns the coordinates the overlay will actually be drawn at, so a caller can warn
    when a requested position had to move rather than silently relocating the text.
    """
    safe = SAFE_AREA.get(aspect_ratio, _DEFAULT_SAFE)
    x, y = overlay.resolved_xy()
    x = min(max(x, safe["left"]), 1.0 - safe["right"])
    y = min(max(y, safe["top"]), 1.0 - safe["bottom"])
    return x, y


def _hex_to_ffmpeg(color: str, opacity: float = 1.0) -> str:
    """#RRGGBB -> ffmpeg 0xRRGGBB@alpha."""
    c = (color or "#FFFFFF").lstrip("#")
    if len(c) == 3:
        c = "".join(ch * 2 for ch in c)
    return f"0x{c.upper()}@{max(0.0, min(opacity, 1.0)):.3f}"


def _escape(text: str) -> str:
    """drawtext has its own escaping rules; a raw apostrophe or colon breaks the graph."""
    out = (text or "").replace("\\", "\\\\").replace(":", r"\:").replace("'", r"\'")
    return out.replace("%", r"\%").replace(",", r"\,").replace("[", r"\[").replace("]", r"\]")


def _alpha_expr(o: TextOverlay) -> str:
    """Opacity over time. `t` is the timeline position in seconds."""
    s, e, d = o.start_time, o.end_time, max(o.anim_duration, 0.01)
    if o.animation in ("fade_in", "fade_up", "fade_down", "scale_in", "pop"):
        return f"if(lt(t,{s}),0,if(lt(t,{s + d}),(t-{s})/{d},1))"
    if o.animation == "fade_out":
        return f"if(gt(t,{e - d}),max(0,({e}-t)/{d}),1)"
    return "1"


def _position_exprs(o: TextOverlay, x: float, y: float) -> tuple[str, str]:
    """x/y expressions. `w`/`h` are frame dims, `tw`/`th` the rendered text box, so the
    text is centred on its point rather than hung from its top-left corner."""
    px, py = f"(w*{x:.4f}-tw/2)", f"(h*{y:.4f}-th/2)"
    s, d = o.start_time, max(o.anim_duration, 0.01)
    travel = 0.06     # fraction of the frame an entrance animation moves through

    if o.animation == "fade_up":
        py = f"({py}+h*{travel}*max(0,1-(t-{s})/{d}))"
    elif o.animation == "fade_down":
        py = f"({py}-h*{travel}*max(0,1-(t-{s})/{d}))"
    elif o.animation == "slide_left":
        px = f"({px}+w*{travel * 2}*max(0,1-(t-{s})/{d}))"
    elif o.animation == "slide_right":
        px = f"({px}-w*{travel * 2}*max(0,1-(t-{s})/{d}))"
    return px, py


def build_drawtext(o: TextOverlay, aspect_ratio: str, default_font: Optional[str] = None) -> str:
    """One drawtext filter for one overlay."""
    x, y = clamp_to_safe_area(o, aspect_ratio)
    px, py = _position_exprs(o, x, y)

    parts = [
        f"text='{_escape(o.text)}'",
        # Height-relative sizing keeps text proportional across every placement.
        f"fontsize=h*{max(o.font_size, 0.01):.4f}",
        f"fontcolor={_hex_to_ffmpeg(o.color)}",
        f"x={px}", f"y={py}",
        # enable gates visibility; alpha handles the fade within that window.
        f"enable='between(t,{o.start_time},{o.end_time})'",
        f"alpha='{_alpha_expr(o)}'",
    ]
    font = o.font_file or default_font
    if font:
        parts.append(f"fontfile='{font}'")
    if o.box_color:
        parts += [f"box=1", f"boxcolor={_hex_to_ffmpeg(o.box_color, o.box_opacity)}",
                  "boxborderw=20"]
    if o.border_width > 0:
        parts += [f"borderw={o.border_width}",
                  f"bordercolor={_hex_to_ffmpeg(o.border_color)}"]
    return "drawtext=" + ":".join(parts)


def build_filtergraph(overlays: list[TextOverlay], aspect_ratio: str,
                      default_font: Optional[str] = None) -> str:
    """Chain every overlay into one -vf argument, so ffmpeg runs a single pass."""
    valid = [o for o in overlays if (o.text or "").strip()]
    return ",".join(build_drawtext(o, aspect_ratio, default_font) for o in valid)
