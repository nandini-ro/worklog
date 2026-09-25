from tests.conftest import make_entry, make_project


def test_project_crud(client, auth):
    p = make_project(client, auth, description="Core", client="Platform Team", color="#0ea5e9",
                     start_date="2026-09-01")
    assert p["status"] == "active" and p["entry_count"] == 0

    r = client.get(f"/api/projects/{p['id']}", headers=auth)
    assert r.status_code == 200 and r.json()["client"] == "Platform Team"

    r = client.put(f"/api/projects/{p['id']}", headers=auth,
                   json={"name": "Agent Platform v2", "status": "on_hold", "color": "#111111"})
    assert r.status_code == 200
    assert r.json()["name"] == "Agent Platform v2" and r.json()["status"] == "on_hold"

    assert len(client.get("/api/projects", headers=auth).json()) == 1
    assert client.delete(f"/api/projects/{p['id']}", headers=auth).status_code == 204
    assert client.get(f"/api/projects/{p['id']}", headers=auth).status_code == 404


def test_project_validation(client, auth):
    make_project(client, auth)
    assert client.post("/api/projects", json={"name": "Agent Platform"}, headers=auth).status_code == 409
    assert client.post("/api/projects", json={"name": "  "}, headers=auth).status_code == 422
    assert client.post("/api/projects", json={"name": "X", "color": "red"}, headers=auth).status_code == 422
    r = client.post("/api/projects", json={"name": "Y", "start_date": "2026-09-10", "end_date": "2026-09-01"},
                    headers=auth)
    assert r.status_code == 422


def test_project_stats_and_delete_keeps_entries(client, auth):
    p = make_project(client, auth)
    make_entry(client, auth, project_id=p["id"], status="completed", work_date="2026-09-20")
    make_entry(client, auth, project_id=p["id"], status="in_progress", work_date="2026-09-24")
    e = make_entry(client, auth, project_id=p["id"], status="blocked", work_date="2026-09-22")
    stats = client.get(f"/api/projects/{p['id']}", headers=auth).json()
    assert (stats["entry_count"], stats["completed_count"], stats["in_progress_count"], stats["blocked_count"]) == (3, 1, 1, 1)
    assert stats["last_activity"] == "2026-09-24"

    client.delete(f"/api/projects/{p['id']}", headers=auth)
    kept = client.get(f"/api/work-entries/{e['id']}", headers=auth)
    assert kept.status_code == 200 and kept.json()["project_id"] is None


def test_project_filter_by_status(client, auth):
    make_project(client, auth, name="A")
    make_project(client, auth, name="B", status="archived")
    r = client.get("/api/projects", params={"status": "archived"}, headers=auth).json()
    assert [p["name"] for p in r] == ["B"]
