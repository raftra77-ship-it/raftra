import base64
import httpx
import os
import random
from .base import ImageProvider, ImageProviderError


# Pixel dimensions per ad ratio. Diffusion models expect each side to be a multiple of 16
# (FLUX/SD downsample by 8 then patch by 2); an off-grid size is silently rounded, which is
# how a "9:16" request came back looking square-ish even where the API accepted dimensions.
#
# Previously this logic was one line inside FluxSchnellProvider:
#     height = 576 if aspect_ratio == "16:9" else 1024
# so EVERY non-16:9 ratio produced a 1024x1024 square — including 9:16, which is the format
# Reels/Stories ads actually run in. Centralised here so every provider agrees.
_RATIO_DIMENSIONS = {
    "16:9": (1024, 576),
    "9:16": (576, 1024),
    "1:1":  (1024, 1024),
    "4:5":  (816, 1024),    # 0.797 — closest 16-multiple to 0.8
    "5:4":  (1024, 816),
    "4:3":  (1024, 768),
    "3:4":  (768, 1024),
    "21:9": (1024, 448),
}
_DEFAULT_DIMENSIONS = _RATIO_DIMENSIONS["16:9"]


def dimensions_for(aspect_ratio: str) -> tuple[int, int]:
    """(width, height) for an ad ratio, defaulting to 16:9 for anything unrecognised."""
    return _RATIO_DIMENSIONS.get((aspect_ratio or "").strip(), _DEFAULT_DIMENSIONS)


# Applied as a negative prompt where the provider supports one. These are the artefacts that
# make a generated image unusable as an ad, not stylistic preferences.
DEFAULT_NEGATIVE_PROMPT = (
    "watermark, signature, stock photo watermark, blurry, low resolution, jpeg artifacts, "
    "distorted proportions, extra limbs, deformed hands, malformed text, gibberish text"
)


class NanoBananaProvider(ImageProvider):
    """Gemini 2.5 Flash Image ("Nano Banana") - Google's image-generation model, reachable
    with the same GEMINI_API_KEY already used for text. Returns a data: URL directly (the
    API returns inline base64 bytes, not a hosted link) - same pattern already used for
    user-uploaded creative images elsewhere in this app."""
    async def generate_image(self, prompt: str, aspect_ratio: str = "16:9", **kwargs) -> str:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ImageProviderError("GEMINI_API_KEY is not set.")

        url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseModalities": ["IMAGE"]},
        }
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(url, params={"key": api_key}, json=payload)
        if r.status_code != 200:
            raise ImageProviderError(f"Nano Banana (Gemini image) API returned {r.status_code}: {r.text[:300]}")
        data = r.json()
        try:
            parts = data["candidates"][0]["content"]["parts"]
        except (KeyError, IndexError):
            raise ImageProviderError(f"Nano Banana returned no image candidates: {str(data)[:300]}")
        for part in parts:
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and inline.get("data"):
                mime = inline.get("mimeType") or inline.get("mime_type") or "image/png"
                return f"data:{mime};base64,{inline['data']}"
        raise ImageProviderError("Nano Banana response contained no image data.")

# How long to wait for Pollinations to render before handing the URL over unwarmed.
#
# Measured ~19s for a successful 1024x576 render. This was 45s, which was too generous in
# the case that actually matters: when Pollinations answers 500, the wait is pure loss and
# it pushed media generation from 40s to 105s. 25s covers a normal render with a little
# headroom and bounds the bad case to something a progress indicator can sit through.
#
# Raised to 40: 25s was below Pollinations' own spread. The same prompt measured 15s, 82s
# and a hard timeout within minutes, so a 25s ceiling turned ordinary slowness into a
# reported failure. 40s catches the common case; anything slower is handed to the browser
# unwarmed rather than failed (see generate_image).
_POLLINATIONS_WARM_TIMEOUT = float(os.getenv("POLLINATIONS_WARM_TIMEOUT_SEC", "40"))
# Two attempts, not more: each one costs a full timeout, and a service failing twice in a
# row is not having a momentary blip. Better to surface the error than to keep the user
# waiting a minute for a free endpoint that is currently unwell.
_POLLINATIONS_ATTEMPTS = int(os.getenv("POLLINATIONS_ATTEMPTS", "2"))


