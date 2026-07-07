
from .base import VideoProvider

class SeedanceProvider(VideoProvider):
    async def generate_video(self, image_url: str, prompt: str, duration: int = 5, **kwargs) -> str:
        # TODO: Implement API call to Seedance
        return "https://mock.url/seedance_video.mp4"

class KlingProvider(VideoProvider):
    async def generate_video(self, image_url: str, prompt: str, duration: int = 5, **kwargs) -> str:
        # TODO: Implement API call to Kling
        return "https://mock.url/kling_video.mp4"

class VeoProvider(VideoProvider):
    async def generate_video(self, image_url: str, prompt: str, duration: int = 5, **kwargs) -> str:
        # TODO: Implement API call to Google Veo
        return "https://mock.url/veo_video.mp4"
