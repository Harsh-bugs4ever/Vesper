# Vesper — common tasks. Run `make help` for the list.
.DEFAULT_GOAL := help
COMPOSE := docker compose
PY := python

.PHONY: help up down logs build ps migrate migration db-init db-reset seed reseed contracts simulate test clean

help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

up: ## Build and start everything (Postgres, Redis, 13 services)
	$(COMPOSE) up --build -d
	@echo "Gateway on http://localhost:8000/docs"

down: ## Stop everything, keeping the data volumes
	$(COMPOSE) down

logs: ## Tail every service's logs
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

contracts: ## Regenerate the OpenAPI specs the frontend builds against
	$(PY) scripts/export_contracts.py

simulate: ## Play a resort day against the running stack
	$(PY) scripts/day_simulator.py

dev: ## Run every service locally, without Docker
	$(PY) scripts/run_local.py

test: ## Run the test suite
	$(PY) -m pytest

clean: ## Remove containers and volumes. Destroys all data.
	$(COMPOSE) down -v