class FluxSchnellProvider(ImageProvider):
    async def generate_image(self, prompt: str, aspect_ratio: str = "16:9", **kwargs) -> str:
        # Since the user couldn't log into Flux platforms, we are using Pollinations AI
        # which provides free, high-quality image generation (often powered by Flux) without ANY API key!
        import urllib.parse
        # Pollinations has NO negative_prompt parameter. When the pipeline moved text
        # suppression out of the prompt string and into a separate negative_prompt field,
        # this provider silently dropped it — and the model started baking garbled
        # lettering into ad creative. Inline the critical negatives as plain text, which
        # is the only channel Pollinations actually reads.
        negative = (kwargs.get("negative_prompt") or "").strip()
        if negative:
            # Only the terms that matter visually; the full artefact list would swamp a
            # URL-encoded GET and dilute the subject.
            key_terms = [t.strip() for t in negative.split(",")
                         if t.strip() in ("text", "words", "letters", "captions", "logos",
                                          "watermark", "signature", "blurry",
                                          "gibberish text", "malformed text")]
            if key_terms:
                prompt = f"{prompt}. Without any {', '.join(dict.fromkeys(key_terms))}"

        encoded_prompt = urllib.parse.quote(prompt)
        width, height = dimensions_for(aspect_ratio)

        # Pollinations is deterministic on the URL - the same prompt returns the exact
        # same image every time. A random seed makes each generation visually distinct,
        # even when the user regenerates from an identical prompt.
        # A caller-supplied seed makes a good generation reproducible; without one we still
        # randomise, because Pollinations is deterministic on the URL and a fixed seed would
        # return the identical image every time the user pressed Regenerate.
        seed = int(kwargs.get("seed") or random.randint(1, 1_000_000_000))
        url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width={width}&height={height}&nologo=true&seed={seed}"

        # Warm the URL before handing it out.
        #
        # Pollinations does not generate when the URL is built - it generates on the FIRST
        # GET. Returning the URL unwarmed made this function look instant (measured: 0ms)
        # while the real ~19 seconds was paid by the user's browser, after the backend had
        # already reported success. The UI therefore showed a finished generation with a
        # broken or endlessly-loading image, which is the "takes so long to reload" report.
        #
        # Fetching it here moves that wait into the generation step, where the progress
        # indicator already lives, and the response is cached so the browser's own request
        # returns immediately. A failure to warm is not fatal: the URL is still valid and
        # the browser will simply trigger generation itself, exactly as before.
        # Pollinations is intermittent: the same prompt measured a 500 in 15s, a 200 in 15s
        # and a 200 in 82s within minutes of each other. A 500 is usually transient and a
        # fresh seed clears it, so retry rather than give up - but NEVER hand back a URL
        # that was just observed serving an error. Returning it regardless is what let a
        # failed generation be saved as a finished creative whose image is an error body.
        # A TIMEOUT and an ERROR mean different things here, and treating them alike was a
        # mistake worth correcting: on a timeout Pollinations is usually still rendering, so
        # the URL frequently works by the time the browser asks for it (measured: the same
        # prompt returned 200 after 82s). Failing the generation in that case throws away an
        # image that was on its way. An explicit non-200, by contrast, is a URL known to
        # serve an error body, and handing that back as a finished creative is what this
        # retry loop exists to prevent.
        last_status = None
        timed_out = False
        for attempt in range(_POLLINATIONS_ATTEMPTS):
            if attempt:
                seed = random.randint(1, 1_000_000_000)
                url = (f"https://image.pollinations.ai/prompt/{encoded_prompt}"
                       f"?width={width}&height={height}&nologo=true&seed={seed}")
            try:
                async with httpx.AsyncClient(timeout=_POLLINATIONS_WARM_TIMEOUT,
                                             follow_redirects=True) as client:
                    r = await client.get(url)
                last_status = r.status_code
                if r.status_code == 200 and (r.headers.get("content-type") or "").startswith("image/"):
                    return url
                print(f"Pollinations attempt {attempt + 1} returned {r.status_code} "
                      f"({r.headers.get('content-type')}); retrying with a new seed.")
            except httpx.TimeoutException:
                timed_out = True
                last_status = "timeout"
                print(f"Pollinations attempt {attempt + 1} still rendering after "
                      f"{_POLLINATIONS_WARM_TIMEOUT}s.")
                # Keep THIS url: the render it started is the one likely to land.
                break
            except Exception as e:
                last_status = f"{type(e).__name__}"
                print(f"Pollinations attempt {attempt + 1} failed ({type(e).__name__}: {e}).")

        if timed_out:
            # Hand back the URL unwarmed. The browser picks up the render already in flight;
            # worst case it waits, which is the behaviour before warming existed at all.
            print("Pollinations: handing back the URL unwarmed; the browser will wait for it.")
            return url

        raise ImageProviderError(
            f"Pollinations did not return an image after {_POLLINATIONS_ATTEMPTS} attempts "
            f"(last: {last_status}). It is a keyless free service with no availability "
            f"guarantee - set HUGGINGFACE_API_KEY to use FLUX.1-schnell instead, which is "
            f"both faster and reliable.")


