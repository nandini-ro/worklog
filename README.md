# WorkLog — Daily Work Log & Reports

Record **what you worked on** each day and turn it into a professional report for any timeframe, in seconds.

> This is **not** an hourly timesheet. There are no hours, durations, start/end times or billable rates anywhere —
> not in the database, the API, the UI or the exports. The question it answers is *"What did I work on?"*.

```
Login → Dashboard → Add Daily Work → View/Edit Previous Work → Select Date Range → Generate Report → Export (PDF / XLSX / CSV)
```

---

## Contents
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Quick start with Docker](#quick-start-with-docker)
- [Running locally (without Docker)](#running-locally-without-docker)
- [Environment variables](#environment-variables)
- [Database & Alembic migrations](#database--alembic-migrations)
- [Seed data](#seed-data)
- [Testing](#testing)
- [Features](#features)
- [Report generation](#report-generation)
- [AI features](#ai-features)
- [API reference](#api-reference)
- [Security](#security)
- [Project structure](#project-structure)

---

## Architecture

```
┌──────────────────────────┐     fetch + Bearer JWT      ┌──────────────────────────────────────────┐
│  Next.js (App Router)    │ ──────────────────────────▶ │  FastAPI                                 │
│  TypeScript + Tailwind   │ ◀────────── JSON / files ── │  routers → services → SQLAlchemy ORM     │
│  :3000                   │                             │  ├─ auth (bcrypt + JWT)                  │
└──────────────────────────┘                             │  ├─ reports service (single report model)│
                                                         │  │    ├─ PDF  (reportlab)                │
                                                         │  │    ├─ XLSX (openpyxl)                 │
                                                         │  │    └─ CSV                             │
                                                         │  └─ ai/ provider abstraction             │
                                                         │       OpenAI | Groq | Gemini | Local     │
                                                         │  :8000                                   │
                                                         └───────────────────┬──────────────────────┘
                                                                             │ psycopg 3
                                                                   ┌─────────▼─────────┐
                                                                   │  PostgreSQL 16    │
                                                                   └───────────────────┘
```

- The **frontend** is a client-rendered SPA on Next.js. It only talks to the FastAPI backend over REST, and stores the JWT in `localStorage`.
- The **backend** takes the user's identity **only from the JWT**, and every query is scoped to that user.
- **Reports** are built once, as a single structured object, by `app/services/reports.py`. The JSON preview and all three exporters render that same object, so what you preview is what you export.
- **AI** is optional. `app/ai/` defines an `AIProvider` interface with OpenAI, Groq (OpenAI-compatible) and Gemini implementations. When no key is configured, or a provider call fails, it falls back to a deterministic **local** provider.

## Tech stack

| Layer    | Technology |
|----------|------------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, lucide-react |
| Backend  | Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic v2, Alembic, psycopg 3 |
| Auth     | Email/password, bcrypt hashing, JWT (PyJWT, HS256) |
| Exports  | reportlab (PDF), openpyxl (XLSX), csv |
| Database | PostgreSQL 16 |
| Deploy   | Docker, docker-compose |

---

## Quick start with Docker

```bash
cp .env.example .env          # optional: set JWT_SECRET, AI keys
docker compose up --build
```

- Frontend: http://localhost:3000
- API docs (Swagger): http://localhost:8000/docs
- Demo login (seeded because `SEED_DEMO=true`): **demo@worklog.dev / demo12345**

The backend container runs `alembic upgrade head` on every start and then seeds the demo user if one doesn't exist yet. Compose publishes PostgreSQL on host port **5433**, so it won't collide with a local PostgreSQL on 5432.

> `NEXT_PUBLIC_API_URL` is baked into the frontend bundle at build time. It defaults to `http://localhost:8000`. If you deploy elsewhere, change the build arg in `docker-compose.yml`.

---

## Running locally (without Docker)

### 1. PostgreSQL setup

Install PostgreSQL 16, for example with `brew install postgresql@16 && brew services start postgresql@16`. Then create the databases:

```bash
createdb worklog          # application database
createdb worklog_test     # used by the test suite
```

Or, with a dedicated role:

```sql
CREATE ROLE worklog WITH LOGIN PASSWORD 'worklog';
CREATE DATABASE worklog OWNER worklog;
CREATE DATABASE worklog_test OWNER worklog;
```

### 2. Backend setup

```bash
cd backend
python3.12 -m venv .venv && source .venv/bin/activate      # or: uv venv --python 3.12 .venv
pip install -r requirements-dev.txt
cp .env.example .env        # then edit DATABASE_URL / JWT_SECRET
alembic upgrade head        # create tables
python -m app.seed          # optional demo data
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env.local  # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                 # http://localhost:3000
```

For a production build, run `npm run build && npm start`.

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://localhost:5432/worklog` | SQLAlchemy URL (psycopg 3 driver) |
| `JWT_SECRET` | `change-me-in-production` | **Required in production.** A long random string |
| `JWT_EXPIRE_MINUTES` | `10080` (7 days) | Token lifetime |
| `CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated list of allowed frontend origins |
| `AI_PROVIDER` | `auto` | `auto` \| `openai` \| `groq` \| `gemini` \| `local` |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | – / `gpt-4o-mini` | OpenAI provider |
| `GROQ_API_KEY` / `GROQ_MODEL` | – / `llama-3.3-70b-versatile` | Groq provider |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | – / `gemini-2.0-flash` | Google Gemini provider |
| `AI_TIMEOUT_SECONDS` | `30` | Provider request timeout |
| `SEED_DEMO` | `false` | Docker only: seed the demo user on startup |

To generate a secret, run `python -c "import secrets; print(secrets.token_urlsafe(48))"`.

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend URL as seen from the browser |

AI keys and the JWT secret exist **only** on the backend. The frontend never sees them.

---

## Database & Alembic migrations

Schema (no time-tracking columns by design):

| Table | Columns |
|---|---|
| `users` | id, name, email (unique), password_hash, created_at, updated_at |
| `projects` | id, user_id → users (cascade), name, description, client, status (`active`/`on_hold`/`completed`/`archived`), start_date, end_date, color, created_at, updated_at · unique (user_id, name) |
| `categories` | id, user_id → users (cascade), name, created_at · unique (user_id, name) |
| `work_entries` | id, user_id → users (cascade), project_id → projects (SET NULL), category_id → categories (SET NULL), work_date, task_title, description, status (`planned`/`in_progress`/`completed`/`blocked`), notes, blockers, created_at, updated_at · index (user_id, work_date) |

Both status columns are enforced with CHECK constraints. When a user registers, the ten default categories are created for them: Development, Testing, Research, Documentation, Meeting, Bug Fix, Code Review, Deployment, Learning, Other. Deleting a project or category keeps its work entries and simply unlinks them.

```bash
cd backend
alembic upgrade head                               # apply migrations
alembic downgrade -1                               # roll back one
alembic revision --autogenerate -m "describe change"  # after editing app/models
alembic check                                      # verify models and migrations are in sync
```

## Seed data

```bash
python -m app.seed          # creates demo@worklog.dev / demo12345 if missing
python -m app.seed --reset  # recreate the demo user's data
```

The seed creates the projects **Agent Platform**, **MCP Integration** and **Garak Testing**. It adds about 20 realistic entries spread over the last three weeks, relative to today. They cover every status and include a blocker and a planned item.

---

## Testing

Backend tests (pytest, running against a real PostgreSQL database `worklog_test`):

```bash
cd backend
TEST_DATABASE_URL=postgresql+psycopg://localhost:5432/worklog_test pytest
```

There are 34 tests, covering:

| Area | File |
|---|---|
| Authentication (register, login, me, bad token, password change) | `tests/test_auth.py` |
| Project CRUD, validation, stats, delete keeps entries | `tests/test_projects.py` |
| Work entry CRUD, multiple per day, date / status / project / category filters, search, sort, pagination, duplicate, copy day, calendar, dashboard | `tests/test_work_entries.py` |
| User isolation (reads, writes, cross-user references, reports, exports) | `tests/test_isolation.py` |
| Report generation, filters, custom summary, PDF / XLSX / CSV exports | `tests/test_reports.py` |
| AI endpoints, local fallback, provider failure fallback | `tests/test_ai.py` |

Frontend checks:

```bash
cd frontend
npx tsc --noEmit && npm run lint && npm run build
```

---

## Features

- **Dashboard**
  - Counts for today, this week and this month.
  - Completed, in-progress and blocked counts.
  - Today's entries, recent activity, and in-progress and blocked lists.
  - Work by project and by category over 30 days.
  - A 14-day activity trend.
  - A prominent **+ Add Today's Work** button.
- **Daily Work (quick entry)**
  - The date defaults to today, and you can step between days with the prev/next buttons.
  - Recently used projects and categories appear as one-click chips, and the last project and category are remembered.
  - **Save & Add Another** (<kbd>Ctrl/⌘</kbd>+<kbd>Enter</kbd>) and **Save & Close** (<kbd>Ctrl/⌘</kbd>+<kbd>Shift</kbd>+<kbd>Enter</kbd>).
  - Create a project inline without leaving the form.
  - Duplicate an entry, or **Copy previous day**, either all entries or only unfinished ones.
  - Press <kbd>N</kbd> anywhere to jump to today's log.
- **History**
  - Search, sortable columns and pagination.
  - Filters for from/to date, project, category and status.
  - Edit, duplicate to today, and delete (with confirmation).
- **Calendar**
  - A month grid showing entry, completed, in-progress and blocked counts per day.
  - Click a day to see its entries, or add an entry for that date.
- **Projects**
  - Create, edit, archive and delete projects, with a color tag.
  - Each project has a detail page with stats, recent activity, completed and in-progress tasks, the last activity date, and a one-click report.
- **Reports**: see below.
- **Settings**
  - Profile and password.
  - Light, dark or system theme.
  - Manage categories.
  - AI provider status.
- **Interface**
  - Light and dark mode, and a responsive layout.
  - Toast notifications, loading states, empty states and confirmation dialogs.

## Report generation

1. Open **Reports** and pick a timeframe: **Today, Yesterday, This Week, Last Week, This Month, Last Month**, or **Custom Range** (from/to). Weeks start on Monday.
2. Optionally filter by **project**, **category** and **status**.
3. Click **Generate Report**. The preview shows:
   - Header: user name, period, generated date and active filters.
   - Key figures: work items, completed, in progress, blocked and projects. These are counts, never time.
   - **Summary**: generated automatically. Click **Generate AI Report Summary** for an AI version you can accept, reject or edit.
   - **Daily Work**: grouped by date (newest first), then by project.
   - **In Progress** (including planned items), **Blockers** and **Project Summary**.
4. Export as **PDF** (formatted to send directly to a manager), **Excel** (sheets: Summary, Daily Work, Projects, Blockers) or **CSV** (one row per entry). If you accepted an AI summary, the exports include it.

You can also call the API directly:

```bash
GET /api/reports?start_date=2026-09-21&end_date=2026-09-25&project_id=1&status=completed
GET /api/reports/export/pdf?start_date=2026-09-21&end_date=2026-09-25&summary=Optional%20custom%20summary
```

## AI features

- **Improve Description with AI** (entry form). This sends the description to `POST /api/ai/improve-description` and shows **Original** and **AI Suggestion** side by side, with **Accept**, **Reject** and **Edit** buttons. The suggestion **never** overwrites your text automatically. Even after you accept, nothing is saved until you save the entry.
- **Generate AI Report Summary** (reports). The backend loads *your* entries for the selected timeframe and filters, and asks the provider for a professional summary paragraph.
- **Providers**: set `AI_PROVIDER` and the matching key. To add a new provider:
  1. Subclass `AIProvider` in `backend/app/ai/providers.py`.
  2. Register it in `build_provider()` in `backend/app/ai/service.py`.
- **No key?** Everything still works. The local provider tidies the text (capitalization, acronyms such as API/MCP/JWT, punctuation) and writes a summary built from templates. The UI labels its output as a basic offline rewrite.

## API reference

Interactive docs are served at `http://localhost:8000/docs`. Every endpoint except register and login needs `Authorization: Bearer <token>`.

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register` | `{name, email, password}` → token + user |
| POST | `/api/auth/login` | `{email, password}` → token + user |
| GET / PUT | `/api/auth/me` | Current user / update name or password |
| GET | `/api/work-entries` | `start_date, end_date, project_id, category_id, status, q, sort, order, page, page_size` |
| POST | `/api/work-entries` | Create |
| GET / PUT / DELETE | `/api/work-entries/{id}` | Read / update / delete |
| GET | `/api/work-entries/day/{date}` | All entries for a date |
| POST | `/api/work-entries/{id}/duplicate` | Optional `{work_date}` |
| POST | `/api/work-entries/copy-day` | `{source_date, target_date, only_unfinished}` |
| GET | `/api/work-entries/calendar` | `year, month` → per-day status counts |
| GET | `/api/work-entries/recent-meta` | Recently used projects and categories |
| GET / POST | `/api/projects` | List (with stats, optional `status`) / create |
| GET / PUT / DELETE | `/api/projects/{id}` | |
| GET / POST / PUT / DELETE | `/api/categories[/{id}]` | Manage categories |
| GET | `/api/dashboard` | `today` (client-local date) |
| GET | `/api/reports` | `start_date, end_date, project_id, category_id, status, summary` |
| GET | `/api/reports/export/{pdf,xlsx,csv}` | Same parameters; returns a file download |
| POST | `/api/ai/improve-description` | `{text, task_title?, project?}` → `{original, suggestion, provider}` |
| POST | `/api/ai/generate-report-summary` | `{start_date, end_date, project_id?, category_id?, status?}` |
| GET | `/api/ai/status` | Active provider |

## Security

- Passwords are hashed with **bcrypt**, and JWTs are signed with a server-side secret.
- The user is always resolved from the token (`get_current_user`). Any `user_id` sent by the client is ignored.
- Every query is filtered by `user_id`. Records owned by other users return **404**, so the API doesn't reveal that they exist.
- Project and category references on entries are validated for ownership. A reference to someone else's project returns 422.
- AI keys and the JWT secret live only in the backend environment. CORS is restricted to the configured origins.

## Project structure

```
.
├── docker-compose.yml
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI app, CORS, routers
│   │   ├── core/                  # config, database, security (bcrypt/JWT), auth dependency
│   │   ├── models/                # SQLAlchemy models (no time fields)
│   │   ├── schemas/               # Pydantic request/response models
│   │   ├── routers/               # auth, projects, categories, work_entries, dashboard, reports, ai
│   │   ├── services/              # ownership checks, entry queries, report builder
│   │   ├── exporters/             # pdf_export, xlsx_export, csv_export
│   │   ├── ai/                    # AIProvider base, OpenAI/Groq/Gemini, local fallback, service
│   │   └── seed.py
│   ├── alembic/                   # migrations
│   ├── tests/                     # pytest suite
│   ├── Dockerfile, docker-entrypoint.sh
│   └── requirements*.txt
└── frontend/
    ├── src/app/
    │   ├── login/, register/
    │   └── (app)/                 # authenticated shell with sidebar
    │       ├── dashboard/  daily/  history/  calendar/
    │       ├── projects/ and projects/[id]/
    │       └── reports/  settings/
    ├── src/components/            # app shell, providers (auth/toast/confirm/theme), entry form, modals, charts, UI kit
    ├── src/lib/                   # API client, types, date helpers, hooks
    └── Dockerfile
```
