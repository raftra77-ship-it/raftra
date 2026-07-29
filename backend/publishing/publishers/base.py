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

    @abstractmethod
    async def publish(self, payload: dict) -> dict:
        """Performs the real write, when implemented. Async because a real implementation
        makes a network call (see publishers/wordpress.py for the one platform this is
        wired up for so far). GitHub/Shopify still return a `status: "not_implemented"`
        placeholder — see ../publish_service.py's docstring for what's left there."""
        ...
