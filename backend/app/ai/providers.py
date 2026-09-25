import httpx

from app.ai.base import AIProvider, AIProviderError


class OpenAICompatibleProvider(AIProvider):
    """OpenAI Chat Completions API. Groq exposes the same API shape."""

    def __init__(self, name: str, api_key: str, model: str, base_url: str, timeout: float):
        self.name = name
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def complete(self, system: str, prompt: str, max_tokens: int = 600) -> str:
        try:
            r = httpx.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": self.model,
                    "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
                    "temperature": 0.3,
                    "max_tokens": max_tokens,
                },
                timeout=self.timeout,
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"].strip()
        except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
            raise AIProviderError(f"{self.name} request failed: {exc}") from exc


def openai_provider(api_key: str, model: str, timeout: float) -> AIProvider:
    return OpenAICompatibleProvider("openai", api_key, model, "https://api.openai.com/v1", timeout)


def groq_provider(api_key: str, model: str, timeout: float) -> AIProvider:
    return OpenAICompatibleProvider("groq", api_key, model, "https://api.groq.com/openai/v1", timeout)


class GeminiProvider(AIProvider):
    name = "gemini"

    def __init__(self, api_key: str, model: str, timeout: float):
        self.api_key = api_key
        self.model = model
        self.timeout = timeout

    def complete(self, system: str, prompt: str, max_tokens: int = 600) -> str:
        try:
            r = httpx.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent",
                headers={"x-goog-api-key": self.api_key},
                json={
                    "systemInstruction": {"parts": [{"text": system}]},
                    "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.3, "maxOutputTokens": max_tokens},
                },
                timeout=self.timeout,
            )
            r.raise_for_status()
            parts = r.json()["candidates"][0]["content"]["parts"]
            return "".join(p.get("text", "") for p in parts).strip()
        except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
            raise AIProviderError(f"gemini request failed: {exc}") from exc
