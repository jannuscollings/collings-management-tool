# Collings-Ticketing

A clean full-stack **monorepo** matching the stack the Collings CRM runs on:
a Django backend and a React frontend in one repository. Hand this to a developer
and they have a working, deployable app with auth in a few minutes.

```
Collings-Ticketing/
├── backend/     Django + DRF + Channels + Celery
├── frontend/    React (CRA) + Tailwind + Redux
├── scripts/     setup.sh, dev.sh
├── Makefile     make setup / make dev / ...
└── docker-compose.yml   Postgres + Redis (optional)
```

## Get running (2 commands)

```bash
./scripts/setup.sh     # one-time: installs backend + frontend, sets up .env + DB
./scripts/dev.sh       # runs BOTH — backend :8000 and frontend :3000 (Ctrl-C stops both)
```

Prefer `make` or `npm`? These do the same thing:

```bash
make setup   &&  make dev
npm run setup && npm run dev
```

Then create an admin login and open the app:

```bash
cd backend && source .venv/bin/activate && python manage.py createsuperuser
# open http://localhost:3000  and sign in
```

> Requirements: Python 3.12, Node 20+, npm. No database needed for the first run
> (the backend falls back to SQLite). Docker is optional (see step 3 below).

## Stack

**Backend** (`backend/`)
- Django 5 + Django REST Framework
- JWT auth (`djangorestframework-simplejwt`) with an email-login custom user
- Channels + Daphne (ASGI: HTTP + WebSocket from one process)
- Celery + Redis (worker + beat)
- Postgres via `DATABASE_URL` (SQLite fallback for first run)
- WhiteNoise static, optional S3 media, optional Sentry
- `drf-yasg` Swagger at `/swagger/`
- Heroku-ready: `Procfile`, `runtime.txt`, `app.json`

**Frontend** (`frontend/`)
- React 18 (Create React App / `react-scripts` 5)
- Tailwind CSS 3 (class-based dark mode) + Radix UI + `lucide-react`
- Redux Toolkit + React Redux
- React Router v6
- Axios client with CSRF + JWT and single-flight refresh-on-401
- `react-hot-toast`
- Heroku-ready: `Procfile` (`serve`), `heroku-postbuild`

## Manual setup (what the scripts do, step by step)

You don't need this if you ran `./scripts/setup.sh` — it's here so you understand
what's happening and can run each piece on its own.

### 1. Backend
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # edit SECRET_KEY at minimum
python manage.py migrate        # SQLite by default, no DB needed to start
python manage.py createsuperuser
python manage.py runserver      # http://localhost:8000  (ASGI via runserver)
```
API: `GET /api/health/`, auth under `/api/auth/` (`register`, `login`, `refresh`,
`me`, `csrf`), Swagger at `/swagger/`, admin at `/admin/`.

### 2. Frontend
```bash
cd frontend
npm install
cp .env.example .env            # REACT_APP_API_URL=http://localhost:8000
npm start                       # http://localhost:3000
```
Register a user (via `/admin/`, `createsuperuser`, or POST `/api/auth/register/`),
then sign in at `/login`.

### 3. Optional: Postgres + Redis + Celery (prod-like)
```bash
docker compose up -d                       # Postgres + Redis
# in backend/.env set:
#   DATABASE_URL=postgres://boilerplate:boilerplate@localhost:5432/boilerplate
#   REDIS_URL=redis://localhost:6379/0
python manage.py migrate
celery -A config worker -l info            # separate terminal
celery -A config beat   -l info            # separate terminal
```

## Deploying to Heroku
Each app deploys independently (same as the Collings repos).

- **Backend**: Python buildpack. Add `heroku-postgresql` + `heroku-redis`. Set
  `SECRET_KEY`, `DEBUG=false`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`,
  `CSRF_TRUSTED_ORIGINS`. `Procfile` runs `web` (daphne) + `worker` + `beat`, and
  the `release` phase migrates + collects static. `app.json` captures this.
- **Frontend**: Node buildpack. Set `REACT_APP_API_URL` to the backend URL.
  `heroku-postbuild` builds; `Procfile` serves the static build with `serve`.

## Layout
```
backend/
  config/        settings, urls, asgi, wsgi, celery
  accounts/      custom User + JWT auth endpoints
  core/          health check + sample Celery task
frontend/
  src/api/       axios instance (CSRF + JWT refresh) + auth calls
  src/store/     Redux Toolkit store + authSlice
  src/contexts/  ThemeContext (dark mode)
  src/components/ ProtectedRoute
  src/pages/     Login, Dashboard
```

## What to build on top
- Add apps under `backend/` and register them in `INSTALLED_APPS`.
- Add slices under `frontend/src/store/slices/` and API modules under `src/api/`.
- Add websocket consumers and wire them in `config/asgi.py`.
- Add scheduled jobs with `django-celery-beat` (admin) or `@shared_task`.
