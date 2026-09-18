# Vesper — common tasks. Run `make help` for the list.
.DEFAULT_GOAL := help
COMPOSE := docker compose
PY := python

.PHONY: help up down logs build ps db-init db-reset seed contracts fmt test clean

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

db-init: ## Create the schemas and tables
	$(PY) infra/bootstrap.py

db-reset: ## Drop and recreate the database. Destroys all data.
	$(PY) infra/bootstrap.py --drop

seed: ## Load the demo resort (355 rooms, ~180 staff, a year of bookings)
	$(PY) scripts/seed.py

reseed: ## Wipe and reseed from scratch
	$(PY) scripts/seed.py --reset

contracts: ## Regenerate the OpenAPI specs the frontend builds against
	$(PY) scripts/export_contracts.py

test: ## Run the test suite
	$(PY) -m pytest

clean: ## Remove containers and volumes. Destroys all data.
	$(COMPOSE) down -v