class HFFluxSchnellProvider(ImageProvider):
    """Real FLUX.1-schnell through Hugging Face Inference Providers.

    This is the free option that actually follows prompts. Unlike Pollinations (a keyless
    proxy with no quality guarantees) it runs the real 12B FLUX.1-schnell weights, and unlike
    Cloudflare's hosted flux-1-schnell — whose API takes only prompt/seed/steps — it accepts
    width/height, so 9:16 Reels creative comes out actually vertical.

    Needs a free HF token with "Inference Providers" permission in HUGGINGFACE_API_KEY.
    Returns a data: URL because the API responds with raw image bytes, matching the pattern
    NanoBananaProvider already uses.
    """

    MODEL = os.getenv("HF_IMAGE_MODEL", "black-forest-labs/FLUX.1-schnell")

    async def generate_image(self, prompt: str, aspect_ratio: str = "16:9", **kwargs) -> str:
        api_key = os.getenv("HUGGINGFACE_API_KEY") or os.getenv("HF_TOKEN")
        if not api_key:
            raise ImageProviderError(
                "HUGGINGFACE_API_KEY is not set. Create a free token with 'Inference "
                "Providers' permission at huggingface.co/settings/tokens.")

        width, height = dimensions_for(aspect_ratio)
        # OpenAI-compatible image endpoint. The older /models/{id} "inputs"+"parameters"
        # shape is dead for FLUX: /hf-inference/ answers 410 (deprecated for this model),
        # and /{provider}/models/{id} 404s. Verified working against nscale and together;
        # fal-ai rejects this shape, which is why a backend is pinned rather than
        # auto-routed. HF_INFERENCE_BACKEND overrides.
        backend = os.getenv("HF_INFERENCE_BACKEND", "nscale").strip()
        url = f"https://router.huggingface.co/{backend}/v1/images/generations"
        payload = {
            "model": self.MODEL,
            "prompt": prompt,
            "response_format": "b64_json",
            "width": width,
            "height": height,
            # schnell is a distilled 4-step model; more steps cost time without gain.
            "num_inference_steps": int(kwargs.get("steps", 4)),
            "negative_prompt": kwargs.get("negative_prompt", DEFAULT_NEGATIVE_PROMPT),
        }
        # Only when the caller supplied one: omitting it lets the service randomise, which is
        # what Regenerate needs.
        if kwargs.get("seed"):
            payload["seed"] = int(kwargs["seed"])
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(url, headers={"Authorization": f"Bearer {api_key}"},
                                  json=payload)

        if r.status_code == 503:
            # Serverless models cold-start; the caller decides whether to retry.
            raise ImageProviderError(
                "The Hugging Face model is still loading (cold start). Try again in a moment.")
        if r.status_code != 200:
            raise ImageProviderError(
                f"Hugging Face inference returned {r.status_code}: {r.text[:300]}")

        content_type = (r.headers.get("content-type") or "").lower()
        if content_type.startswith("image/"):
            encoded = base64.b64encode(r.content).decode()
            return f"data:{content_type.split(';')[0]};base64,{encoded}"

        # Some providers answer with JSON carrying base64 instead of raw bytes.
        try:
            data = r.json()
        except Exception:
            raise ImageProviderError(
                f"Hugging Face returned an unexpected content-type: {content_type!r}")
        # OpenAI-compatible shape: {"data": [{"b64_json": ...}]} or {"data":[{"url": ...}]}
        entries = data.get("data") if isinstance(data, dict) else None
        if isinstance(entries, list) and entries:
            first = entries[0] or {}
            if first.get("b64_json"):
                return f"data:image/png;base64,{first['b64_json']}"
            if first.get("url"):
                return first["url"]
        # Older/simple shapes some providers still return.
        for key in ("image", "b64_json", "image_base64"):
            if isinstance(data, dict) and data.get(key):
                return f"data:image/png;base64,{data[key]}"
        raise ImageProviderError(f"Hugging Face response contained no image: {str(data)[:300]}")

# These providers are not implemented yet. They raise rather than return a fake
# "https://mock.url/..." string, which would otherwise be saved as a real ad image_url.
class FluxProProvider(ImageProvider):
    async def generate_image(self, prompt: str, aspect_ratio: str = "16:9", **kwargs) -> str:
        raise ImageProviderError("FLUX Pro provider is not implemented.")

class IdeogramProvider(ImageProvider):
    async def generate_image(self, prompt: str, aspect_ratio: str = "16:9", **kwargs) -> str:
        raise ImageProviderError("Ideogram provider is not implemented.")

class RecraftProvider(ImageProvider):
    async def generate_image(self, prompt: str, aspect_ratio: str = "16:9", **kwargs) -> str:
        raise ImageProviderError("Recraft provider is not implemented.")

class ImagenProvider(ImageProvider):
    async def generate_image(self, prompt: str, aspect_ratio: str = "16:9", **kwargs) -> str:
        raise ImageProviderError("Google Imagen provider is not implemented.")

class GPTImageProvider(ImageProvider):
    async def generate_image(self, prompt: str, aspect_ratio: str = "16:9", **kwargs) -> str:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ImageProviderError("OPENAI_API_KEY is not set.")

        url = "https://api.openai.com/v1/images/generations"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "dall-e-3",
            "prompt": prompt,
            "n": 1,
            "size": "1024x1024" # DALL-E 3 doesn't support 16:9 standardly in the same way, but 1024x1024 is safe
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=60.0)
            if response.status_code == 200:
                data = response.json()
                return data["data"][0]["url"]
            else:
                raise ImageProviderError(f"OpenAI API returned status {response.status_code} - {response.text}")
