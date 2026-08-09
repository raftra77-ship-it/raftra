"""Ken Burns video: animate the generated ad image into a real MP4 with ffmpeg.

Why this exists
---------------
Every video ad was previously a random clip from SampleVideoProvider — Big Buck Bunny,
Jellyfish or Sintel — because both stock-video keys are unset and no video model is wired.
The clip had nothing to do with the prompt, and because the UI renders <video> over <img>
it also hid the one asset that *was* generated from the prompt: the image.

This provider takes that generated image and gives it motion (slow zoom / pan), so the
"video" is guaranteed to match the brief — it literally IS the generated creative. No API,
no key, no quota, no cold start, and nothing to fail at request time except ffmpeg itself.

It is not a substitute for a real text-to-video model: the motion is camera movement, not
scene animation. For static-product ad creative that is usually what you want anyway, and
it is the only genuinely free option that stays on-prompt.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import os
import shutil
import uuid
from pathlib import Path
from typing import Optional

import httpx

from .base import VideoProvider, VideoProviderError
from .image_providers import dimensions_for

# Written under the backend package and served by main.py at /api/generated. Kept inside
# /api so the existing Vite dev proxy forwards it and the URL works unchanged in production
# behind a single origin.
MEDIA_ROOT = Path(__file__).resolve().parents[2] / "generated_media"
VIDEO_DIR = MEDIA_ROOT / "videos"
PUBLIC_PREFIX = "/api/generated/videos"

_FPS = 30
# Upscale before zoompan: the filter samples at INPUT resolution, so zooming a 1024px source
# produces visible stair-stepping. 2x is the cheapest factor that looks smooth.
_SUPERSAMPLE = 2


def ffmpeg_path() -> Optional[str]:
    """Resolved ffmpeg binary.

    Checked in order: an explicit FFMPEG_BINARY, a system install on PATH, then the binary
    bundled by the imageio-ffmpeg wheel. The last one matters because it makes this feature
    work from `pip install -r requirements.txt` alone — no system package manager, no admin
    rights, and identical behaviour on a developer laptop and a slim container image.
    """
    explicit = os.getenv("FFMPEG_BINARY")
    if explicit and Path(explicit).exists():
        return explicit
    found = shutil.which("ffmpeg")
    if found:
        return found
    try:
        import imageio_ffmpeg
        bundled = imageio_ffmpeg.get_ffmpeg_exe()
        return bundled if bundled and Path(bundled).exists() else None
    except Exception:
        return None


def is_available() -> bool:
    return ffmpeg_path() is not None


# Motion styles. Picked deterministically from the prompt so the same ad keeps the same
# movement across regenerations, while different ads visibly differ.
_MOTIONS = ("zoom_in", "zoom_out", "pan_right", "pan_left")


def _zoompan_expr(motion: str, frames: int, w: int, h: int) -> str:
    """zoompan expression for one motion style. `on` is the output frame index."""
    zoom_span = 0.18                       # 18% travel — noticeable but never frantic
    per_frame = zoom_span / max(frames, 1)
    centre_x = "iw/2-(iw/zoom/2)"
    centre_y = "ih/2-(ih/zoom/2)"

    if motion == "zoom_out":
        z = f"'max({1 + zoom_span}-{per_frame:.6f}*on,1.0)'"
        x, y = centre_x, centre_y
    elif motion == "pan_right":
        z = f"'{1 + zoom_span:.4f}'"
        x = f"'(iw-iw/zoom)*min(on/{max(frames - 1, 1)},1)'"
        y = centre_y
    elif motion == "pan_left":
        z = f"'{1 + zoom_span:.4f}'"
        x = f"'(iw-iw/zoom)*(1-min(on/{max(frames - 1, 1)},1))'"
        y = centre_y
    else:  # zoom_in
        z = f"'min(1.0+{per_frame:.6f}*on,{1 + zoom_span})'"
        x, y = centre_x, centre_y

    return (f"zoompan=z={z}:x={x}:y={y}:d={frames}:s={w}x{h}:fps={_FPS}")


def build_filter(motion: str, duration: int, w: int, h: int) -> str:
    frames = max(int(duration * _FPS), 1)
    sw, sh = w * _SUPERSAMPLE, h * _SUPERSAMPLE
    return (
        # Cover the target frame, then crop — never letterbox, never distort the creative.
        f"scale={sw}:{sh}:force_original_aspect_ratio=increase,"
        f"crop={sw}:{sh},"
        f"{_zoompan_expr(motion, frames, w, h)},"
        # yuv420p is required for playback in browsers and by Meta/Google ad uploads.
        f"format=yuv420p"
    )


async def _load_image_bytes(image_url: str) -> bytes:
    """Accepts a data: URL (HF / Nano Banana return base64) or an http(s) URL."""
    if not image_url:
        raise VideoProviderError("No image was generated, so there is nothing to animate.")
    if image_url.startswith("data:"):
        try:
            return base64.b64decode(image_url.split(",", 1)[1])
        except Exception as e:
            raise VideoProviderError(f"Could not decode the generated image: {e}")
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        r = await client.get(image_url)
    if r.status_code != 200:
        raise VideoProviderError(
            f"Could not download the generated image ({r.status_code}) to animate it.")
    return r.content


class KenBurnsVideoProvider(VideoProvider):
    """Turns the generated still into an MP4 with a slow camera move."""

    async def generate_video(self, image_url: str, prompt: str, duration: int = 5,
                             ad_ratio: str = "9:16", **kwargs) -> str:
        binary = ffmpeg_path()
        if not binary:
            raise VideoProviderError(
                "ffmpeg is not installed or not on PATH, so the image cannot be animated. "
                "Install ffmpeg (or set FFMPEG_BINARY to its full path) and try again.")

        duration = max(2, min(int(duration or 5), 30))
        width, height = dimensions_for(ad_ratio)
        # Deterministic per prompt: same ad keeps its motion, different ads differ.
        motion = _MOTIONS[int(hashlib.sha1((prompt or "").encode()).hexdigest(), 16) % len(_MOTIONS)]

        VIDEO_DIR.mkdir(parents=True, exist_ok=True)
        token = uuid.uuid4().hex
        src = VIDEO_DIR / f"{token}.src"
        out = VIDEO_DIR / f"{token}.mp4"
        src.write_bytes(await _load_image_bytes(image_url))

        cmd = [
            binary, "-y", "-hide_banner", "-loglevel", "error",
            "-loop", "1", "-i", str(src),
            "-vf", build_filter(motion, duration, width, height),
            "-t", str(duration),
            "-r", str(_FPS),
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
            "-movflags", "+faststart",
            str(out),
        ]
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            _, stderr = await asyncio.wait_for(proc.communicate(), timeout=180)
        except asyncio.TimeoutError:
            raise VideoProviderError("ffmpeg timed out while rendering the video.")
        finally:
            src.unlink(missing_ok=True)

        if proc.returncode != 0 or not out.exists() or out.stat().st_size == 0:
            out.unlink(missing_ok=True)
            detail = (stderr or b"").decode(errors="replace").strip()[:300]
            raise VideoProviderError(f"ffmpeg failed to render the video: {detail}")

        return f"{PUBLIC_PREFIX}/{out.name}"
