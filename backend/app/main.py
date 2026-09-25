from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import ai, auth, categories, dashboard, projects, reports, work_entries

settings = get_settings()
if settings.app_password and settings.jwt_secret == "change-me-in-production":
    raise RuntimeError("Set JWT_SECRET to a long random string when APP_PASSWORD is used")

app = FastAPI(title="WorkLog API", description="Daily work log & reporting — tracks work accomplished, not time.",
              version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

for r in (auth, categories, projects, work_entries, dashboard, reports, ai):
    app.include_router(r.router)


@app.get("/api/health", tags=["health"])
def health():
    return {"status": "ok"}
