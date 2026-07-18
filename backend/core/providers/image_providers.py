import httpx
import os
import random
from .base import ImageProvider

class FluxSchnellProvider(ImageProvider):
    async def generate_image(self, prompt: str, aspect_ratio: str = "16:9", **kwargs) -> str:
        # Since the user couldn't log into Flux platforms, we are using Pollinations AI
        # which provides free, high-quality image generation (often powered by Flux) without ANY API key!
        import urllib.parse
        encoded_prompt = urllib.parse.quote(prompt)
        width = 1024
        height = 576 if aspect_ratio == "16:9" else 1024

        # Pollinations is deterministic on the URL - the same prompt returns the exact
        # same image every time. A random seed makes each generation visually distinct,
        # even when the user regenerates from an identical prompt.
        seed = random.randint(1, 1_000_000_000)
        url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width={width}&height={height}&nologo=true&seed={seed}"

        # Pollinations returns the image directly, so we just return the URL!
        return url

class FluxProProvider(ImageProvider):
    async def generate_image(self, prompt: str, aspect_ratio: str = "16:9", **kwargs) -> str:
        # TODO: Implement API call to FLUX Pro
        return "https://mock.url/flux_pro_image.jpg"

class IdeogramProvider(ImageProvider):
    async def generate_image(self, prompt: str, aspect_ratio: str = "16:9", **kwargs) -> str:
        # TODO: Implement API call to Ideogram (good for typography)
        return "https://mock.url/ideogram_image.jpg"

class RecraftProvider(ImageProvider):
    async def generate_image(self, prompt: str, aspect_ratio: str = "16:9", **kwargs) -> str:
        # TODO: Implement API call to Recraft (good for illustrations)
        return "https://mock.url/recraft_image.jpg"

class ImagenProvider(ImageProvider):
    async def generate_image(self, prompt: str, aspect_ratio: str = "16:9", **kwargs) -> str:
        # TODO: Implement API call to Google Imagen
        return "https://mock.url/imagen_image.jpg"

class GPTImageProvider(ImageProvider):
    async def generate_image(self, prompt: str, aspect_ratio: str = "16:9", **kwargs) -> str:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            return "Error: OPENAI_API_KEY is not set."
            
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
                return f"Error: OpenAI API returned status {response.status_code} - {response.text}"
