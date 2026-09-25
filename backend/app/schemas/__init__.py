from datetime import date, datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.models import EntryStatus, ProjectStatus

T = TypeVar("T")


def _strip_or_none(v: str | None) -> str | None:
    if v is None:
        return None
    v = v.strip()
    return v or None


# ---------- Auth ----------
class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UnlockIn(BaseModel):
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: EmailStr
    created_at: datetime


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    current_password: str | None = None
    new_password: str | None = Field(default=None, min_length=8, max_length=128)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Categories ----------
class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)

    @field_validator("name")
    @classmethod
    def strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name is required")
        return v


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    entry_count: int = 0


# ---------- Projects ----------
class ProjectBase(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    client: str | None = Field(default=None, max_length=150)
    status: ProjectStatus = ProjectStatus.active
    start_date: date | None = None
    end_date: date | None = None
    color: str = Field(default="#6366f1", pattern=r"^#[0-9a-fA-F]{6}$")

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name is required")
        return v

    @field_validator("description", "client")
    @classmethod
    def strip_opt(cls, v: str | None) -> str | None:
        return _strip_or_none(v)

    @model_validator(mode="after")
    def check_dates(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("End date cannot be before start date")
        return self


class ProjectIn(ProjectBase):
    pass


class ProjectOut(ProjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime
    entry_count: int = 0
    completed_count: int = 0
    in_progress_count: int = 0
    blocked_count: int = 0
    last_activity: date | None = None


class ProjectRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    color: str


class CategoryRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str


# ---------- Work entries ----------
class WorkEntryBase(BaseModel):
    work_date: date
    project_id: int | None = None
    category_id: int | None = None
    task_title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    status: EntryStatus = EntryStatus.completed
    notes: str | None = None
    blockers: str | None = None

    @field_validator("task_title")
    @classmethod
    def strip_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Task title is required")
        return v

    @field_validator("description", "notes", "blockers")
    @classmethod
    def strip_opt(cls, v: str | None) -> str | None:
        return _strip_or_none(v)


class WorkEntryIn(WorkEntryBase):
    pass


class WorkEntryOut(WorkEntryBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project: ProjectRef | None = None
    category: CategoryRef | None = None
    created_at: datetime
    updated_at: datetime


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int


class CopyDayIn(BaseModel):
    source_date: date
    target_date: date
    only_unfinished: bool = False


class DuplicateIn(BaseModel):
    work_date: date | None = None


class CalendarDay(BaseModel):
    date: date
    total: int
    completed: int
    in_progress: int
    blocked: int
    planned: int


class RecentMeta(BaseModel):
    projects: list[ProjectRef]
    categories: list[CategoryRef]


# ---------- AI ----------
class ImproveIn(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    task_title: str | None = None
    project: str | None = None


class ImproveOut(BaseModel):
    original: str
    suggestion: str
    provider: str
    warning: str | None = None


class ReportFilterIn(BaseModel):
    start_date: date
    end_date: date
    project_id: int | None = None
    category_id: int | None = None
    status: EntryStatus | None = None


class SummaryOut(BaseModel):
    summary: str
    provider: str
    warning: str | None = None


class AIStatusOut(BaseModel):
    provider: str
    configured: bool
    available_providers: list[str]
