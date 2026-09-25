from tests.conftest import category_id, make_entry, make_project

TIME_FIELDS = {"hours", "duration", "start_time", "end_time", "billable_hours", "hourly_rate"}


def test_entry_crud(client, auth):
    p = make_project(client, auth)
    cat = category_id(client, auth)
    e = make_entry(client, auth, project_id=p["id"], category_id=cat, task_title="Model API Configuration",
                   description="Added model API key config", notes="Validated", status="completed")
    assert e["project"]["name"] == "Agent Platform" and e["category"]["name"] == "Development"
    assert not TIME_FIELDS & set(e.keys())

    r = client.get(f"/api/work-entries/{e['id']}", headers=auth)
    assert r.status_code == 200

    upd = {**{k: e[k] for k in ("work_date", "project_id", "category_id", "description", "notes")},
           "task_title": "Model API Configuration (v2)", "status": "in_progress", "blockers": "Waiting on keys"}
    r = client.put(f"/api/work-entries/{e['id']}", json=upd, headers=auth)
    assert r.status_code == 200
    assert r.json()["task_title"] == "Model API Configuration (v2)" and r.json()["blockers"] == "Waiting on keys"

    assert client.delete(f"/api/work-entries/{e['id']}", headers=auth).status_code == 204
    assert client.get(f"/api/work-entries/{e['id']}", headers=auth).status_code == 404


def test_multiple_entries_same_day(client, auth):
    for t in ("Model Configuration", "MCP server testing", "Prepared agent endpoints"):
        make_entry(client, auth, task_title=t, work_date="2026-09-25")
    make_entry(client, auth, task_title="Other day", work_date="2026-09-24")
    day = client.get("/api/work-entries/day/2026-09-25", headers=auth).json()
    assert [e["task_title"] for e in day] == ["Model Configuration", "MCP server testing", "Prepared agent endpoints"]


def test_validation(client, auth):
    assert client.post("/api/work-entries", json={"work_date": "2026-09-25", "task_title": " "},
                       headers=auth).status_code == 422
    assert client.post("/api/work-entries", json={"work_date": "2026-09-25", "task_title": "x", "status": "done"},
                       headers=auth).status_code == 422


def test_date_filtering(client, auth):
    for d in ("2026-09-20", "2026-09-22", "2026-09-24", "2026-09-26"):
        make_entry(client, auth, work_date=d, task_title=f"T {d}")
    r = client.get("/api/work-entries", params={"start_date": "2026-09-21", "end_date": "2026-09-24"},
                   headers=auth).json()
    assert r["total"] == 2
    assert [e["work_date"] for e in r["items"]] == ["2026-09-24", "2026-09-22"]


def test_status_project_category_filtering_and_search(client, auth):
    p1 = make_project(client, auth, name="P1")
    p2 = make_project(client, auth, name="P2")
    dev = category_id(client, auth, "Development")
    test = category_id(client, auth, "Testing")
    make_entry(client, auth, project_id=p1["id"], category_id=dev, status="completed", task_title="Alpha")
    make_entry(client, auth, project_id=p1["id"], category_id=test, status="blocked", task_title="Beta",
               description="waiting on garak access")
    make_entry(client, auth, project_id=p2["id"], category_id=dev, status="in_progress", task_title="Gamma")

    def titles(**params):
        return sorted(e["task_title"] for e in client.get("/api/work-entries", params=params, headers=auth).json()["items"])

    assert titles(status="blocked") == ["Beta"]
    assert titles(status="completed") == ["Alpha"]
    assert titles(project_id=p1["id"]) == ["Alpha", "Beta"]
    assert titles(category_id=dev) == ["Alpha", "Gamma"]
    assert titles(q="garak") == ["Beta"]
    assert titles(q="P2") == ["Gamma"]


def test_sort_and_pagination(client, auth):
    for i in range(25):
        make_entry(client, auth, task_title=f"Task {i:02d}", work_date=f"2026-09-{(i % 28) + 1:02d}")
    r = client.get("/api/work-entries", params={"page": 2, "page_size": 10, "sort": "task_title", "order": "asc"},
                   headers=auth).json()
    assert r["total"] == 25 and r["pages"] == 3 and r["page"] == 2
    assert r["items"][0]["task_title"] == "Task 10"


def test_duplicate_and_copy_day(client, auth):
    e = make_entry(client, auth, task_title="Daily standup", work_date="2026-09-24", status="completed")
    make_entry(client, auth, task_title="Ongoing", work_date="2026-09-24", status="in_progress")
    dup = client.post(f"/api/work-entries/{e['id']}/duplicate", json={"work_date": "2026-09-25"}, headers=auth)
    assert dup.status_code == 201 and dup.json()["work_date"] == "2026-09-25" and dup.json()["id"] != e["id"]

    r = client.post("/api/work-entries/copy-day", headers=auth,
                    json={"source_date": "2026-09-24", "target_date": "2026-09-26", "only_unfinished": True})
    assert r.status_code == 201 and [x["task_title"] for x in r.json()] == ["Ongoing"]
    r = client.post("/api/work-entries/copy-day", headers=auth,
                    json={"source_date": "2026-09-01", "target_date": "2026-09-26"})
    assert r.status_code == 404


def test_calendar_and_recent_meta(client, auth):
    p = make_project(client, auth)
    make_entry(client, auth, work_date="2026-09-25", status="completed", project_id=p["id"])
    make_entry(client, auth, work_date="2026-09-25", status="blocked")
    make_entry(client, auth, work_date="2026-09-10", status="in_progress")
    make_entry(client, auth, work_date="2026-10-01")
    cal = client.get("/api/work-entries/calendar", params={"year": 2026, "month": 9}, headers=auth).json()
    assert cal == [
        {"date": "2026-09-10", "total": 1, "completed": 0, "in_progress": 1, "blocked": 0, "planned": 0},
        {"date": "2026-09-25", "total": 2, "completed": 1, "in_progress": 0, "blocked": 1, "planned": 0},
    ]
    meta = client.get("/api/work-entries/recent-meta", headers=auth).json()
    assert [x["name"] for x in meta["projects"]] == ["Agent Platform"]


def test_dashboard(client, auth):
    make_entry(client, auth, work_date="2026-09-25", status="completed")
    make_entry(client, auth, work_date="2026-09-23", status="blocked")
    make_entry(client, auth, work_date="2026-09-02", status="in_progress")
    d = client.get("/api/dashboard", params={"today": "2026-09-25"}, headers=auth).json()
    assert d["counts"] == {"today": 1, "week": 2, "month": 3}
    assert d["status_counts"]["blocked"] == 1
    assert len(d["trend"]) == 14 and d["trend"][-1] == {"date": "2026-09-25", "total": 1, "completed": 1}
    assert "hours" not in str(d).lower()
