import os
import re
import random
import httpx
from .base import VideoProvider, VideoProviderError

# Words to strip when turning an ad prompt into a stock-video search query - they add
# no visual meaning and hurt matching.
_STOP_WORDS = {
    "create", "generate", "make", "a", "an", "the", "for", "our", "your", "with",
    "video", "ad", "ads", "advertisement", "promo", "promotional", "campaign",
    "targeting", "about", "of", "to", "and", "on", "in", "is", "this", "that",
}


def build_stock_query(prompt: str) -> str:
    """Turn an ad prompt into a few strong keywords for stock-footage search."""
    words = re.findall(r"[a-zA-Z]{3,}", (prompt or "").lower())
    keywords = [w for w in words if w not in _STOP_WORDS]
    return " ".join(keywords[:4]) or "technology business"


# Keyless fallback: a handful of stable, publicly-streamable sample clips. Not matched
# to the ad, but real, working video that rotates so each ad differs - used only when
# no stock-video API key is configured. Add PIXABAY_API_KEY for relevant footage.
_SAMPLE_VIDEOS = [
    "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4",
    "https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4",
    "https://test-videos.co.uk/vids/sintel/mp4/h264/720/Sintel_720_10s_1MB.mp4",
    "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4",
    "https://test-videos.co.uk/vids/jellyfish/mp4/h264/360/Jellyfish_360_10s_1MB.mp4",
    "https://test-videos.co.uk/vids/sintel/mp4/h264/360/Sintel_360_10s_1MB.mp4",
]


class SampleVideoProvider(VideoProvider):
    """Keyless fallback - returns a random working sample clip so Video Ads always
    show a (different) video even with no API key configured."""

    async def generate_video(self, image_url: str, prompt: str, duration: int = 5, **kwargs) -> str:
        return random.choice(_SAMPLE_VIDEOS)


class PixabayVideoProvider(VideoProvider):
    """
    Fetches a relevant stock video from Pixabay (free API). Pixabay issues a working
    key instantly on signup (no review), which is why it's the default. A different,
    topical clip is chosen per ad. Requires PIXABAY_API_KEY.
    """

    async def generate_video(self, image_url: str, prompt: str, duration: int = 5, ad_ratio: str = "9:16", **kwargs) -> str:
        api_key = os.getenv("PIXABAY_API_KEY")
        if not api_key:
            raise VideoProviderError("PIXABAY_API_KEY is not set")

        query = build_stock_query(prompt)
        params = {
            "key": api_key,
            "q": query,
            "per_page": 20,
            "page": random.randint(1, 3),
        }
        async with httpx.AsyncClient() as client:
            res = await client.get("https://pixabay.com/api/videos/", params=params, timeout=30.0)
        if res.status_code != 200:
            raise VideoProviderError(f"Pixabay API returned {res.status_code}: {res.text[:200]}")

        hits = res.json().get("hits", [])
        if not hits:
            raise VideoProviderError(f"No Pixabay stock video found for query '{query}'")

        chosen = random.choice(hits)
        files = chosen.get("videos", {})
        # Prefer a mid-size rendition; fall back through the available sizes.
        for size in ("medium", "large", "small", "tiny"):
            f = files.get(size)
            if f and f.get("url"):
                return f["url"]
        raise VideoProviderError("Pixabay result had no usable video file")


class PexelsVideoProvider(VideoProvider):
    """
    Fetches a real, relevant stock video from Pexels (free API) matched to the ad's
    keywords. Note: Pexels reviews API applications, so the key can be delayed -
    PixabayVideoProvider is the instant-key alternative. Requires PEXELS_API_KEY.
    """

    def _build_query(self, prompt: str) -> str:
        return build_stock_query(prompt)

    def _orientation(self, ad_ratio: str) -> str:
        if ad_ratio in ("9:16", "4:5"):
            return "portrait"
        if ad_ratio == "1:1":
            return "square"
        return "landscape"

    async def generate_video(self, image_url: str, prompt: str, duration: int = 5, ad_ratio: str = "9:16", **kwargs) -> str:
        api_key = os.getenv("PEXELS_API_KEY")
        if not api_key:
            raise VideoProviderError("PEXELS_API_KEY is not set")

        query = self._build_query(prompt)
        params = {
            "query": query,
            "orientation": self._orientation(ad_ratio),
            "per_page": 15,
            # Random page so repeated generations of the same prompt return different clips.
            "page": random.randint(1, 3),
        }
        async with httpx.AsyncClient() as client:
            res = await client.get(
                "https://api.pexels.com/videos/search",
                headers={"Authorization": api_key},
                params=params,
                timeout=30.0,
            )
        if res.status_code != 200:
            raise VideoProviderError(f"Pexels API returned {res.status_code}: {res.text[:200]}")

        videos = res.json().get("videos", [])
        if not videos:
            raise VideoProviderError(f"No Pexels stock video found for query '{query}'")

        # Pick a random result, then a reasonably sized mp4 from it (avoid the huge 4K files).
        chosen = random.choice(videos)
        mp4s = [f for f in chosen.get("video_files", []) if f.get("file_type") == "video/mp4" and f.get("link")]
        if not mp4s:
            raise VideoProviderError("Pexels result had no usable mp4 file")
        mp4s.sort(key=lambda f: f.get("width") or 0)
        # Prefer a mid-size file (SD/HD) rather than the smallest or a massive 4K one.
        pick = mp4s[len(mp4s) // 2]
        return pick["link"]


# Not implemented yet - raise rather than return a fake "https://mock.url/..." string
# that would be saved as a real ad video_url.
class SeedanceProvider(VideoProvider):
    async def generate_video(self, image_url: str, prompt: str, duration: int = 5, **kwargs) -> str:
        raise VideoProviderError("Seedance provider is not implemented.")

class KlingProvider(VideoProvider):
    async def generate_video(self, image_url: str, prompt: str, duration: int = 5, **kwargs) -> str:
        raise VideoProviderError("Kling provider is not implemented.")

class VeoProvider(VideoProvider):
    async def generate_video(self, image_url: str, prompt: str, duration: int = 5, **kwargs) -> str:
        raise VideoProviderError("Google Veo provider is not implemented.")
