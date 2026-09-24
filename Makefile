# Todo App - Docker Development Commands
.PHONY: help dev prod build up down restart logs logs-backend logs-frontend logs-db logs-pgadmin \
	clean clean-volumes shell-backend shell-db migrate test-backend lint-frontend status \
	quick-start quick-dev

# Env files used for docker-compose variable interpolation (POSTGRES_*, SECRET_KEY,
# DATABASE_URL, PGADMIN_*, ...). Copy docker/docker.env.example to docker/docker.env
# for local dev; docker/docker.prod.env holds real production secrets and is never committed.
DEV_ENV_FILE ?= docker/docker.env
PROD_ENV_FILE ?= docker/docker.prod.env

COMPOSE_DEV = docker-compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml --env-file $(DEV_ENV_FILE)
COMPOSE_PROD = docker-compose -f docker/docker-compose.yml --env-file $(PROD_ENV_FILE)

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
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-15s %s\n", $$1, $$2}'

# Development commands
dev: ## Start development environment with hot-reload
	$(COMPOSE_DEV) up --build

prod: ## Start production environment
	$(COMPOSE_PROD) up --build -d

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

status: ## Show status of all services
	$(COMPOSE) ps

# Quick start commands
quick-start: build up ## Build and start production environment
	@echo ""
	@echo "🚀 Application is running!"
	@echo "📱 Frontend: http://localhost:4200"
	@echo "🔧 Backend API: http://localhost:8000"
	@echo "📊 API Docs: http://localhost:8000/docs"
	@echo "🗄️ Database: localhost:5432"
	@echo "🛠️ PgAdmin: http://localhost:5050"

quick-dev: ## Start development environment
	@echo "🔥 Starting development environment with hot-reload..."
	$(COMPOSE_DEV) up --build
