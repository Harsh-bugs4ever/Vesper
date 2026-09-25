# Vesper — common tasks. Run `make help` for the list.
.DEFAULT_GOAL := help
COMPOSE := docker compose
PY := python

.PHONY: help up down logs build ps migrate migration db-init db-reset seed reseed contracts simulate dev dev-api dev-web backend frontend web test clean

# Opening a new terminal window. Both halves are started this way by `make dev`.
# Paths inside are relative on purpose: Start-Process gives the new window the
# working directory it was launched from, which is this directory.
NEW_WINDOW = powershell -NoProfile -Command "Start-Process powershell -ArgumentList '-NoExit','-NoProfile','-Command',

help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

up: ## Build and start everything (Redis, the backend, the web app)
	$(COMPOSE) up --build -d
	@echo "API on http://localhost:8000/docs"

down: ## Stop everything, keeping the data volumes
	$(COMPOSE) down

logs: ## Tail the logs
	$(COMPOSE) logs -f --tail=100

ps: ## Show what is running
	$(COMPOSE) ps

build: ## Rebuild the images without starting them
	$(COMPOSE) build

migrate: ## Apply database migrations (the deployment path)
	$(PY) -m alembic upgrade head

migration: ## Generate a migration from model changes: make migration m="add x"
	$(PY) -m alembic revision --autogenerate -m "$(m)"

db-init: ## Create the schemas and tables directly, without migrations (local only)
	$(PY) infra/bootstrap.py

db-reset: ## Drop and recreate the database. Destroys all data.
	$(PY) infra/bootstrap.py --drop

seed: ## Load the demo resort (355 rooms, ~180 staff, a year of bookings)
	$(PY) scripts/seed.py

reseed: ## Wipe and reseed from scratch
	$(PY) scripts/seed.py --reset

contracts: ## Regenerate the OpenAPI spec the frontend builds against
	$(PY) scripts/export_contracts.py

simulate: ## Play a resort day against the running stack
	$(PY) scripts/day_simulator.py

dev: ## Run the backend and the web app, each in its own terminal
	@$(NEW_WINDOW)'if (Test-Path ''.\venv\Scripts\Activate.ps1'') { & ''.\venv\Scripts\Activate.ps1'' }; python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000'"
	@$(NEW_WINDOW)'Set-Location ''apps\web''; if (-not (Test-Path ''node_modules'')) { Write-Host ''installing web dependencies, first run only'' -ForegroundColor Yellow; npm install }; npm run dev'"
	@echo ""
	@echo "  backend   http://127.0.0.1:8000/docs"
	@echo "  frontend  http://localhost:3000"
	@echo ""
	@echo "  sign in with owner@vesper.demo / vesper123"
	@echo "  close either window to stop that half"

backend: ## Run only the backend in a new terminal window
	@$(NEW_WINDOW)'if (Test-Path ''.\venv\Scripts\Activate.ps1'') { & ''.\venv\Scripts\Activate.ps1'' }; python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000'"
	@echo ""
	@echo "  backend   http://127.0.0.1:8000/docs"
	@echo ""

frontend: web ## Run only the web app in a new terminal window
web: ## Run only the web app in a new terminal window
	@$(NEW_WINDOW)'Set-Location ''apps\web''; if (-not (Test-Path ''node_modules'')) { Write-Host ''installing web dependencies, first run only'' -ForegroundColor Yellow; npm install }; npm run dev'"
	@echo ""
	@echo "  frontend  http://localhost:3000"
	@echo ""

dev-api: ## Run only the backend, in this terminal
	$(PY) -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

dev-web: ## Run only the web app, in this terminal
	cd apps/web && npm run dev

test: ## Run the test suite
	$(PY) -m pytest

clean: ## Remove containers and volumes. Destroys all data.
	$(COMPOSE) down -v
