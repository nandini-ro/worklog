from abc import ABC, abstractmethod


class AIProviderError(Exception):
    pass


class AIProvider(ABC):
    """A text-completion provider. Add new providers by subclassing and registering in service.py."""

    name: str = "base"

    @abstractmethod
    def complete(self, system: str, prompt: str, max_tokens: int = 600) -> str:
        """Return the model's text response or raise AIProviderError."""
