from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.ai import AIService, get_ai_service
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User
from app.schemas import AIStatusOut, ImproveIn, ImproveOut, ReportFilterIn, SummaryOut
from app.services.reports import build_report

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.get("/status", response_model=AIStatusOut)
def ai_status(_: User = Depends(get_current_user), ai: AIService = Depends(get_ai_service)):
    return AIStatusOut(provider=ai.provider_name, configured=ai.provider is not None,
                       available_providers=["openai", "groq", "gemini", "local"])


@router.post("/improve-description", response_model=ImproveOut)
def improve_description(data: ImproveIn, _: User = Depends(get_current_user),
                        ai: AIService = Depends(get_ai_service)):
    # Returns a suggestion only; the client decides whether to accept it. Nothing is saved here.
    suggestion, provider, warning = ai.improve_description(data.text, data.task_title, data.project)
    return ImproveOut(original=data.text, suggestion=suggestion, provider=provider, warning=warning)


@router.post("/generate-report-summary", response_model=SummaryOut)
def generate_report_summary(data: ReportFilterIn, user: User = Depends(get_current_user),
                            db: Session = Depends(get_db), ai: AIService = Depends(get_ai_service)):
    report = build_report(db, user, data.start_date, data.end_date, data.project_id, data.category_id, data.status)
    summary, provider, warning = ai.report_summary(report)
    return SummaryOut(summary=summary, provider=provider, warning=warning)
