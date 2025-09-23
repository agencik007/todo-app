# Todo App - Docker Development Commands
.PHONY: help build up down restart logs clean dev prod test

# Default target
help: ## Show this help message
	@echo "Todo App - Docker Commands"
	@echo ""
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-15s %s\n", $$1, $$2}'

# Development commands
dev: ## Start development environment with hot-reload
	docker-compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml up --build

prod: ## Start production environment
	docker-compose -f docker/docker-compose.yml up --build -d

build: ## Build all services
	docker-compose -f docker/docker-compose.yml build

up: ## Start all services (production)
	docker-compose -f docker/docker-compose.yml up -d

down: ## Stop all services
	docker-compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml down

restart: ## Restart all services
	docker-compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml restart

logs: ## Show logs from all services
	docker-compose -f docker/docker-compose.yml logs -f

logs-backend: ## Show backend logs
	docker-compose -f docker/docker-compose.yml logs -f backend

logs-frontend: ## Show frontend logs
	docker-compose -f docker/docker-compose.yml logs -f frontend

logs-db: ## Show database logs
	docker-compose -f docker/docker-compose.yml logs -f db

logs-pgadmin: ## Show PgAdmin logs
	docker-compose -f docker/docker-compose.yml logs -f pgadmin

clean: ## Remove all containers, volumes, and images
	docker-compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml down -v --rmi all

clean-volumes: ## Remove all volumes (WARNING: This will delete database data!)
	docker-compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml down -v

shell-backend: ## Open shell in backend container
	docker-compose -f docker/docker-compose.yml exec backend bash

shell-db: ## Open shell in database container
	docker-compose -f docker/docker-compose.yml exec db psql -U todo_user -d todo_db

migrate: ## Run database migrations (if any)
	docker-compose -f docker/docker-compose.yml exec backend python -c "from config.database import Base, engine; Base.metadata.create_all(bind=engine); print('Database tables created')"

test-backend: ## Run backend tests
	docker-compose -f docker/docker-compose.yml exec backend python -m pytest

test-frontend: ## Run frontend tests
	docker-compose -f docker/docker-compose.yml exec frontend npm test -- --watch=false

status: ## Show status of all services
	docker-compose -f docker/docker-compose.yml ps

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
	docker-compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml up --build
