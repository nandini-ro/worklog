"""Seed realistic development data.

Usage:  python -m app.seed            (creates demo@worklog.dev / demo12345 if missing)
        python -m app.seed --reset    (deletes and recreates the demo user's data)
"""
import sys
from datetime import date, timedelta

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import Category, EntryStatus, Project, ProjectStatus, User, WorkEntry
from app.services.categories import create_default_categories

DEMO_EMAIL = "demo@worklog.dev"
DEMO_PASSWORD = "demo12345"

PROJECTS = [
    ("Agent Platform", "Core platform for configuring and running LLM agents.", "Platform Team", "#6366f1"),
    ("MCP Integration", "Model Context Protocol server integration and tooling.", "Integrations", "#0ea5e9"),
    ("Garak Testing", "LLM security testing of agent endpoints using Garak.", "Security", "#f59e0b"),
]

# (days_ago, project, category, title, description, status, notes, blockers)
ENTRIES = [
    (0, "Agent Platform", "Development", "Model API Configuration",
     "Added support for configuring model API credentials through the frontend and tested agent execution.",
     EntryStatus.completed, "Validated configuration with multiple models.", None),
    (0, "MCP Integration", "Testing", "MCP server testing",
     "Tested MCP server connectivity and tool execution.", EntryStatus.completed, None, None),
    (0, "Garak Testing", "Research", "Prepare agent endpoints for security testing",
     "Prepared agent endpoints for future Garak security testing.", EntryStatus.in_progress, None, None),
    (1, "Garak Testing", "Research", "Review Garak integration requirements",
     "Reviewed Garak probes and integration requirements for the agent endpoints.", EntryStatus.completed, None, None),
    (1, "Agent Platform", "Bug Fix", "Fix configuration save issue",
     "Fixed an issue where model configuration changes were not persisted after page reload.",
     EntryStatus.completed, None, None),
    (2, "Agent Platform", "Code Review", "Review runtime PRs",
     "Reviewed pull requests for the agent runtime refactor and left feedback on error handling.",
     EntryStatus.completed, None, None),
    (2, "MCP Integration", "Development", "Tool schema validation",
     "Implemented JSON schema validation for MCP tool inputs.", EntryStatus.completed, None, None),
    (3, "Agent Platform", "Testing", "Agent runtime testing",
     "Ran end-to-end tests of agent execution across providers.", EntryStatus.in_progress,
     "Two providers still pending.", None),
    (3, "MCP Integration", "Deployment", "Deploy MCP server to staging",
     "Attempted deployment of the MCP server to the staging environment.", EntryStatus.blocked, None,
     "Waiting for staging credentials from the DevOps team."),
    (4, "Agent Platform", "Meeting", "Sprint planning",
     "Planned sprint scope for model configuration and runtime stability work.", EntryStatus.completed, None, None),
    (7, "Agent Platform", "Development", "Frontend configuration improvements",
     "Improved validation and error messages on the model configuration form.", EntryStatus.completed, None, None),
    (7, "MCP Integration", "Research", "Evaluate MCP transport options",
     "Compared stdio and HTTP transports for MCP servers.", EntryStatus.completed, None, None),
    (8, "Agent Platform", "Documentation", "Configuration docs",
     "Documented supported model providers and configuration options.", EntryStatus.completed, None, None),
    (9, "Garak Testing", "Learning", "Garak probe overview",
     "Studied Garak probe categories relevant to prompt injection.", EntryStatus.completed, None, None),
    (10, "MCP Integration", "Development", "MCP client wrapper",
     "Built a client wrapper for calling MCP tools from the agent runtime.", EntryStatus.completed, None, None),
    (11, "Agent Platform", "Bug Fix", "Streaming response fix",
     "Fixed truncated streaming responses for long agent outputs.", EntryStatus.completed, None, None),
    (14, "Agent Platform", "Development", "Provider abstraction",
     "Introduced a provider abstraction for model backends.", EntryStatus.completed, None, None),
    (15, "Garak Testing", "Research", "Security testing plan",
     "Drafted the security testing plan for agent endpoints.", EntryStatus.completed, None, None),
    (16, "MCP Integration", "Testing", "Tool execution tests",
     "Added automated tests for MCP tool execution paths.", EntryStatus.completed, None, None),
    (-1, "Garak Testing", "Testing", "Run initial Garak scan",
     "Run the first Garak scan against the staging agent endpoint.", EntryStatus.planned, None, None),
]


def _weekday(d: date) -> date:
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    return d


def seed(reset: bool = False) -> None:
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.email == DEMO_EMAIL))
        if user and not reset:
            print(f"Demo user already exists ({DEMO_EMAIL}); use --reset to recreate.")
            return
        if user:
            db.delete(user)
            db.commit()
        user = User(name="Demo User", email=DEMO_EMAIL, password_hash=hash_password(DEMO_PASSWORD))
        db.add(user)
        db.flush()
        create_default_categories(db, user)
        db.flush()
        cats = {c.name: c.id for c in db.scalars(select(Category).where(Category.user_id == user.id))}

        today = date.today()
        projects = {}
        for name, desc, client, color in PROJECTS:
            p = Project(user_id=user.id, name=name, description=desc, client=client, color=color,
                        status=ProjectStatus.active, start_date=today - timedelta(days=60))
            db.add(p)
            db.flush()
            projects[name] = p.id

        for days_ago, proj, cat, title, desc, status, notes, blockers in ENTRIES:
            d = today - timedelta(days=days_ago) if days_ago <= 0 else _weekday(today - timedelta(days=days_ago))
            db.add(WorkEntry(user_id=user.id, project_id=projects[proj], category_id=cats[cat], work_date=d,
                             task_title=title, description=desc, status=status, notes=notes, blockers=blockers))
        db.commit()
        print(f"Seeded demo data. Login: {DEMO_EMAIL} / {DEMO_PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    seed(reset="--reset" in sys.argv)
