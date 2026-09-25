import re
from datetime import date

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.exporters.csv_export import export_csv
from app.exporters.pdf_export import export_pdf
from app.exporters.xlsx_export import export_xlsx
from app.models import EntryStatus, User
from app.services.reports import build_report

router = APIRouter(prefix="/api/reports", tags=["reports"])


class ReportParams:
    def __init__(
        self,
        start_date: date,
        end_date: date,
        project_id: int | None = None,
        category_id: int | None = None,
        status: EntryStatus | None = None,
        summary: str | None = Query(None, max_length=6000, description="Optional custom/AI summary to embed"),
    ):
        self.start_date, self.end_date = start_date, end_date
        self.project_id, self.category_id, self.status, self.summary = project_id, category_id, status, summary


def _report(p: ReportParams, user: User, db: Session) -> dict:
    return build_report(db, user, p.start_date, p.end_date, p.project_id, p.category_id, p.status, p.summary)


def _filename(report: dict, ext: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9]+", "-", report["user"]["name"]).strip("-").lower() or "user"
    return f"work-report-{slug}-{report['period']['start']}_to_{report['period']['end']}.{ext}"


def _download(content: bytes, media: str, filename: str) -> Response:
    return Response(content=content, media_type=media,
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("")
def get_report(p: ReportParams = Depends(), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _report(p, user, db)


@router.get("/export/pdf")
def export_report_pdf(p: ReportParams = Depends(), user: User = Depends(get_current_user),
                      db: Session = Depends(get_db)):
    r = _report(p, user, db)
    return _download(export_pdf(r), "application/pdf", _filename(r, "pdf"))


@router.get("/export/xlsx")
def export_report_xlsx(p: ReportParams = Depends(), user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    r = _report(p, user, db)
    return _download(export_xlsx(r), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                     _filename(r, "xlsx"))


@router.get("/export/csv")
def export_report_csv(p: ReportParams = Depends(), user: User = Depends(get_current_user),
                      db: Session = Depends(get_db)):
    r = _report(p, user, db)
    return _download(export_csv(r), "text/csv; charset=utf-8", _filename(r, "csv"))
