#!/usr/bin/env bash
set -e

H="${PGHOST:-localhost}"
P="${PGPORT:-5432}"

if [ -n "${PGUSER:-}" ]; then
  U="$PGUSER"
elif [ "$(uname -s)" = "Darwin" ]; then
  U="$(whoami)"
else
  U="postgres"
fi

export PGPASSWORD="${PGPASSWORD:-postgres}"

for c in psql createdb; do
  if ! command -v "$c" >/dev/null 2>&1; then
    echo "Missing tool: $c (install PostgreSQL first, see Phase 2)"
    exit 1
  fi
done

LOCAL_DB="$(basename "$PWD" | tr '[:upper:]-' '[:lower:]_' | tr -cd 'a-z0-9_')_local"

if [ "$(uname -s)" = "Darwin" ] && [ -z "${PGUSER:-}" ]; then
  LOCAL_URL="postgres://$U@$H:$P/$LOCAL_DB"
else
  LOCAL_URL="postgres://$U:$PGPASSWORD@$H:$P/$LOCAL_DB"
fi

echo "==> Local database: $LOCAL_DB (user: $U)"

EXISTS="$(psql -h "$H" -p "$P" -U "$U" -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname='$LOCAL_DB'")"

if [ "$EXISTS" = "1" ]; then
  echo " already exists, keeping it"
else
  createdb -h "$H" -p "$P" -U "$U" "$LOCAL_DB"
  echo " created"
fi

echo "==> Saving DATABASE_URL to .env (backup in .env.backup)"

touch .env
cp .env .env.backup

if grep -q '^DATABASE_URL=' .env; then
  sed -i.tmp "s#^DATABASE_URL=.*#DATABASE_URL=$LOCAL_URL#" .env && rm -f .env.tmp
else
  printf '\nDATABASE_URL=%s\n' "$LOCAL_URL" >> .env
fi

export DATABASE_URL="$LOCAL_URL"

touch .gitignore
for f in .env .env.backup; do
  grep -qxF "$f" .gitignore || echo "$f" >> .gitignore
done

if [ -f manage.py ]; then
  echo "==> Django project found. Preparing Python environment"

  if [ ! -d .venv ] && [ ! -d venv ] && [ ! -d env ]; then
    python3 -m venv .venv
  fi

  for d in .venv venv env; do
    if [ -f "$d/bin/activate" ]; then
      . "$d/bin/activate"
      break
    fi
  done

  python -m pip install --upgrade pip >/dev/null

  if [ -f requirements.txt ]; then
    pip install -r requirements.txt
  fi

  pip install dj-database-url python-dotenv >/dev/null

  echo "==> Building all tables (python manage.py migrate)"
  python manage.py migrate

elif [ -f prisma/schema.prisma ]; then
  echo "==> Prisma project found"
  npm install
  npx prisma migrate deploy
else
  echo "No Django or Prisma project here."
  echo "Run this project's migration command with DATABASE_URL=$LOCAL_URL."
  exit 1
fi

echo "==> Tables in local database:"
psql -h "$H" -p "$P" -U "$U" -d "$LOCAL_DB" -c \
  "SELECT count(*) AS tables FROM information_schema.tables WHERE table_schema = 'public';"

echo ""
echo "DONE. DATABASE_URL=$LOCAL_URL"
