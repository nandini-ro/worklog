from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.models import User
from app.schemas import LoginIn, RegisterIn, TokenOut, UserOut, UserUpdate
from app.services.categories import create_default_categories

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _registration_open(db: Session) -> bool:
    return not get_settings().single_user or db.scalar(select(func.count()).select_from(User)) == 0


@router.get("/registration")
def registration_status(db: Session = Depends(get_db)):
    return {"open": _registration_open(db)}


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    if not _registration_open(db):
        raise HTTPException(status_code=403, detail="Registration is closed")
    email = data.email.lower()
    if db.scalar(select(User).where(func.lower(User.email) == email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = User(name=data.name.strip(), email=email, password_hash=hash_password(data.password))
    db.add(user)
    db.flush()
    create_default_categories(db, user)
    db.commit()
    return TokenOut(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(func.lower(User.email) == data.email.lower()))
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return TokenOut(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.put("/me", response_model=UserOut)
def update_me(data: UserUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if data.name is not None:
        user.name = data.name.strip()
    if data.new_password:
        if not data.current_password or not verify_password(data.current_password, user.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        user.password_hash = hash_password(data.new_password)
    db.commit()
    db.refresh(user)
    return user
