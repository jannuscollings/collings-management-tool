#!/usr/bin/env bash
#
# Run the backend (Django/ASGI, port 8000) and frontend (CRA, port 3000)
# together. Press Ctrl-C once to stop both.
#
# First time? Run ./scripts/setup.sh first.
#
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BE="$ROOT/backend"
FE="$ROOT/frontend"

if [ ! -d "$BE/.venv" ]; then
  echo "Backend isn't set up yet. Run: ./scripts/setup.sh" >&2
  exit 1
fi
if [ ! -d "$FE/node_modules" ]; then
  echo "Frontend isn't set up yet. Run: ./scripts/setup.sh" >&2
  exit 1
fi

pids=()
cleanup() {
  echo ""
  echo "Shutting down..."
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup INT TERM

echo "Backend  -> http://localhost:8000  (admin: /admin/, api docs: /swagger/)"
(
  cd "$BE"
  # shellcheck disable=SC1091
  source .venv/bin/activate
  exec python manage.py runserver 0.0.0.0:8000
) &
pids+=($!)

echo "Frontend -> http://localhost:3000"
(
  cd "$FE"
  exec npm start
) &
pids+=($!)

echo "Both starting. Press Ctrl-C to stop."
wait
