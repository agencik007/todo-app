# Todo App - Docker Development Commands
.PHONY: help dev prod build up down restart logs logs-backend logs-frontend logs-db logs-pgadmin \
	clean clean-volumes shell-backend shell-db migrate test-backend lint-frontend status \
	quick-start quick-dev test-e2e e2e-up e2e-down deploy backup-db

# Env files used for docker-compose variable interpolation (POSTGRES_*, SECRET_KEY,
# DATABASE_URL, PGADMIN_*, ...). Copy docker/docker.env.example to docker/docker.env
# for local dev; docker/docker.prod.env holds real production secrets and is never committed.
DEV_ENV_FILE ?= docker/docker.env
PROD_ENV_FILE ?= docker/docker.prod.env

COMPOSE_DEV = docker-compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml --env-file $(DEV_ENV_FILE)
COMPOSE_PROD = docker-compose -f docker/docker-compose.yml --env-file $(PROD_ENV_FILE)

# Isolated stack for the Playwright e2e tests (own project, throwaway DB, no env file).
# `docker compose` (v2) because the targets rely on `up --wait`.
COMPOSE_E2E = docker compose -p todo-e2e -f docker/docker-compose.e2e.yml

# Environment targeted by the operational commands below (down, logs, shell, migrate, tests, ...).
# Defaults to dev; use e.g. `make logs STACK=prod` against the production stack.
STACK ?= dev
ifeq ($(STACK),prod)
COMPOSE = $(COMPOSE_PROD)
else ifeq ($(STACK),dev)
COMPOSE = $(COMPOSE_DEV)
else
$(error STACK must be "dev" or "prod", got "$(STACK)")
endif

# Default target
help: ## Show this help message
	@echo "Todo App - Docker Commands"
	@echo ""
	@echo "Available commands (operational ones target the dev stack; add STACK=prod for production):"
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-15s %s\n", $$1, $$2}'

# Development commands
dev: ## Start development environment with hot-reload
	$(COMPOSE_DEV) up --build

prod: ## Start production environment
	$(COMPOSE_PROD) up --build -d

# Continuous deployment (run on the server by .github/workflows/deploy.yml).
# Pulls the images CI pushed to GHCR instead of building them here, migrates the
# database with the new backend image, then swaps the containers.
# Usage: make deploy IMAGE_TAG=<commit sha> BACKEND_IMAGE=ghcr.io/... FRONTEND_IMAGE=ghcr.io/...
DEPLOY_KEEP_IMAGES ?= 3
COMPOSE_DEPLOY = IMAGE_TAG=$(IMAGE_TAG) BACKEND_IMAGE=$(BACKEND_IMAGE) FRONTEND_IMAGE=$(FRONTEND_IMAGE) $(COMPOSE_PROD)

deploy: ## Deploy prebuilt images to production (IMAGE_TAG, BACKEND_IMAGE, FRONTEND_IMAGE required)
	@test -n "$(IMAGE_TAG)" -a -n "$(BACKEND_IMAGE)" -a -n "$(FRONTEND_IMAGE)" \
		|| { echo "IMAGE_TAG, BACKEND_IMAGE and FRONTEND_IMAGE must be set"; exit 1; }
	$(COMPOSE_DEPLOY) pull backend frontend
	@# Migrations run automatically, so snapshot the database first.
	$(MAKE) --no-print-directory backup-db STACK=prod
	$(COMPOSE_DEPLOY) run --rm -T backend alembic upgrade head
	$(COMPOSE_DEPLOY) up -d --no-build --wait
	@# Keep the newest $(DEPLOY_KEEP_IMAGES) releases of each image for quick rollbacks.
	for img in $(BACKEND_IMAGE) $(FRONTEND_IMAGE); do \
		docker images "$$img" --format '{{.Repository}}:{{.Tag}}' | tail -n +$$(( $(DEPLOY_KEEP_IMAGES) + 1 )) \
			| xargs -r docker rmi || true; \
	done

# Database dumps (pg_dump custom format, restore with pg_restore - see README).
# Kept outside git and the Docker build context (.gitignore, .dockerignore).
BACKUP_DIR ?= backups
BACKUP_KEEP ?= 10

backup-db: ## Dump the database to backups/ (keeps the newest 10; STACK=prod for production)
	mkdir -p $(BACKUP_DIR)
	$(COMPOSE) up -d --wait db
	umask 077; f="$(BACKUP_DIR)/$(STACK)-$$(date -u +%Y%m%dT%H%M%SZ).dump"; \
	$(COMPOSE) exec -T db sh -c 'pg_dump -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" --format=custom' > "$$f.tmp" \
		&& mv "$$f.tmp" "$$f" && echo "Database backup: $$f" \
		|| { rm -f "$$f.tmp"; echo "Database backup failed"; exit 1; }
	ls -1t $(BACKUP_DIR)/$(STACK)-*.dump | tail -n +$$(( $(BACKUP_KEEP) + 1 )) | xargs -r rm --

build: ## Build all services
	$(COMPOSE_PROD) build

up: ## Start all services (production)
	$(COMPOSE_PROD) up -d

down: ## Stop all services
	$(COMPOSE) down

restart: ## Restart all services
	$(COMPOSE) restart

logs: ## Show logs from all services
	$(COMPOSE) logs -f

logs-backend: ## Show backend logs
	$(COMPOSE) logs -f backend

logs-frontend: ## Show frontend logs
	$(COMPOSE) logs -f frontend

logs-db: ## Show database logs
	$(COMPOSE) logs -f db

logs-pgadmin: ## Show PgAdmin logs
	$(COMPOSE) logs -f pgadmin

clean: ## Remove all containers, volumes, and images
	$(COMPOSE) down -v --rmi all

clean-volumes: ## Remove all volumes (WARNING: This will delete database data!)
	$(COMPOSE) down -v

shell-backend: ## Open shell in backend container
	$(COMPOSE) exec backend bash

shell-db: ## Open shell in database container
	$(COMPOSE) exec db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

migrate: ## Run database migrations using Alembic
	$(COMPOSE) exec backend alembic upgrade head

test-backend: ## Run backend tests
	$(COMPOSE) exec backend python -m pytest

lint-frontend: ## Run frontend lint (there is no frontend test runner yet)
	$(COMPOSE) exec frontend npm run lint

# End-to-end tests. The stack runs in Docker; Playwright runs on the host (needs Node 22)
# because the frontend calls the API at http://localhost:8000. Stop the dev stack first.
e2e-up: ## Start the isolated e2e stack (ports 4200/8000/8025)
	$(COMPOSE_E2E) up --build --wait

e2e-down: ## Stop the e2e stack and drop its data
	$(COMPOSE_E2E) down -v

test-e2e: ## Run Playwright e2e tests against a fresh e2e stack, then tear it down
	$(COMPOSE_E2E) up --build --wait
	(cd e2e && npm ci && npx playwright install chromium && npx playwright test); \
	status=$$?; $(COMPOSE_E2E) down -v; exit $$status

status: ## Show status of all services
	$(COMPOSE) ps

# Quick start commands
quick-start: build up ## Build and start production environment
	@echo ""
	@echo "🚀 Application is running!"
	@echo "📱 Frontend: http://localhost:4200"
	@echo "🔧 Backend API: http://localhost:8000"
	@echo "📊 API Docs: http://localhost:8000/docs"
	@echo "🗄️ Database: localhost:5433"
	@echo "🛠️ PgAdmin: http://localhost:5050"

quick-dev: ## Start development environment
	@echo "🔥 Starting development environment with hot-reload..."
	$(COMPOSE_DEV) up --build
