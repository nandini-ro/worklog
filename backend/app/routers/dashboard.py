from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import Category, EntryStatus, Project, User, WorkEntry
from app.schemas import WorkEntryOut
from app.services.entries import filtered_entries_query, list_entries

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(today: date | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # The client passes its local "today" so the dashboard matches the user's timezone.
    today = today or date.today()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)
    trend_start = today - timedelta(days=13)
    dist_start = today - timedelta(days=29)

    def n_between(a: date, b: date) -> int:
        return db.scalar(select(func.count(WorkEntry.id)).where(
            WorkEntry.user_id == user.id, WorkEntry.work_date.between(a, b))) or 0

    status_rows = db.execute(
        select(WorkEntry.status, func.count(WorkEntry.id))
        .where(WorkEntry.user_id == user.id, WorkEntry.work_date.between(month_start, today))
        .group_by(WorkEntry.status)
    ).all()
    status_counts = {s.value: 0 for s in EntryStatus} | {s.value: c for s, c in status_rows}

    def latest(st: EntryStatus, limit=6):
        stmt = filtered_entries_query(user, status=st).order_by(WorkEntry.work_date.desc(), WorkEntry.id.desc())
        return [WorkEntryOut.model_validate(e) for e in list_entries(db, stmt.limit(limit))]

    recent = list_entries(db, filtered_entries_query(user).order_by(WorkEntry.updated_at.desc()).limit(8))
    today_entries = list_entries(db, filtered_entries_query(user, today, today).order_by(WorkEntry.created_at))

    by_project = db.execute(
        select(func.coalesce(Project.name, "No project"), func.coalesce(Project.color, "#94a3b8"),
               func.count(WorkEntry.id))
        .select_from(WorkEntry).outerjoin(Project, WorkEntry.project_id == Project.id)
        .where(WorkEntry.user_id == user.id, WorkEntry.work_date.between(dist_start, today))
        .group_by(Project.name, Project.color).order_by(func.count(WorkEntry.id).desc())
    ).all()
    by_category = db.execute(
        select(func.coalesce(Category.name, "Uncategorised"), func.count(WorkEntry.id))
        .select_from(WorkEntry).outerjoin(Category, WorkEntry.category_id == Category.id)
        .where(WorkEntry.user_id == user.id, WorkEntry.work_date.between(dist_start, today))
        .group_by(Category.name).order_by(func.count(WorkEntry.id).desc())
    ).all()
    trend_rows = dict(
        (d, (t, c)) for d, t, c in db.execute(
            select(WorkEntry.work_date, func.count(WorkEntry.id),
                   func.sum(case((WorkEntry.status == EntryStatus.completed, 1), else_=0)))
            .where(WorkEntry.user_id == user.id, WorkEntry.work_date.between(trend_start, today))
            .group_by(WorkEntry.work_date)
        ).all()
    )
    trend = []
    for i in range(14):
        d = trend_start + timedelta(days=i)
        t, c = trend_rows.get(d, (0, 0))
        trend.append({"date": d.isoformat(), "total": t, "completed": c})

    return {
        "today": today.isoformat(),
        "counts": {
            "today": len(today_entries),
            "week": n_between(week_start, week_start + timedelta(days=6)),
            "month": n_between(month_start, today),
        },
        "status_counts": status_counts,
        "today_entries": [WorkEntryOut.model_validate(e) for e in today_entries],
        "in_progress": latest(EntryStatus.in_progress),
        "blocked": latest(EntryStatus.blocked),
        "recent": [WorkEntryOut.model_validate(e) for e in recent],
        "by_project": [{"name": n, "color": c, "count": k} for n, c, k in by_project],
        "by_category": [{"name": n, "count": k} for n, k in by_category],
        "trend": trend,
    }
