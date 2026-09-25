import secrets

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import decode_access_token, hash_password
from app.models import User
from app.services.categories import create_default_categories

bearer = HTTPBearer(auto_error=False)


def get_owner(db: Session) -> User:
    """Personal mode: the oldest account is the owner; create one on first use."""
    user = db.scalar(select(User).order_by(User.id).limit(1))
    if user is None:
        user = User(name="Me", email="me@worklog.dev", password_hash=hash_password(secrets.token_urlsafe(32)))
        db.add(user)
        db.flush()
        create_default_categories(db, user)
        db.commit()
    return user


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    """The authenticated user is the only source of user identity — never trust a client-sent user_id."""
    if get_settings().single_user:
        return get_owner(db)
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if creds is None:
        raise unauthorized
    user_id = decode_access_token(creds.credentials)
    if user_id is None:
        raise unauthorized
    user = db.get(User, user_id)
    if user is None:
        raise unauthorized
    return user
