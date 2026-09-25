import enum
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Index, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

# NOTE: This is a work log, not a timesheet. There are intentionally no hours/duration/time fields.


class EntryStatus(str, enum.Enum):
    planned = "planned"
    in_progress = "in_progress"
    completed = "completed"
    blocked = "blocked"


class ProjectStatus(str, enum.Enum):
    active = "active"
    on_hold = "on_hold"
    completed = "completed"
    archived = "archived"


DEFAULT_CATEGORIES = [
    "Development",
    "Testing",
    "Research",
    "Documentation",
    "Meeting",
    "Bug Fix",
    "Code Review",
    "Deployment",
    "Learning",
    "Other",
]


def _enum(e: type[enum.Enum], name: str) -> Enum:
    return Enum(e, name=name, native_enum=False, create_constraint=True, length=20, validate_strings=True,
                values_callable=lambda x: [m.value for m in x])


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_projects_user_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text)
    client: Mapped[str | None] = mapped_column(String(150))
    status: Mapped[ProjectStatus] = mapped_column(_enum(ProjectStatus, "project_status"), default=ProjectStatus.active)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    color: Mapped[str] = mapped_column(String(20), default="#6366f1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_categories_user_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WorkEntry(Base):
    __tablename__ = "work_entries"
    __table_args__ = (Index("ix_work_entries_user_date", "user_id", "work_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"), index=True)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"), index=True)
    work_date: Mapped[date] = mapped_column(Date)
    task_title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[EntryStatus] = mapped_column(_enum(EntryStatus, "entry_status"), default=EntryStatus.completed)
    notes: Mapped[str | None] = mapped_column(Text)
    blockers: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    project: Mapped[Project | None] = relationship(lazy="joined")
    category: Mapped[Category | None] = relationship(lazy="joined")
