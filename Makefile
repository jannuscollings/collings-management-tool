.PHONY: help setup dev be fe migrate makemigrations superuser seed test build clean

help:
	@echo "Collings-Ticketing — common tasks:"
	@echo "  make setup       Install backend + frontend deps, set up .env and DB"
	@echo "  make dev         Run backend + frontend together (Ctrl-C stops both)"
	@echo "  make be          Run backend only  (http://localhost:8000)"
	@echo "  make fe          Run frontend only (http://localhost:3000)"
	@echo "  make migrate     Apply DB migrations"
	@echo "  make superuser   Create an admin login"
	@echo "  make seed        Seed the demo login + sample tickets"
	@echo "  make test        Run backend tests"
	@echo "  make build       Build the frontend for production"

setup:
	./scripts/setup.sh

dev:
	./scripts/dev.sh

be:
	cd backend && . .venv/bin/activate && python manage.py runserver 0.0.0.0:8000

fe:
	cd frontend && npm start

migrate:
	cd backend && . .venv/bin/activate && python manage.py migrate

makemigrations:
	cd backend && . .venv/bin/activate && python manage.py makemigrations

superuser:
	cd backend && . .venv/bin/activate && python manage.py createsuperuser

seed:
	cd backend && . .venv/bin/activate && python manage.py seed_demo

test:
	cd backend && . .venv/bin/activate && python manage.py test

build:
	cd frontend && npm run build

clean:
	rm -rf backend/.venv backend/db.sqlite3 frontend/node_modules frontend/build
