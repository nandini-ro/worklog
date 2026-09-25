import calendar
import math
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import Category, EntryStatus, Project, User, WorkEntry
from app.schemas import (CalendarDay, CategoryRef, CopyDayIn, DuplicateIn, Page, ProjectRef, RecentMeta, WorkEntryIn,
                         WorkEntryOut)
from app.services.entries import apply_sort, count, filtered_entries_query, list_entries
from app.services.ownership import get_owned_entry, validate_refs

router = APIRouter(prefix="/api/work-entries", tags=["work-entries"])

COPY_FIELDS = ("project_id", "category_id", "task_title", "description", "status", "notes", "blockers")


@router.get("", response_model=Page[WorkEntryOut])
def list_work_entries(
    start_date: date | None = None,
    end_date: date | None = None,
    project_id: int | None = None,
    category_id: int | None = None,
    status: EntryStatus | None = None,
    q: str | None = Query(None, max_length=200),
    sort: str = Query("work_date"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = filtered_entries_query(user, start_date, end_date, project_id, category_id, status, q)
    total = count(db, stmt)
    items = list_entries(db, apply_sort(stmt, sort, order).offset((page - 1) * page_size).limit(page_size))
    return Page[WorkEntryOut](items=items, total=total, page=page, page_size=page_size,
                              pages=max(1, math.ceil(total / page_size)))


@router.get("/day/{work_date}", response_model=list[WorkEntryOut])
def entries_for_day(work_date: date, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stmt = filtered_entries_query(user, work_date, work_date).order_by(WorkEntry.created_at, WorkEntry.id)
    return list_entries(db, stmt)


@router.get("/calendar", response_model=list[CalendarDay])
def calendar_summary(
    year: int = Query(..., ge=1970, le=2200),
    month: int = Query(..., ge=1, le=12),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    first = date(year, month, 1)
    last = date(year, month, calendar.monthrange(year, month)[1])

    def n(st: EntryStatus):
        return func.sum(case((WorkEntry.status == st, 1), else_=0))

    rows = db.execute(
        select(WorkEntry.work_date, func.count(WorkEntry.id), n(EntryStatus.completed), n(EntryStatus.in_progress),
               n(EntryStatus.blocked), n(EntryStatus.planned))
        .where(WorkEntry.user_id == user.id, WorkEntry.work_date.between(first, last))
        .group_by(WorkEntry.work_date)
        .order_by(WorkEntry.work_date)
    ).all()
    return [CalendarDay(date=d, total=t, completed=c, in_progress=p, blocked=b, planned=pl)
            for d, t, c, p, b, pl in rows]


@router.get("/recent-meta", response_model=RecentMeta)
def recent_meta(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Recently used projects/categories, most recent first — powers the quick-entry form."""
    proj = db.execute(
        select(Project, func.max(WorkEntry.created_at).label("last"))
        .join(WorkEntry, WorkEntry.project_id == Project.id)
        .where(Project.user_id == user.id, WorkEntry.user_id == user.id)
        .group_by(Project.id).order_by(func.max(WorkEntry.created_at).desc()).limit(6)
    ).all()
    cats = db.execute(
        select(Category, func.max(WorkEntry.created_at))
        .join(WorkEntry, WorkEntry.category_id == Category.id)
        .where(Category.user_id == user.id, WorkEntry.user_id == user.id)
        .group_by(Category.id).order_by(func.max(WorkEntry.created_at).desc()).limit(6)
    ).all()
    return RecentMeta(
        projects=[ProjectRef.model_validate(p) for p, _ in proj],
        categories=[CategoryRef.model_validate(c) for c, _ in cats],
    )


@router.post("/copy-day", response_model=list[WorkEntryOut], status_code=201)
def copy_day(data: CopyDayIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if data.source_date == data.target_date:
        raise HTTPException(status_code=422, detail="Source and target dates must differ")
    source = list_entries(db, filtered_entries_query(user, data.source_date, data.source_date)
                          .order_by(WorkEntry.created_at, WorkEntry.id))
    if data.only_unfinished:
        source = [e for e in source if e.status != EntryStatus.completed]
    if not source:
        raise HTTPException(status_code=404, detail="No entries to copy for that date")
    new = [WorkEntry(user_id=user.id, work_date=data.target_date, **{f: getattr(e, f) for f in COPY_FIELDS})
           for e in source]
    db.add_all(new)
    db.commit()
    ids = [e.id for e in new]
    return list_entries(db, select(WorkEntry).where(WorkEntry.id.in_(ids)).order_by(WorkEntry.id))


@router.post("", response_model=WorkEntryOut, status_code=201)
def create_entry(data: WorkEntryIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    validate_refs(db, user, data.project_id, data.category_id)
    e = WorkEntry(user_id=user.id, **data.model_dump())
    db.add(e)
    db.commit()
    return get_owned_entry(db, user, e.id)


@router.get("/{entry_id}", response_model=WorkEntryOut)
def get_entry(entry_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_owned_entry(db, user, entry_id)


@router.put("/{entry_id}", response_model=WorkEntryOut)
def update_entry(entry_id: int, data: WorkEntryIn, user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    e = get_owned_entry(db, user, entry_id)
    validate_refs(db, user, data.project_id, data.category_id)
    for k, v in data.model_dump().items():
        setattr(e, k, v)
    db.commit()
    db.expire(e)
    return get_owned_entry(db, user, entry_id)


@router.post("/{entry_id}/duplicate", response_model=WorkEntryOut, status_code=201)
def duplicate_entry(entry_id: int, data: DuplicateIn | None = None, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    src = get_owned_entry(db, user, entry_id)
    e = WorkEntry(user_id=user.id, work_date=(data.work_date if data and data.work_date else src.work_date),
                  **{f: getattr(src, f) for f in COPY_FIELDS})
    db.add(e)
    db.commit()
    return get_owned_entry(db, user, e.id)


@router.delete("/{entry_id}", status_code=204)
def delete_entry(entry_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(get_owned_entry(db, user, entry_id))
    db.commit()
    return Response(status_code=204)
