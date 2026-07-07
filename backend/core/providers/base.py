from abc import ABC, abstractmethod
from typing import Optional

class LLMProvider(ABC):
    """Abstract Base Class for all LLM providers."""
    
    @abstractmethod
    async def generate_text(self, prompt: str, system_prompt: Optional[str] = None, **kwargs) -> str:
        """
        Generate text based on a prompt.
        :param prompt: The user prompt.
        :param system_prompt: Optional system instructions.
        :return: Generated text response.
        """
        pass

class ImageProvider(ABC):
    """Abstract Base Class for all Image Generation providers."""
    
    @abstractmethod
    async def generate_image(self, prompt: str, aspect_ratio: str = "16:9", **kwargs) -> str:
        """
        Generate an image from a text prompt.
        :param prompt: The description of the image.
        :param aspect_ratio: Desired aspect ratio (e.g., "16:9", "1:1").
        :return: A URL or local path to the generated image.
        """
        pass

class VideoProvider(ABC):
    """Abstract Base Class for all Video Generation providers."""
    
    @abstractmethod
    async def generate_video(self, image_url: str, prompt: str, duration: int = 5, **kwargs) -> str:
        """
        Generate a video from a starting image and prompt.
        :param image_url: The starting image URL.
        :param prompt: Motion or style prompt.
        :param duration: Target duration in seconds.
        :return: A URL or local path to the generated video.
        """
        pass
