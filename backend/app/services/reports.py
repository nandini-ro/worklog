"""Builds a single structured report used by the JSON API and every exporter."""
from collections import Counter, OrderedDict
from datetime import date, datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.ai.local import local_report_summary
from app.models import EntryStatus, User, WorkEntry
from app.services.entries import filtered_entries_query, list_entries
from app.services.ownership import get_owned_category, get_owned_project

STATUS_LABELS = {
    "planned": "Planned",
    "in_progress": "In Progress",
    "completed": "Completed",
    "blocked": "Blocked",
}


def fmt_date(d: date) -> str:
    return d.strftime("%d %b %Y")


def period_label(start: date, end: date) -> str:
    return fmt_date(start) if start == end else f"{fmt_date(start)} – {fmt_date(end)}"


def entry_dict(e: WorkEntry) -> dict:
    return {
        "id": e.id,
        "date": e.work_date.isoformat(),
        "date_label": fmt_date(e.work_date),
        "project": e.project.name if e.project else None,
        "project_color": e.project.color if e.project else None,
        "category": e.category.name if e.category else None,
        "task_title": e.task_title,
        "description": e.description,
        "status": e.status.value,
        "status_label": STATUS_LABELS[e.status.value],
        "notes": e.notes,
        "blockers": e.blockers,
    }


def fetch_report_entries(
    db: Session,
    user: User,
    start_date: date,
    end_date: date,
    project_id: int | None = None,
    category_id: int | None = None,
    status: EntryStatus | None = None,
) -> list[WorkEntry]:
    if end_date < start_date:
        raise HTTPException(status_code=422, detail="End date cannot be before start date")
    if project_id:
        get_owned_project(db, user, project_id)
    if category_id:
        get_owned_category(db, user, category_id)
    stmt = filtered_entries_query(user, start_date, end_date, project_id, category_id, status)
    stmt = stmt.order_by(WorkEntry.work_date.desc(), WorkEntry.id.asc())
    return list_entries(db, stmt)


def build_report(
    db: Session,
    user: User,
    start_date: date,
    end_date: date,
    project_id: int | None = None,
    category_id: int | None = None,
    status: EntryStatus | None = None,
    summary: str | None = None,
) -> dict:
    entries = fetch_report_entries(db, user, start_date, end_date, project_id, category_id, status)
    items = [entry_dict(e) for e in entries]

    # Daily work, most recent day first, grouped by project within each day.
    days: "OrderedDict[str, OrderedDict[str, dict]]" = OrderedDict()
    for it in items:
        day = days.setdefault(it["date"], OrderedDict())
        key = it["project"] or "General"
        group = day.setdefault(key, {"project": key, "color": it["project_color"], "entries": []})
        group["entries"].append(it)
    daily = [
        {"date": d, "date_label": fmt_date(date.fromisoformat(d)), "groups": list(groups.values())}
        for d, groups in days.items()
    ]

    # Project breakdown
    projects: "OrderedDict[str, dict]" = OrderedDict()
    for it in sorted(items, key=lambda x: (x["project"] or "~").lower()):
        key = it["project"] or "General"
        p = projects.setdefault(
            key,
            {"project": key, "color": it["project_color"], "total": 0, "completed": 0,
             "in_progress": 0, "planned": 0, "blocked": 0, "tasks": []},
        )
        p["total"] += 1
        p[it["status"]] += 1
        if it["task_title"] not in p["tasks"]:
            p["tasks"].append(it["task_title"])

    categories = Counter(it["category"] or "Uncategorised" for it in items)
    status_counts = Counter(it["status"] for it in items)

    completed = [it for it in items if it["status"] == "completed"]
    in_progress = [it for it in items if it["status"] == "in_progress"]
    planned = [it for it in items if it["status"] == "planned"]
    blockers = [it for it in items if it["blockers"] or it["status"] == "blocked"]

    filters = {
        "project": get_owned_project(db, user, project_id).name if project_id else None,
        "category": get_owned_category(db, user, category_id).name if category_id else None,
        "status": STATUS_LABELS[status.value] if status else None,
    }

    report = {
        "title": "Work Report",
        "user": {"name": user.name, "email": user.email},
        "period": {"start": start_date.isoformat(), "end": end_date.isoformat(),
                   "label": period_label(start_date, end_date)},
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "generated_label": fmt_date(date.today()),
        "filters": filters,
        "totals": {
            "entries": len(items),
            "completed": status_counts.get("completed", 0),
            "in_progress": status_counts.get("in_progress", 0),
            "planned": status_counts.get("planned", 0),
            "blocked": status_counts.get("blocked", 0),
            "projects": len(projects),
            "active_days": len(days),
        },
        "daily": daily,
        "completed": completed,
        "in_progress": in_progress,
        "planned": planned,
        "blockers": blockers,
        "project_summary": list(projects.values()),
        "category_summary": [{"category": c, "total": n} for c, n in categories.most_common()],
    }
    report["summary"] = summary.strip() if summary and summary.strip() else local_report_summary(report)
    report["summary_source"] = "custom" if summary and summary.strip() else "auto"
    return report
