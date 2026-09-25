import os

# Must be set before the app (and its engine) is imported.
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "postgresql+psycopg://localhost:5432/worklog_test")
os.environ["AI_PROVIDER"] = "local"
os.environ["SINGLE_USER"] = "false"
os.environ["JWT_SECRET"] = "test-secret-that-is-at-least-32-bytes-long"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _schema():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def _clean():
    yield
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE work_entries, categories, projects, users RESTART IDENTITY CASCADE"))


@pytest.fixture
def client():
    return TestClient(app)


def register(client, email="alice@example.com", name="Alice", password="password123"):
    r = client.post("/api/auth/register", json={"name": name, "email": email, "password": password})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def auth(client):
    return register(client)


@pytest.fixture
def other_auth(client):
    return register(client, email="bob@example.com", name="Bob")


def category_id(client, headers, name="Development"):
    return next(c["id"] for c in client.get("/api/categories", headers=headers).json() if c["name"] == name)


def make_project(api, headers, name="Agent Platform", **kw):
    r = api.post("/api/projects", json={"name": name, **kw}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def make_entry(client, headers, **kw):
    body = {"work_date": "2026-09-25", "task_title": "Task", "status": "completed", **kw}
    r = client.post("/api/work-entries", json=body, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()
