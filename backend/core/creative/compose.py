"""Composite a real screenshot onto a generated device screen.

Why a green screen
------------------
An image model asked to draw a product UI invents one, and every label on it is misspelled -
"Data Strasces and Algorithms" where the brief said "Data Structures and Algorithms". The UI
is also the part a prospect actually reads, so a garbled one is worse than none.

So the prompt stops asking for a UI at all and asks for a flat pure-green screen instead
(see `GREEN_SCREEN_CLAUSE`). A plain colour field is something diffusion models render
reliably. The customer's real screenshot is then warped into that region here, in our own
code, at the exact pixels they gave us.

The four steps, in order
------------------------
1. `green_mask`   - which pixels are screen.
2. `find_quad`    - the screen's four corners, so the warp follows the laptop's perspective
                    rather than pasting a flat rectangle onto an angled lid.
3. the warp       - rendered at 4x and downscaled with Lanczos. A single-pass perspective
                    transform drops pixels instead of averaging them, and thin letter
                    strokes are the first thing to break up.
4. `despill`      - green light reflects off a real screen onto the bezel and keys, and the
                    model paints that reflection too. Left alone it stays after the screen
                    is replaced, which reads as a compositing error.
"""
from __future__ import annotations

import io
from typing import List, Optional, Tuple

# Appended to the image prompt for device shots. Kept here, next to the detector, so the
# colour asked for and the colour looked for can never drift apart.
GREEN_SCREEN_CLAUSE = (
    "The {device} screen is filled edge to edge with one flat solid pure green colour, "
    "completely uniform, nothing displayed on it, no reflections and no glare"
)

# A pixel is screen when green clearly dominates. The margin matters: a dark UI with a green
# tint would otherwise be read as screen, and foliage or a green mug in shot would punch
# holes in the mask.
_GREEN_MIN = 150
_DOMINANCE = 60

# Smallest region worth treating as a screen, as a share of total pixels. Below this it is
# almost always a green object in the scene rather than the display.
_MIN_AREA_FRACTION = 0.01

SUPERSAMPLE = 4


class NoScreenFound(RuntimeError):
    """No green region big enough to be a screen; the caller keeps the plain image."""


def green_mask(img) -> "object":
    """Boolean array, True where the pixel reads as green screen."""
    import numpy as np

    arr = np.asarray(img.convert("RGB")).astype(np.int16)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    return (g > _GREEN_MIN) & (g - r > _DOMINANCE) & (g - b > _DOMINANCE)


def find_quad(mask) -> List[Tuple[int, int]]:
    """The screen's four corners, clockwise from top-left.

    Corners are picked by extremes of (x+y) and (x-y) rather than from a bounding box: a
    laptop lid is almost never axis-aligned, and a bounding box would stretch the screenshot
    into the bezel on the near side.
    """
    import numpy as np

    ys, xs = np.nonzero(mask)
    if xs.size == 0:
        raise NoScreenFound("No green screen region detected in the generated image.")
    if xs.size < mask.size * _MIN_AREA_FRACTION:
        raise NoScreenFound(
            "The green region covers %.2f%% of the image, too small to be a screen."
            % (100.0 * xs.size / mask.size))

    s, d = xs + ys, xs - ys
    top_left = (int(xs[np.argmin(s)]), int(ys[np.argmin(s)]))
    bottom_right = (int(xs[np.argmax(s)]), int(ys[np.argmax(s)]))
    top_right = (int(xs[np.argmax(d)]), int(ys[np.argmax(d)]))
    bottom_left = (int(xs[np.argmin(d)]), int(ys[np.argmin(d)]))
    return [top_left, top_right, bottom_right, bottom_left]


def perspective_coeffs(dest_quad, src_size) -> list:
    """Coefficients for PIL's PERSPECTIVE transform.

    PIL maps DESTINATION pixels back to SOURCE, so the system is solved in that direction -
    passing the forward transform produces a correctly-shaped but mirrored result, which is
    the usual way this is got wrong.
    """
    import numpy as np

    w, h = src_size
    src = [(0, 0), (w, 0), (w, h), (0, h)]
    rows = []
    for (dx, dy), (sx, sy) in zip(dest_quad, src):
        rows.append([dx, dy, 1, 0, 0, 0, -sx * dx, -sx * dy])
        rows.append([0, 0, 0, dx, dy, 1, -sy * dx, -sy * dy])
    A = np.array(rows, dtype=float)
    B = np.array(src, dtype=float).reshape(8)
    # lstsq rather than an explicit inverse: the normal-equations form is ill-conditioned
    # for near-degenerate quads and np.matrix is deprecated.
    coeffs, *_ = np.linalg.lstsq(A, B, rcond=None)
    return coeffs.tolist()


