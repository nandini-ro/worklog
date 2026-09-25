from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import case, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import EntryStatus, Project, ProjectStatus, User, WorkEntry
from app.schemas import ProjectIn, ProjectOut
from app.services.ownership import get_owned_project

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _stats_query(user: User):
    def n(st: EntryStatus):
        return func.coalesce(func.sum(case((WorkEntry.status == st, 1), else_=0)), 0)

    return (
        select(
            Project,
            func.count(WorkEntry.id),
            n(EntryStatus.completed),
            n(EntryStatus.in_progress),
            n(EntryStatus.blocked),
            func.max(WorkEntry.work_date),
        )
        .outerjoin(WorkEntry, (WorkEntry.project_id == Project.id) & (WorkEntry.user_id == user.id))
        .where(Project.user_id == user.id)
        .group_by(Project.id)
    )


def _out(row) -> ProjectOut:
    p, total, done, prog, blocked, last = row
    out = ProjectOut.model_validate(p)
    out.entry_count, out.completed_count, out.in_progress_count = total, done, prog
    out.blocked_count, out.last_activity = blocked, last
    return out


@router.get("", response_model=list[ProjectOut])
def list_projects(
    status: ProjectStatus | None = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = _stats_query(user)
    if status:
        stmt = stmt.where(Project.status == status)
    stmt = stmt.order_by(
        case((Project.status == ProjectStatus.active, 0), (Project.status == ProjectStatus.on_hold, 1),
             (Project.status == ProjectStatus.completed, 2), else_=3),
        func.lower(Project.name),
    )
    return [_out(r) for r in db.execute(stmt).all()]


def _commit(db: Session):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A project with this name already exists")


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(data: ProjectIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = Project(user_id=user.id, **data.model_dump())
    db.add(p)
    _commit(db)
    return _out(db.execute(_stats_query(user).where(Project.id == p.id)).one())


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    get_owned_project(db, user, project_id)
    return _out(db.execute(_stats_query(user).where(Project.id == project_id)).one())


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, data: ProjectIn, user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    p = get_owned_project(db, user, project_id)
    for k, v in data.model_dump().items():
        setattr(p, k, v)
    _commit(db)
    return _out(db.execute(_stats_query(user).where(Project.id == project_id)).one())


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Work entries are kept; their project reference is cleared (ON DELETE SET NULL).
    db.delete(get_owned_project(db, user, project_id))
    db.commit()
    return Response(status_code=204)
