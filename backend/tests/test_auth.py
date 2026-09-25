from tests.conftest import register


def test_register_login_me(client):
    headers = register(client)
    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"] == "alice@example.com"
    assert "password_hash" not in me.json()

    r = client.post("/api/auth/login", json={"email": "ALICE@example.com", "password": "password123"})
    assert r.status_code == 200
    assert r.json()["access_token"]


def test_register_creates_default_categories(client):
    headers = register(client)
    names = [c["name"] for c in client.get("/api/categories", headers=headers).json()]
    assert names[:3] == ["Development", "Testing", "Research"] and len(names) == 10


def test_duplicate_email_rejected(client):
    register(client)
    r = client.post("/api/auth/register", json={"name": "A", "email": "alice@example.com", "password": "password123"})
    assert r.status_code == 409


def test_bad_password_and_missing_token(client):
    register(client)
    assert client.post("/api/auth/login", json={"email": "alice@example.com", "password": "wrong-pass"}).status_code == 401
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer garbage"}).status_code == 401
    assert client.get("/api/work-entries").status_code == 401


def test_short_password_rejected(client):
    r = client.post("/api/auth/register", json={"name": "A", "email": "a@example.com", "password": "short"})
    assert r.status_code == 422


def test_change_password(client):
    headers = register(client)
    bad = client.put("/api/auth/me", json={"current_password": "nope", "new_password": "newpassword1"}, headers=headers)
    assert bad.status_code == 400
    ok = client.put("/api/auth/me", json={"current_password": "password123", "new_password": "newpassword1"}, headers=headers)
    assert ok.status_code == 200
    assert client.post("/api/auth/login", json={"email": "alice@example.com", "password": "newpassword1"}).status_code == 200



def test_single_user_mode_needs_no_sign_in(client, monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "single_user", True)
    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert client.get("/api/categories").status_code == 200
    assert client.get("/api/auth/me").json()["id"] == me.json()["id"]
    assert client.get("/api/auth/registration").json() == {"open": False}
