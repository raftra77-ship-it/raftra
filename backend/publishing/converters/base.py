from abc import ABC, abstractmethod

from ..schema import GenericRecommendation


class PlatformConverter(ABC):
    """Translates generic recommendations into one platform's payload shape.

    Subclasses implement `convert_one()` only; `convert()` (the list version) is shared.
    Converters are pure data transforms — they never touch the network or the database.
    """

    platform_name: str

    @abstractmethod
    def convert_one(self, rec: GenericRecommendation) -> dict:
        ...

    def convert(self, recommendations: list[GenericRecommendation]) -> list[dict]:
        return [self.convert_one(rec) for rec in recommendations]
