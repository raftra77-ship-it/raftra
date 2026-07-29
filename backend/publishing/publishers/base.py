from abc import ABC, abstractmethod
from typing import Any, Optional


class Publisher(ABC):
    """One platform's publishing surface. `connection` is that platform's connection model
    instance (models.GitHubConnection / WordPressConnection / ShopifyConnection), passed in
    by whoever constructs the publisher — this class never queries the database itself.
    """

    platform_name: str

    def __init__(self, connection: Optional[Any] = None):
        self.connection = connection

    @abstractmethod
    def validate(self, payload: dict) -> dict:
        """Check the payload + connection are complete enough to publish. Returns
        {"valid": bool, "errors": [str, ...]}. No network calls."""
        ...

    @abstractmethod
    def preview(self, payload: dict) -> dict:
        """A human-readable summary of what would happen if publish() ran for real. No
        network calls — this only describes the payload already produced by a converter."""
        ...

    async def publish(self, payload: dict) -> dict:
        """Architecture-only placeholder for all three platforms right now — no external
        API is called anywhere in this package. Returns the same preview a human would
        review, wrapped as "ready_for_publish" so the shape already matches what a real
        implementation will return later.

        Step 8 of the publishing architecture: a platform "goes real" by overriding just
        this method in its subclass (e.g. publishers/wordpress.py) to make the actual API
        call — validate(), preview(), the converters, and PublishService all stay
        unchanged.
        """
        return {"status": "ready_for_publish", "platform": self.platform_name, "payload": self.preview(payload)}
