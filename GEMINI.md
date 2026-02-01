# Agent Guidelines: Todo App (FastAPI + Angular)

This repository contains a full-stack Todo application with a FastAPI backend and an Angular frontend, both containerized with Docker.

## 🛠 Build, Lint, and Test Commands

All major operations are managed via the root `Makefile`.

### General

- **Start Dev Environment:** `make dev` (hot-reload enabled)
- **Start Prod Environment:** `make prod`
- **Stop All Services:** `make down`
- **View Logs:** `make logs`, `make logs-backend`, `make logs-frontend`
- **Clean Environment:** `make clean` (removes containers, images, volumes)

### Backend (FastAPI)

- **Run All Tests:** `make test-backend`
- **Run Single Test:** `docker-compose -f docker/docker-compose.yml exec backend python -m pytest backend/tests/test_filename.py::test_function_name`
- **Rate Limiting & Testing:**
  - Rate limiting is enabled by default on sensitive endpoints (registration, login, verify email).
  - **CRITICAL:** To disable rate limiting during tests, ensure the environment variable `TESTING=1` is set.
  - The `backend/tests/conftest.py` file sets `os.environ["TESTING"] = "1"` automatically for all pytest-runs.
  - If adding new rate-limited endpoints, always check `enabled=not IS_TESTING` or `os.getenv("TESTING") != "1"`.
- **Database Migration:** `make migrate` (creates tables using SQLAlchemy)
- **Enter Shell:** `make shell-backend`

### Frontend (Angular)

- **Run All Tests:** `make test-frontend` (non-watching mode)
- **Run Single Test:** `docker-compose -f docker/docker-compose.yml exec frontend npx ng test --include=src/app/path/to/spec.ts`
- **Linting:** `docker-compose -f docker/docker-compose.yml exec frontend npm run lint`

---

## 🎨 Code Style Guidelines

### General Principles

- **DRY & KISS:** Keep it simple and don't repeat yourself.
- **Docker-First:** Assume all tools run inside containers.
- **Absolute Paths:** When using tools, always prefer absolute paths.

### Backend (Python/FastAPI)

- **Framework:** FastAPI with SQLAlchemy (models) and Pydantic (schemas).
- **Imports:** Group imports: 1. Standard library, 2. Third-party, 3. Local modules.
- **Naming:**
  - Functions/Variables: `snake_case`
  - Classes: `PascalCase`
  - Schemas: suffix with `Create`, `Update` where applicable (e.g., `TodoCreate`).
- **Typing:** Use Python type hints everywhere. Use `typing.List`, `Optional`, etc.
- **Error Handling:** Use `fastapi.HTTPException` with appropriate status codes from `fastapi.status`.
- **Formatting:** Follow PEP 8 (handled by toolings, but keep it clean). Use double quotes for strings unless single quotes are required.
- **OpenAPI:** after changes in API, regenerate OpenAPI models using `npm run generate-api` inside frontend folder.

### Frontend (TypeScript/Angular)

- **Framework:** Angular (Standalone Components) with PrimeNG UI library.
- **Imports:** Preferred order: 1. Angular core/common, 2. Third-party libraries, 3. Shared/Core services, 4. Local models/components.
- **Naming:**
  - Components/Services/Classes: `PascalCase` (e.g., `TodoService`, `TodoListComponent`).
  - Variables/Methods: `camelCase`.
  - Variables/Methods: `camelCase`.
  - Interfaces/Models: suffix with `.model.ts`.
- **Data Models:** Use auto-generated OpenAPI models from `@api`. Do NOT manually define interfaces for API resources.
- **Styling:** Use SCSS partials in `src/app/shared/global-styling` (layout, typography, forms). Avoid duplicating styles in components.
- **Formatting:** Single quotes for strings. 2-space indentation. 100 char line limit (see `frontend/package.json`).
- **State Management:** Use `AuthStateService` for global state and `IndexedDBService` for local persistence.
- **API Communication:** Use `HttpClient` in Services. Centralize API URL logic in services using `window.location` for environment awareness.
- **Routing:** Use Angular Router for navigation. Use `AuthGuard` for authentication.
- **Translations:** Use `ngx-translate` for translations. Use `TranslationService` for translations. Add new translations to `src/assets/i18n/en.json` and `src/assets/i18n/pl.json`.
- **SSR mode:** Angular is running in SSR mode. Use `window.location` for environment awareness. Remeber to add correct routes with params in `app.routes.server.ts` file.
- **OpenAPI:** Use auto-generated OpenAPI models from `@api`. Do NOT manually define interfaces for API resources. Command to generate: `npm run generate-api` inside frontend folder.
- **Error Handling:** Use `catchError` in RxJS pipes. Transform errors into user-friendly messages using a centralized `handleError` method in services.

---

## 📂 Project Structure

- `/backend`: FastAPI application, models, routes, and tests.
- `/frontend`: Angular source code, components, and assets.
- `/docker`: Dockerfiles and docker-compose configurations.
- `Makefile`: Root entry point for all development tasks.
