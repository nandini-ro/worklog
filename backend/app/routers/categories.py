from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import Category, User, WorkEntry
from app.schemas import CategoryIn, CategoryOut
from app.services.ownership import get_owned_category

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.execute(
        select(Category, func.count(WorkEntry.id))
        .outerjoin(WorkEntry, (WorkEntry.category_id == Category.id) & (WorkEntry.user_id == user.id))
        .where(Category.user_id == user.id)
        .group_by(Category.id)
        .order_by(Category.id)
    ).all()
    return [CategoryOut(id=c.id, name=c.name, entry_count=n) for c, n in rows]


def _save(db: Session, cat: Category) -> CategoryOut:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A category with this name already exists")
    db.refresh(cat)
    return CategoryOut(id=cat.id, name=cat.name)


@router.post("", response_model=CategoryOut, status_code=201)
def create_category(data: CategoryIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cat = Category(user_id=user.id, name=data.name)
    db.add(cat)
    return _save(db, cat)


@router.put("/{category_id}", response_model=CategoryOut)
def update_category(category_id: int, data: CategoryIn, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    cat = get_owned_category(db, user, category_id)
    cat.name = data.name
    return _save(db, cat)


@router.delete("/{category_id}", status_code=204)
def delete_category(category_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(get_owned_category(db, user, category_id))
    db.commit()
    return Response(status_code=204)
