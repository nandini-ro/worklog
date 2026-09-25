from tests.conftest import category_id, make_entry, make_project


def test_users_cannot_see_or_modify_each_others_data(client, auth, other_auth):
    p = make_project(client, auth)
    e = make_entry(client, auth, project_id=p["id"], task_title="Secret work")
    cat = category_id(client, auth)

    # Reads
    assert client.get(f"/api/work-entries/{e['id']}", headers=other_auth).status_code == 404
    assert client.get(f"/api/projects/{p['id']}", headers=other_auth).status_code == 404
    assert client.get("/api/work-entries", headers=other_auth).json()["total"] == 0
    assert client.get("/api/projects", headers=other_auth).json() == []
    assert client.get("/api/work-entries/day/2026-09-25", headers=other_auth).json() == []
    assert cat not in [c["id"] for c in client.get("/api/categories", headers=other_auth).json()]

    # Writes
    body = {"work_date": "2026-09-25", "task_title": "hijack"}
    assert client.put(f"/api/work-entries/{e['id']}", json=body, headers=other_auth).status_code == 404
    assert client.delete(f"/api/work-entries/{e['id']}", headers=other_auth).status_code == 404
    assert client.post(f"/api/work-entries/{e['id']}/duplicate", headers=other_auth).status_code == 404
    assert client.put(f"/api/projects/{p['id']}", json={"name": "x"}, headers=other_auth).status_code == 404
    assert client.delete(f"/api/projects/{p['id']}", headers=other_auth).status_code == 404
    assert client.delete(f"/api/categories/{cat}", headers=other_auth).status_code == 404

    # Cannot attach own entry to another user's project/category
    assert client.post("/api/work-entries", json={**body, "project_id": p["id"]}, headers=other_auth).status_code == 422
    assert client.post("/api/work-entries", json={**body, "category_id": cat}, headers=other_auth).status_code == 422

    # user_id in payload is ignored
    mine = client.post("/api/work-entries", json={**body, "user_id": 1}, headers=other_auth)
    assert mine.status_code == 201
    assert client.get("/api/work-entries", headers=auth).json()["total"] == 1

    # Reports only include own data; filtering by someone else's project is rejected
    r = client.get("/api/reports", params={"start_date": "2026-09-01", "end_date": "2026-09-30"}, headers=other_auth)
    assert [x["task_title"] for x in r.json()["completed"]] == ["hijack"]
    r = client.get("/api/reports", params={"start_date": "2026-09-01", "end_date": "2026-09-30",
                                            "project_id": p["id"]}, headers=other_auth)
    assert r.status_code == 404
    r = client.get("/api/reports/export/csv", params={"start_date": "2026-09-01", "end_date": "2026-09-30"},
                   headers=other_auth)
    assert "Secret work" not in r.content.decode("utf-8")
