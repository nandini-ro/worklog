from sqlalchemy.orm import Session

from app.models import DEFAULT_CATEGORIES, Category, User


def create_default_categories(db: Session, user: User) -> None:
    for name in DEFAULT_CATEGORIES:
        db.add(Category(user_id=user.id, name=name))
