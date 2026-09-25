from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Category, Project, User, WorkEntry


def _not_found(what: str) -> HTTPException:
    # 404 (not 403) so we never reveal that another user's record exists.
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{what} not found")


def get_owned_project(db: Session, user: User, project_id: int) -> Project:
    p = db.scalar(select(Project).where(Project.id == project_id, Project.user_id == user.id))
    if p is None:
        raise _not_found("Project")
    return p


def get_owned_category(db: Session, user: User, category_id: int) -> Category:
    c = db.scalar(select(Category).where(Category.id == category_id, Category.user_id == user.id))
    if c is None:
        raise _not_found("Category")
    return c


def get_owned_entry(db: Session, user: User, entry_id: int) -> WorkEntry:
    e = db.scalar(select(WorkEntry).where(WorkEntry.id == entry_id, WorkEntry.user_id == user.id))
    if e is None:
        raise _not_found("Work entry")
    return e


def validate_refs(db: Session, user: User, project_id: int | None, category_id: int | None) -> None:
    """Reject references to projects/categories the user does not own."""
    if project_id is not None:
        try:
            get_owned_project(db, user, project_id)
        except HTTPException:
            raise HTTPException(status_code=422, detail="Invalid project")
    if category_id is not None:
        try:
            get_owned_category(db, user, category_id)
        except HTTPException:
            raise HTTPException(status_code=422, detail="Invalid category")
