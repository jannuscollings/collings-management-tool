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

python manage.py migrate
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
echo "  - Create an admin login:  cd backend && source .venv/bin/activate && python manage.py createsuperuser"
echo "  - Run everything:         ./scripts/dev.sh   (or: make dev / npm run dev)"
