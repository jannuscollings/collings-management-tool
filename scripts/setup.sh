#!/usr/bin/env bash
#
# One-time setup: backend virtualenv + deps + DB, and frontend deps.
# Safe to re-run — it won't clobber an existing .env.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BE="$ROOT/backend"
FE="$ROOT/frontend"

echo "==> Backend setup ($BE)"
cd "$BE"
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install --upgrade pip >/dev/null
pip install -r requirements.txt

if [ ! -f .env ]; then
  cp .env.example .env
  # Give the newbie a real SECRET_KEY so nothing runs on the insecure fallback.
  key="$(python -c 'import secrets; print(secrets.token_urlsafe(50))')"
  sed -i.bak "s|^SECRET_KEY=.*|SECRET_KEY=${key}|" .env && rm -f .env.bak
  echo "    created backend/.env with a generated SECRET_KEY"
fi

# Database: use this project's own Postgres (via Docker) when available — the
# same engine the Collings stack uses, but a separate database on host port
# 5433. Falls back to SQLite so the app still runs with zero setup.
DB_URL="postgres://collings_ticketing:collings_ticketing@localhost:5433/collings_ticketing"
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "    starting Postgres (docker compose up -d db)"
  ( cd "$ROOT" && docker compose up -d db )
  # point the backend at it (idempotent: replace commented, existing, or missing)
  if grep -q '^DATABASE_URL=' .env; then
    sed -i.bak "s|^DATABASE_URL=.*|DATABASE_URL=${DB_URL}|" .env && rm -f .env.bak
  elif grep -q '^# *DATABASE_URL=' .env; then
    sed -i.bak "s|^# *DATABASE_URL=.*|DATABASE_URL=${DB_URL}|" .env && rm -f .env.bak
  else
    printf '\nDATABASE_URL=%s\n' "$DB_URL" >> .env
  fi
  printf "    waiting for Postgres"
  for _ in $(seq 1 30); do
    if docker compose -f "$ROOT/docker-compose.yml" exec -T db pg_isready -U collings_ticketing >/dev/null 2>&1; then
      printf " ready\n"; break
    fi
    printf "."; sleep 1
  done
else
  echo "    Docker not running — using SQLite (no external DB needed)."
fi

python manage.py migrate
# Seed a demo login + sample tickets so the DB clearly has data on first run.
python manage.py seed_demo
deactivate

echo "==> Frontend setup ($FE)"
cd "$FE"
npm install
if [ ! -f .env ]; then
  cp .env.example .env
  echo "    created frontend/.env"
fi

echo ""
echo "Setup complete."
echo "  - Demo login (already seeded):  demo@collings.com.au  /  demo12345"
echo "  - Run everything:               ./scripts/dev.sh   (or: make dev / npm run dev)"
echo "  - Full admin login (optional):  cd backend && source .venv/bin/activate && python manage.py createsuperuser"
