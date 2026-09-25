from app.ai.base import AIProvider, AIProviderError
from app.ai.service import AIService
from tests.conftest import make_entry


def test_improve_description_local_fallback(client, auth):
    r = client.post("/api/ai/improve-description", json={"text": "fixed api model frontend and tested agent"},
                    headers=auth)
    assert r.status_code == 200
    body = r.json()
    assert body["original"] == "fixed api model frontend and tested agent"
    assert body["provider"] == "local"
    assert body["suggestion"].startswith("Resolved API") and body["suggestion"].endswith(".")


def test_improve_does_not_modify_entries(client, auth):
    e = make_entry(client, auth, description="fixed api stuff")
    client.post("/api/ai/improve-description", json={"text": "fixed api stuff"}, headers=auth)
    assert client.get(f"/api/work-entries/{e['id']}", headers=auth).json()["description"] == "fixed api stuff"


def test_generate_summary_local(client, auth):
    make_entry(client, auth, task_title="Model API configuration")
    r = client.post("/api/ai/generate-report-summary", json={"start_date": "2026-09-21", "end_date": "2026-09-25"},
                    headers=auth)
    assert r.status_code == 200 and "Model API configuration" in r.json()["summary"]


def test_ai_status(client, auth):
    assert client.get("/api/ai/status", headers=auth).json()["provider"] == "local"


class FakeProvider(AIProvider):
    name = "fake"

    def __init__(self, fail=False):
        self.fail = fail

    def complete(self, system, prompt, max_tokens=600):
        if self.fail:
            raise AIProviderError("boom")
        return "Integrated model API configuration into the frontend."


def test_provider_used_and_falls_back():
    svc = AIService(FakeProvider())
    assert svc.improve_description("fixed api")[:2] == ("Integrated model API configuration into the frontend.", "fake")
    svc = AIService(FakeProvider(fail=True))
    text, provider, warning = svc.improve_description("fixed api")
    assert provider == "local" and warning and text == "Resolved API."
