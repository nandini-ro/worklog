from datetime import date

from sqlalchemy import Select, asc, desc, func, or_, select
from sqlalchemy.orm import Session

from app.models import Category, EntryStatus, Project, User, WorkEntry

SORT_FIELDS = {
    "work_date": WorkEntry.work_date,
    "task_title": func.lower(WorkEntry.task_title),
    "status": WorkEntry.status,
    "project": func.lower(Project.name),
    "category": func.lower(Category.name),
    "created_at": WorkEntry.created_at,
}


def filtered_entries_query(
    user: User,
    start_date: date | None = None,
    end_date: date | None = None,
    project_id: int | None = None,
    category_id: int | None = None,
    status: EntryStatus | None = None,
    q: str | None = None,
) -> Select:
    stmt = (
        select(WorkEntry)
        .outerjoin(Project, WorkEntry.project_id == Project.id)
        .outerjoin(Category, WorkEntry.category_id == Category.id)
        .where(WorkEntry.user_id == user.id)
    )
    if start_date:
        stmt = stmt.where(WorkEntry.work_date >= start_date)
    if end_date:
        stmt = stmt.where(WorkEntry.work_date <= end_date)
    if project_id:
        stmt = stmt.where(WorkEntry.project_id == project_id)
    if category_id:
        stmt = stmt.where(WorkEntry.category_id == category_id)
    if status:
        stmt = stmt.where(WorkEntry.status == status)
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                WorkEntry.task_title.ilike(like),
                WorkEntry.description.ilike(like),
                WorkEntry.notes.ilike(like),
                WorkEntry.blockers.ilike(like),
                Project.name.ilike(like),
                Category.name.ilike(like),
            )
        )
    return stmt


def apply_sort(stmt: Select, sort: str, order: str) -> Select:
    col = SORT_FIELDS.get(sort, WorkEntry.work_date)
    direction = asc if order == "asc" else desc
    return stmt.order_by(direction(col), direction(WorkEntry.id))


def list_entries(db: Session, stmt: Select) -> list[WorkEntry]:
    return list(db.scalars(stmt).unique().all())


def count(db: Session, stmt: Select) -> int:
    return db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