def despill(img, mask, grow: int = 4):
    """Pull green reflection out of the pixels AROUND the screen.

    A real screen throws coloured light onto the bezel and keyboard, and the model paints
    that. Once the screen is replaced the green glow has nothing to come from, so it reads
    as a mistake. Clamping green to the larger of red and blue removes the cast while
    leaving genuinely green objects elsewhere alone, because those are inside their own
    dominance test, not this one.
    """
    import numpy as np
    from PIL import Image, ImageFilter

    arr = np.asarray(img.convert("RGB")).astype(np.int16)
    # Only outside the screen, dilated a little so the bezel's inner edge is covered.
    screen = Image.fromarray((mask * 255).astype("uint8")).filter(
        ImageFilter.MaxFilter(2 * grow + 1))
    outside = np.asarray(screen) < 128

    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    cap = np.maximum(r, b)
    spill = outside & (g > cap)
    arr[:, :, 1] = np.where(spill, cap, g)
    return Image.fromarray(arr.astype("uint8"))


def _crop_to_content(shot, target_aspect: float):
    """Trim the screenshot to the target aspect from the top-left.

    A full 1600x1000 dashboard shrunk onto a ~500x320 screen takes 25px text down to about
    8px, which no amount of resampling rescues. Keeping the top-left - where a product's
    header and primary panel live - preserves the part at a readable size instead of
    shrinking everything into illegibility.
    """
    w, h = shot.size
    if w / h > target_aspect:
        return shot.crop((0, 0, int(h * target_aspect), h))
    return shot.crop((0, 0, w, int(w / target_aspect)))


def composite_screenshot(base_bytes: bytes, screenshot_bytes: bytes,
                         crop_to_fit: bool = True) -> bytes:
    """Put the screenshot on the generated device's screen. Returns PNG bytes."""
    from PIL import Image

    base = Image.open(io.BytesIO(base_bytes)).convert("RGB")
    shot = Image.open(io.BytesIO(screenshot_bytes)).convert("RGB")

    mask = green_mask(base)
    quad = find_quad(mask)

    if crop_to_fit:
        width = max(abs(quad[1][0] - quad[0][0]), abs(quad[2][0] - quad[3][0])) or 1
        height = max(abs(quad[3][1] - quad[0][1]), abs(quad[2][1] - quad[1][1])) or 1
        shot = _crop_to_content(shot, width / height)

    cleaned = despill(base, mask)

    # Warp at 4x and come back down with Lanczos. One pass at final size samples rather than
    # averages, and letter strokes a pixel or two wide break apart.
    big = (base.width * SUPERSAMPLE, base.height * SUPERSAMPLE)
    big_quad = [(x * SUPERSAMPLE, y * SUPERSAMPLE) for x, y in quad]
    warped = shot.transform(big, Image.PERSPECTIVE,
                            perspective_coeffs(big_quad, shot.size),
                            resample=Image.BICUBIC)
    warped = warped.resize(base.size, Image.LANCZOS)

    # Grow the mask 2px, then feather 1px.
    #
    # Detection stops at the last pixel that passes the dominance test, but the green area
    # does not: the edge fades into the bezel over a pixel or two, and those partly-green
    # pixels fail the test. Compositing on the raw mask therefore leaves a thin green fringe
    # tracing the whole screen - clearly visible in the first test render. Growing the mask
    # pushes the screenshot under that fade; the blur then softens the seam.
    from PIL import ImageFilter
    screen_mask = (Image.fromarray((mask * 255).astype("uint8"))
                   .filter(ImageFilter.MaxFilter(5))
                   .filter(ImageFilter.GaussianBlur(1)))

    out = Image.composite(warped, cleaned, screen_mask)
    buf = io.BytesIO()
    out.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def wants_green_screen(spec) -> Optional[str]:
    """The device named in the spec, when the creative is a screen shot worth replacing."""
    text = " ".join(str(getattr(spec, f, "") or "") for f in
                    ("visual_concept", "subject", "product", "environment")).lower()
    for device in ("laptop", "macbook", "monitor", "desktop screen", "tablet",
                   "ipad", "phone", "smartphone"):
        if device in text:
            return "laptop" if device in ("macbook",) else device
    return None
