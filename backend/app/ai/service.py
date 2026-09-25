import logging
from functools import lru_cache

from app.ai.base import AIProvider, AIProviderError
from app.ai.local import local_improve, local_report_summary
from app.ai.providers import GeminiProvider, groq_provider, openai_provider
from app.core.config import Settings, get_settings

log = logging.getLogger(__name__)

IMPROVE_SYSTEM = (
    "You rewrite short, informal work-log notes into one or two clear, professional sentences suitable for a "
    "status report to a manager. Keep every fact from the original, do not invent work, results, numbers or "
    "time spent. Use past tense. Return only the rewritten text with no preamble or quotes."
)

SUMMARY_SYSTEM = (
    "You write concise executive summaries of a person's work log for their manager. Write one paragraph of "
    "3-5 sentences in third-person-neutral professional prose (e.g. 'During this period, development focused "
    "on...'). Mention the main projects and themes, key completed work, ongoing work and blockers if any. "
    "Only use facts from the provided entries. Never mention hours, time spent or durations. Return only the "
    "paragraph."
)


def build_provider(settings: Settings) -> AIProvider | None:
    choice = settings.ai_provider.lower()
    t = settings.ai_timeout_seconds
    candidates = {
        "openai": lambda: openai_provider(settings.openai_api_key, settings.openai_model, t) if settings.openai_api_key else None,
        "groq": lambda: groq_provider(settings.groq_api_key, settings.groq_model, t) if settings.groq_api_key else None,
        "gemini": lambda: GeminiProvider(settings.gemini_api_key, settings.gemini_model, t) if settings.gemini_api_key else None,
    }
    if choice == "local":
        return None
    if choice in candidates:
        return candidates[choice]()
    for name in ("openai", "groq", "gemini"):  # auto: first configured key wins
        p = candidates[name]()
        if p:
            return p
    return None


class AIService:
    def __init__(self, provider: AIProvider | None):
        self.provider = provider

    @property
    def provider_name(self) -> str:
        return self.provider.name if self.provider else "local"

    def improve_description(self, text: str, task_title: str | None = None, project: str | None = None) -> tuple[str, str, str | None]:
        if self.provider:
            ctx = []
            if project:
                ctx.append(f"Project: {project}")
            if task_title:
                ctx.append(f"Task: {task_title}")
            prompt = ("\n".join(ctx) + "\n\n" if ctx else "") + f"Original note:\n{text}"
            try:
                return self.provider.complete(IMPROVE_SYSTEM, prompt, 300), self.provider.name, None
            except AIProviderError as exc:
                log.warning("AI improve failed, using local fallback: %s", exc)
                return local_improve(text), "local", "AI provider unavailable; showing a basic local suggestion."
        return local_improve(text), "local", None

    def report_summary(self, report: dict) -> tuple[str, str, str | None]:
        if self.provider and report["totals"]["entries"]:
            lines = [f"Period: {report['period']['label']}", "Entries:"]
            for e in report["completed"] + report["in_progress"] + report["planned"] + [
                b for b in report["blockers"] if b["status"] == "blocked"
            ]:
                line = f"- [{e['date']}] [{e['status_label']}] {e['project'] or 'General'} / {e['category'] or '-'}: {e['task_title']}"
                if e["description"]:
                    line += f" — {e['description']}"
                if e["blockers"]:
                    line += f" (Blocker: {e['blockers']})"
                lines.append(line)
            prompt = "\n".join(lines[:400])
            try:
                return self.provider.complete(SUMMARY_SYSTEM, prompt, 500), self.provider.name, None
            except AIProviderError as exc:
                log.warning("AI summary failed, using local fallback: %s", exc)
                return local_report_summary(report), "local", "AI provider unavailable; generated a basic local summary."
        return local_report_summary(report), "local", None


@lru_cache
def _cached_service() -> AIService:
    return AIService(build_provider(get_settings()))


def get_ai_service() -> AIService:
    return _cached_service()
