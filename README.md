# Todo App - Full-Stack Application

Todo App built with **Angular 21** + **Python FastAPI** + **PostgreSQL** using **Docker**.

## ✅ Project Status - Fully Functional!

🎉 **Application is working!** All components have been implemented and containerized.

### ✅ Completed Features:

- ✅ **FastAPI Backend** - REST API with full CRUD, PostgreSQL, Pydantic
- ✅ **Angular 21 Frontend** - Signals, Control Flow, Standalone Components, SSR
- ✅ **Installable PWA** - web app manifest + Angular service worker: an "Install app" item in the user menu (Chromium browsers), the app shell loads offline and users get a prompt to reload after each release. The installed app has a "New task" shortcut on its icon, an optional count of open tasks on the icon (setting in the user menu; App Badging API), a nav bar that replaces the title bar on desktop (Window Controls Overlay), screenshots in the install dialog and iOS launch screens
- ✅ **Offline mode** - without a connection a signed-in user still sees their last synced tasks and groups (with an offline banner) and can create, edit, complete and delete tasks; the changes are queued in IndexedDB and sent once the API is back (a create carries a `clientId`, so a retry never duplicates it). Groups, reordering and account settings stay online-only. The copy holds one user's data at a time and is deleted on logout
- ✅ **Docker** - Full containerization, multi-stage builds, production ready
- ✅ **Database** - PostgreSQL with persistent storage
- ✅ **Backend Tests** - 124 unit and integration tests with coverage (min. 80% enforced)
- ✅ **E2E Tests** - Playwright tests of the full stack (register, verify email via MailHog, login, tasks)
- ✅ **CI/CD** - GitHub Actions runs lint, tests, builds and E2E tests on every pull request and push to `develop`, then deploys `develop` to production
- ✅ **Simple Local Setup** - One `make dev` starts everything; tests run against their own `<db>_test` database

## 🚀 Quick Start

Needs only **Docker** (with Docker Compose) and **Git** — see [Prerequisites](#-prerequisites).

```bash
git clone https://github.com/agencik007/todo-app.git
cd todo-app

# One-time: create the env file used by docker-compose, then set SECRET_KEY in it
# (a random value of 32+ characters, e.g. openssl rand -hex 32)
cp docker/docker.env.example docker/docker.env

# Start all services (hot-reload)
make dev
```

> [!IMPORTANT]
> `docker/docker.env` is required — `docker-compose.yml` has no hardcoded credentials and refuses to start without `POSTGRES_*`, `PGADMIN_*` etc. `make dev` loads this file automatically; `make prod` loads `docker/docker.prod.env` instead (never committed). Compose interpolates `$` in that file; write a literal dollar sign as `$$`.
>
> Replace `SECRET_KEY` with a random value of at least 32 characters (`openssl rand -hex 32`) — the placeholder from the example file is rejected and the backend won't start. Docker does not need a `backend/.env`; `ALLOWED_HOSTS` and `CORS_ORIGINS` default to localhost values in `docker-compose.yml` and can be overridden in `docker/docker.env`.

Once started, open these in your browser:

- **📱 Frontend App**: http://localhost:4200
- **🔧 Backend API**: http://localhost:8000
- **📚 API Documentation**: http://localhost:8000/docs
- **📧 MailHog**: http://localhost:8025
- **🗄️ PgAdmin** (Database Manager): http://localhost:5050
  - Login: `PGADMIN_EMAIL` / `PGADMIN_PASSWORD` from `docker/docker.env`

Every port is published on `127.0.0.1` only, so these URLs work on the machine running Docker, not from other devices on the network.

Everyday commands (`make help` lists all of them):

```bash
make dev      # Development mode (hot-reload)
make down     # Stop all services
make status   # Check status
make logs     # View logs (add STACK=prod for the production stack)
```

### 📧 MailHog - Email Testing

The application uses **MailHog** for testing email functionalities (email verification, password reset). MailHog is a development SMTP server that catches all emails without sending real messages.

**How to use MailHog:**

1. MailHog starts automatically with docker-compose
2. Open your browser: **http://localhost:8025**
3. All emails sent by the application will appear in the MailHog interface
4. You can view content, headers, and test email features

Emails are rendered from Jinja2 templates in `backend/templates/email/` (dark theme only, the app's cyan palette) with texts from `backend/i18n/{en,pl}.json`. They are sent in the account's language: the interface language at sign-up, changed later with the language selector. The logo is loaded from `FRONTEND_URL/icons/icon-192.png`, so it only shows in clients that can reach that address.

**Note:** MailHog is part of `docker-compose.yml`, so it also starts with `make prod`. In production set `USE_MAILHOG=false` and the `SMTP_*` variables so emails go through a real SMTP server.

---

## 📋 Table of Contents

- [🚀 Quick Start](#-quick-start)
- [🎯 Project Description](#-project-description)
- [🛠 Technologies](#-technologies)
- [📋 Prerequisites](#-prerequisites)
- [🚀 Installation](#-installation)
- [⚙️ Configuration](#️-configuration)
- [🏃‍♂️ Running the app](#️-running-the-app)
- [📚 API Documentation](#-api-documentation)
- [🧪 Testing](#-testing)
- [🐳 Docker - Detailed Documentation](#-docker---detailed-documentation)
- [🗄️ Database Management (Alembic)](#️-database-management-alembic)
- [📁 Project Structure](#-project-structure)
- [✉️ API Message System](#️-api-message-system)
- [🎨 Design System](#-design-system)
- [🔧 Development](#-development)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

## 🎯 Project Description

A simple Todo application for task management with full CRUD (Create, Read, Update, Delete) support. The backend written in FastAPI provides a REST API, while the frontend in Angular 21 offers a modern user interface. Data is stored in a PostgreSQL database.

### Features

- ✅ Create, edit, complete and delete tasks; drag & drop reordering
- ✅ Groups for organizing tasks
- ✅ User accounts: registration, email verification, password reset, avatar, self-service account deletion
- ✅ Public privacy policy page (`/privacy`, English and Polish)
- ✅ Security: password strength validation, refresh token rotation with reuse detection, rate limiting, CSP and security headers
- ✅ Polish / English UI (ngx-translate), light / dark mode and color themes
- ✅ Responsive design

## 🛠 Technologies

### Backend

- **Python 3.12**
- **FastAPI** - modern web framework
- **SQLAlchemy** - ORM for databases
- **PostgreSQL** - database
- **Pydantic** - data validation
- **Jinja2** - email templates
- **Uvicorn** - ASGI server

### Frontend

- **Angular 21** - frontend framework (standalone components, signals, SSR)
- **TypeScript** - programming language
- **@ngrx/signals** - signal-based stores (`AuthStore`, `TodoStore`)
- **RxJS** - reactive programming
- **OpenAPI Generator** - generates TypeScript types from backend
- **PrimeNG** - UI component library (Aura theme)
- **@angular/service-worker** - PWA: caches the app shell (never API responses), drives the update prompt
- **JetBrains Mono** - app font, self-hosted via `@fontsource-variable/jetbrains-mono` (no requests to Google Fonts)
- **Design system** - design tokens + shared UI primitives on top of PrimeNG (see [Design System](#-design-system))

### DevOps

- **Docker** - containerization
- **Docker Compose** - container orchestration
- **PostgreSQL** - database in container
- **GitHub Actions** - CI (see [Continuous Integration](#continuous-integration-github-actions)), CD to production and nightly database backups (see [Continuous deployment](#continuous-deployment-github-actions))
- **Playwright** - end-to-end tests (see [End-to-End Tests](#end-to-end-tests-playwright))

## 📋 Prerequisites

**With Docker (recommended):**

- **Docker** with Docker Compose v2 - [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine + the compose plugin. The Makefile calls `docker-compose`; the e2e targets call `docker compose`, and `make deploy` needs v2 as well (`up --wait`)
- **Git** - [Download](https://git-scm.com/)
- **make** - on Windows use Git Bash or WSL
- **Node.js 22** - only for the Git hooks (`npm install` in the project root), the Playwright E2E tests and `npm run generate-api`

**Without Docker** (see [Installation](#-installation)):

- **Python 3.12+** - [Download](https://www.python.org/downloads/)
- **Node.js 20.19+ or 22.12+** (required by Angular 21) - [Download](https://nodejs.org/)
- **PostgreSQL** - [Download](https://www.postgresql.org/download/)

## 🚀 Installation

These steps are for running **without Docker**. With Docker, [Quick Start](#-quick-start) is all you need.

### 1. Clone the repository

```bash
git clone https://github.com/agencik007/todo-app.git
cd todo-app
```

### 2. Backend - Python/FastAPI

```bash
cd backend

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
# source venv/bin/activate

# Install dependencies (runtime + pytest/ruff; production installs requirements.txt only)
pip install -r requirements-dev.txt
```

### 3. Frontend - Angular

```bash
cd frontend

# Install dependencies
npm install
```

### 4. PostgreSQL Database

```bash
# Run PostgreSQL and execute in psql:
CREATE USER todo_user WITH PASSWORD 'todo_password';
CREATE DATABASE todo_db OWNER todo_user;
GRANT ALL PRIVILEGES ON DATABASE todo_db TO todo_user;
-- Separate database for the test suite (tests wipe all data on every run)
CREATE DATABASE todo_db_test OWNER todo_user;
```

## ⚙️ Configuration

### Environment Variables

Copy the example file and fill in your own values:

```bash
cd backend
cp .env.example .env   # Windows (PowerShell): copy .env.example .env
```

Minimal, working `backend/.env` for running without Docker:

```env
SECRET_KEY=<output of: openssl rand -hex 32>
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ORIGINS=http://localhost:4200,http://127.0.0.1:4200
DATABASE_URL=postgresql://todo_user:todo_password@localhost:5432/todo_db
SECURE_COOKIES=False

# Email (verification, password reset) - without Docker there is no MailHog
# reachable at the hostname "mailhog", so point it at localhost or a real SMTP server.
USE_MAILHOG=true
MAILHOG_HOST=localhost
MAILHOG_PORT=1025
FRONTEND_URL=http://localhost:4200
```

> [!NOTE]
> `ALLOWED_HOSTS` and `CORS_ORIGINS` are required — the backend refuses to start without them (see `backend/main.py`). `SECRET_KEY` must be at least 32 characters and not a known placeholder (see `backend/services/auth_service.py`).
>
> This file is only for running without Docker. The Docker stack takes all its settings from `docker/docker.env`.
>
> If you don't run MailHog locally (see below), sending emails (verification, password reset) will simply fail and be logged as an error in the backend console — the rest of the app keeps working normally.

### Docker (Alternative Setup)

If you prefer using Docker, the entire application can be run in containers — see [Quick Start](#-quick-start).

## 🏃‍♂️ Running the app

### Option 1: Running without Docker

#### 1. Backend

On the **first run, against an empty database** (created in [4. PostgreSQL Database](#4-postgresql-database)), just start the backend — it creates the schema itself:

```bash
cd backend

# activate the virtual environment if it isn't active yet
# Windows:
venv\Scripts\activate
# Linux/Mac:
# source venv/bin/activate

uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

> [!NOTE]
> On startup the app creates any missing tables from the SQLAlchemy models (`Base.metadata.create_all`) and, on a database without Alembic version tracking, marks it as being on the latest revision (`_ensure_alembic_stamped()` in `backend/main.py`). Docker works the same way (`Dockerfile.backend` just runs `uvicorn`).
>
> `alembic upgrade head` works too, on an empty database as well as an existing one: the migrations build the full schema from scratch, which is what `make deploy` relies on for the first deploy to a new server. After a `git pull` that adds migration files, run it to apply just the new ones.

The backend will be available at: http://localhost:8000

#### 2. (Optional) MailHog - preview outgoing emails

Without Docker, MailHog doesn't start automatically. If you want to see verification/password-reset emails, download the MailHog binary ([github.com/mailhog/MailHog/releases](https://github.com/mailhog/MailHog/releases)) and run it locally:

```bash
./MailHog   # SMTP on :1025, UI on http://localhost:8025
```

If you skip this, the app still works fine — emails just won't be delivered anywhere.

#### 3. Frontend

```bash
cd frontend
npm start   # equivalent to: ng serve
```

The frontend will be available at: http://localhost:4200

### Option 2: Running with Docker

Follow [Quick Start](#-quick-start): create `docker/docker.env`, set `SECRET_KEY` and run `make dev`. Details are in [Docker - Detailed Documentation](#-docker---detailed-documentation).

## 📚 API Documentation

After running the backend with `DEBUG=True`, API documentation is available at:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

> [!NOTE]
> With `DEBUG=False` (production) `/docs`, `/redoc` and `/openapi.json` are disabled. `make dev` sets `DEBUG=True` automatically.

### Available endpoints

| Prefix    | Description                                                                                                     |
| --------- | --------------------------------------------------------------------------------------------------------------- |
| `/`       | Application status                                                                                              |
| `/health` | Health check (process only)                                                                                     |
| `/auth`   | Registration, login, token refresh, email verification, password reset; `/auth/health` also checks the database |
| `/users`  | Current user's avatar, language preference and account deletion                                                 |
| `/todos`  | Tasks CRUD and reordering                                                                                       |
| `/groups` | Task groups CRUD                                                                                                |

All `/todos`, `/groups` and `/users` endpoints require an authenticated user with a verified email. The full, up-to-date list is in Swagger UI.

---

## 🧪 Testing

### Backend - Tests (Pytest)

The application has a comprehensive suite of tests (currently **124**), including API tests for Todo, Auth, Groups and Users. `pytest.ini` always measures coverage and fails the run below **80%**.

```bash
# In Docker (dev stack running)
make test-backend

# Or locally
cd backend

# Run all tests
pytest

# Run a specific test file
pytest tests/test_groups.py -v

# Coverage runs automatically (terminal report + htmlcov/)
```

> [!IMPORTANT]
> Tests never touch the application database: they run against `<db>_test` derived from `DATABASE_URL` (e.g. `todo_db_test`), created automatically if the user has permission, or against `TEST_DATABASE_URL` if set. All data in the test database is wiped before every test.

> [!NOTE]
> **Rate Limiting:** During tests, request throttling is disabled (`TESTING=1`), allowing for fast test execution.

### Frontend - Unit Tests

> [!WARNING]
> There is currently no test runner configured for the frontend — `angular.json` has no `test` target, so `ng test` fails. Only lint is available:

```bash
make lint-frontend        # in Docker
# or locally: cd frontend && npm run lint
```

### End-to-End Tests (Playwright)

`e2e/` holds Playwright tests that drive the real app in Chromium: registration with email verification (the link is read from MailHog's API), login and logout, account deletion, the public privacy policy page, creating, editing, completing, filtering and deleting tasks, and a smoke test that fails on any Content-Security-Policy violation. A separate Playwright project, `pwa`, runs `tests/pwa.spec.ts` with service workers allowed: the manifest with its icons, shortcut and screenshots, the iOS launch screens, the "New task" shortcut opening the form, the app icon badge, `no-cache` on the service worker files, the app shell loading offline (in both languages), the Install app item, a signed-in user changing tasks offline (kept across a reload) and the changes reaching the server once back online, a create whose response was lost being retried without a duplicate, and logout deleting the offline copy; every other test blocks service workers so it always hits the network.

They run against a separate, throwaway stack defined in `docker/docker-compose.e2e.yml`: production images (SSR frontend), a PostgreSQL database on tmpfs, MailHog, and rate limiting disabled (`TESTING=1`). Each test registers its own user, so tests are independent and run in parallel.

```bash
make down        # the e2e stack uses the same ports (4200, 8000, 8025) as the dev stack
make test-e2e    # start the e2e stack, run all tests, tear the stack down
```

For writing and debugging tests, keep the stack running:

```bash
make e2e-up                     # start the e2e stack and wait until it is healthy
cd e2e && npm ci && npx playwright install chromium
npx playwright test             # or: npm run test:ui (interactive), npm run report (last HTML report)
make e2e-down                   # stop it and drop its data
```

> [!NOTE]
> Playwright runs on the host (Node 22), not in a container: the frontend calls the API at `http://localhost:8000`, so the browser must reach both the app and the API on `localhost`. `make test-e2e` needs Docker Compose v2 (`docker compose`).

### Continuous Integration (GitHub Actions)

`.github/workflows/ci.yml` runs on every push to `develop` and on every pull request. Merge only when all jobs are green (a branch protection rule on `develop` can enforce this):

| Job        | What it checks                                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| `backend`  | `ruff check`, `ruff format --check`, `alembic upgrade head` + `alembic check` on an empty database (the migrations must build the schema the models describe) and the full `pytest` suite (with the coverage gate) against PostgreSQL 15 |
| `frontend` | `npm ci`, `npm run lint`, `npm run format:check` (Prettier) and `npm run build` (SSR + prerender)              |
| `e2e`      | Builds the production Docker images, starts `docker/docker-compose.e2e.yml` and runs the Playwright tests      |

To reproduce the backend job locally, format and lint with `ruff format` / `ruff check` in `backend/` (configured in `backend/ruff.toml`; use the version pinned in `requirements-dev.txt`; the pre-commit hook already does this for staged files) and run `make test-backend`. For the frontend job, run `npm run lint` and `npm run format:check` in `frontend/` (`npx prettier --write .` fixes formatting). For the e2e job, run `make test-e2e`; when it fails in CI, the HTML report (with traces and screenshots) is attached to the run as the `playwright-report` artifact.

When CI passes on a push to `develop`, `.github/workflows/deploy.yml` deploys that commit to production — see [Continuous deployment](#continuous-deployment-github-actions).

## 🐳 Docker - Detailed Documentation

### Application Architecture in Docker

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │────│    Backend      │────│   PostgreSQL    │
│   (Angular SSR) │    │   (FastAPI)     │    │   (15, Alpine)  │
│   Port: 4200    │    │   Port: 8000    │    │   Port: 5433    │
│   Node server   │    │   REST API      │    │   Persistent    │
│   + prerender   │    │   + Swagger     │    │   Volume        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                    ┌───────────┴───────────┐ ┌─────────┴─────────────┐
                    │  MailHog              │ │  PgAdmin (optional)   │
                    │  Catches sent emails  │ │  Database management  │
                    │  SMTP: 1025, UI: 8025 │ │  Port: 5050           │
                    └───────────────────────┘ └───────────────────────┘
```

All ports are published on `127.0.0.1` only. The browser talks to the frontend and, directly, to the backend API (`API_URL`); in production a reverse proxy on the host puts both behind one domain (see [Production deployment](#production-deployment)).

### Launch Modes

#### Development Mode (with hot-reload)

```bash
# From the project root
make dev

# Or directly:
docker-compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml --env-file docker/docker.env up --build
```

#### Production Mode

```bash
# From the project root
make prod

# Or directly (production secrets in docker/docker.prod.env, never committed):
docker-compose -f docker/docker-compose.yml --env-file docker/docker.prod.env up --build -d
```

### Useful Docker Commands

> [!NOTE]
> Plain `docker-compose ...` commands in this README are shortened. Run them from the project root with the same files the Makefile uses, e.g. `docker-compose -f docker/docker-compose.yml --env-file docker/docker.env ps`. Operational `make` targets (`down`, `logs*`, `shell-*`, `migrate`, `test-backend`, `lint-frontend`, `status`, `clean*`) target the dev stack (`docker/docker.env`); add `STACK=prod` to target production (`docker/docker.prod.env`), e.g. `make logs STACK=prod`.

```bash
# List all available commands
make help

# Status of all containers
make status
# or: docker-compose ps

# Logs from all services
make logs
# or: docker-compose logs -f

# Logs from a single service
make logs-backend    # Backend logs
make logs-frontend   # Frontend logs
make logs-db         # Database logs
make logs-pgadmin    # PgAdmin logs

# Shell in a container
make shell-backend   # Terminal inside backend container
make shell-db        # Terminal inside database

# Restart all services
make restart

# Stop all services
make down

# Clean up - WARNING: both delete the database volume (take a `make backup-db` first)
make clean-volumes  # Removes containers and volumes
make clean          # Removes containers, volumes and images
```

### Using PgAdmin

PgAdmin is a web tool for managing PostgreSQL:

1. **Open**: http://localhost:5050
2. **Log in** with `PGADMIN_EMAIL` / `PGADMIN_PASSWORD` from `docker/docker.env`

3. **Add Database Server**:
   - Click "Add New Server"
   - "General" tab: Name: "Todo Database"
   - "Connection" tab:
     - Host: `db` from PgAdmin, or `127.0.0.1` from the host machine
     - Port: `5432` inside Docker, `5433` from the host
     - Username / Password / Database: `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` from `docker/docker.env`

4. **Browse data**:
   - Expand "Todo Database" → "Databases" → your `POSTGRES_DB` → "Schemas" → "public" → "Tables"
   - Right-click "todos" → "View/Edit Data" → "All Rows"

### Docker Configuration Files

#### Dockerfile.backend

- **Base**: Python 3.12 slim
- **Stages**: `runtime` (final image, used by production, `make deploy` and the e2e stack) installs `requirements.txt` only; `dev` adds `requirements-dev.txt` (pytest, ruff, httpx) and is what `docker-compose.override.yml` builds (`target: dev`), so `make test-backend` keeps working in the dev container
- **Server**: Uvicorn with 2 workers (production); `docker-compose.override.yml` switches it to `--reload` for development
- **Security**: Non-root user (`app`), which also owns `/app/uploadedFiles` so the `backend_uploads` volume is writable
- **Health checks**: Socket connection test

#### Dockerfile.frontend

Multi-stage build:

- **`deps`**: Node.js 22 Alpine, `npm ci` (reproducible install from `package-lock.json`) and the source. `docker-compose.override.yml` builds only up to this stage (`target: deps`) and runs `ng serve` with hot-reload on top of it
- **`build`**: Angular CLI production build with SSR and prerendering. The `API_URL` build arg (from `API_URL` in the env file, default `http://localhost:8000`) sets the URL the browser calls the API at; rebuild the image after changing it
- **`runtime`** (final image, used by production, `make deploy` and the e2e stack): a fresh Node.js 22 Alpine with only the built `dist/` folder, running as the unprivileged `node` user. The SSR server bundle is self-contained, so no `node_modules` are shipped (about 250 MB instead of 1 GB)
- **Server**: Angular SSR Node server (`dist/frontend/server/server.mjs`), which also sets the security headers and Content Security Policy (`frontend/src/server.ts`). Content-hashed build files are cached for a year; everything else (e.g. `assets/i18n/*.json`) is sent with `Cache-Control: no-cache`

#### docker-compose.yml

- **Network**: Isolated todo-network
- **Volumes**: `postgres_data` (PostgreSQL data), `backend_uploads` (user avatars, mounted at `/app/uploadedFiles` in the backend and served under `/uploads`) and `pgadmin_data`; they survive `make down` and deploys, and are deleted by `make clean` / `make clean-volumes`
- **Health checks**: Service dependencies
- **Ports**: Port mapping host:container, all bound to `127.0.0.1` (reachable from the machine itself, not from the network)
- **Services**: `db` (PostgreSQL 15), `backend`, `frontend`, `mailhog`, `pgadmin`
- **Images**: backend and frontend are tagged `${BACKEND_IMAGE:-todo-backend}:${IMAGE_TAG:-local}` / `${FRONTEND_IMAGE:-todo-frontend}:${IMAGE_TAG:-local}`; local builds use the defaults, `make deploy` points them at the GHCR images

#### Other files in `docker/`

- **`docker-compose.override.yml`**: development overrides added by `make dev` (hot-reload, source bind-mounts, `DEBUG=True`)
- **`docker-compose.e2e.yml`**: throwaway stack for the Playwright tests (see [End-to-End Tests](#end-to-end-tests-playwright))
- **`docker.env.example`**: template for `docker/docker.env`
- **`init-db.sh`**: PostgreSQL init hook (currently a no-op placeholder)
- **`nginx.conf`**, **`Dockerfile.frontend.dev`**: leftovers that no compose file or workflow uses — the frontend is served by the Angular SSR server and development builds the `deps` stage of `Dockerfile.frontend`

### Troubleshooting Docker

#### Problem: Port is already in use

```bash
# Check what process uses the port
ss -ltnp | grep :4200          # Linux
lsof -i :4200                  # macOS
netstat -ano | findstr :4200   # Windows

# Change port in docker-compose.yml
ports:
  - "127.0.0.1:3000:4200"  # Use 3000 instead of 4200
```

#### Problem: Container keeps stopping

```bash
# Check logs
docker-compose logs frontend

# Check status
docker-compose ps

# Rebuild without cache
docker-compose build --no-cache frontend
```

#### Problem: Database isn't working

```bash
# Check connection (POSTGRES_USER / POSTGRES_DB from docker/docker.env)
docker-compose exec db sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

# Reset database
docker-compose down -v  # WARNING: Deletes all data!
docker-compose up --build db
```

#### Problem: Frontend not connecting to backend

```bash
# Check if backend works (/auth/health also checks the database)
curl http://localhost:8000/health
curl http://localhost:8000/auth/health

# Check Docker network (the frontend image has wget, not curl)
docker-compose exec frontend wget -qO- http://backend:8000/health
```

### Development workflow

1. **Run**: `make dev` once; afterwards the stopped containers can also be started from Docker Desktop (▶), which doesn't rebuild anything
2. **Code**: Edit files locally — `backend/` and `frontend/` are bind-mounted, so uvicorn `--reload` restarts the API and `ng serve` rebuilds and refreshes the browser
3. **Rebuild**: `make dev` again after changing dependencies (`requirements.txt`, `requirements-dev.txt`, `package.json`), `docker/*` or `docker/docker.env`
4. **Test**: Open http://localhost:4200 in the browser
5. **Debug**: `make logs` for real-time logs

#### Switching branches

Checking out another branch (CLI, Sourcetree, IDE) changes the files on disk, and hot-reload picks them up. The Git hook `.husky/post-checkout` handles the rest while the dev stack is running:

- dependencies or `docker/*` differ between the branches → rebuilds and recreates the containers (`up -d --build --renew-anon-volumes`, so `node_modules` is refreshed too),
- `backend/migrations/versions/` differs → runs `alembic upgrade head`,
- the new branch lacks a migration the previous one had → prints a warning: the database may be ahead of the code; downgrade on the previous branch or reset the database (`make clean-volumes && make dev`).

The hook is installed by Husky: run `npm install` once in the project root (it sets `core.hooksPath`). It does nothing when the dev stack isn't running; set `HUSKY=0` to skip it. To check it works, switch to a branch whose dependencies or migrations differ — the hook's `[post-checkout]` lines appear in the terminal or in Sourcetree's command output.

### Production deployment

When the app is served from a real domain, put a TLS-terminating reverse proxy (e.g. Caddy or nginx) in front of it: route `/auth`, `/todos`, `/users`, `/groups` and `/uploads` to the backend (port 8000) and everything else to the frontend (port 4200) — with one exception: `/todos` is also the Angular page, so a browser navigation to it (`Accept: text/html` — a refresh, a bookmark, a link) must go to the frontend, otherwise it gets the API's JSON (see the Caddyfile below).

`docker-compose.yml` publishes every port on `127.0.0.1` only (backend 8000, frontend 4200, MailHog 1025/8025, PostgreSQL 5433, pgAdmin 5050), so run the proxy on the host and point it at `127.0.0.1:8000` / `127.0.0.1:4200`; nothing is reachable from outside without it. To open pgAdmin or MailHog on the server, use an SSH tunnel (e.g. `ssh -L 5050:127.0.0.1:5050 <user>@<server>`).

Set these in `docker/docker.prod.env` (same variables as `docker/docker.env.example`, plus the ones below):

- `API_URL` — the site origin (e.g. `https://todo.example.com`); baked into the frontend image at build time.
- `SECURE_COOKIES=True`.
- `ALLOWED_HOSTS`, `CORS_ORIGINS` and `FRONTEND_URL` — the domain. For the native mobile apps also add `capacitor://localhost,https://localhost` to `CORS_ORIGINS`.
- `FORWARDED_ALLOW_IPS` — the Docker network range (e.g. `172.16.0.0/12`), so rate limiting sees real client IPs.
- `NG_ALLOWED_HOSTS` — the domain plus `localhost,127.0.0.1` (e.g. `todo.example.com,localhost,127.0.0.1`): the Angular SSR server only renders for those hostnames and answers 400 to any other `Host` / `X-Forwarded-Host`. Without it every page silently falls back to client-side rendering, which Angular will turn into a 400 in a future version.
- `NG_TRUST_PROXY_HEADERS` (default `x-forwarded-host,x-forwarded-proto,x-forwarded-for`) — the `X-Forwarded-*` headers the proxy may send; any other one also makes SSR fall back to client-side rendering.
- `USE_MAILHOG=false` and `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` — a real SMTP server for verification and password-reset emails.

Caddy example (`/etc/caddy/Caddyfile`; Caddy obtains the TLS certificate itself):

```caddy
todo.example.com {
	encode zstd gzip
	# HSTS belongs here, at the TLS-terminating proxy (the SSR server doesn't set it).
	header Strict-Transport-Security "max-age=31536000"

	# /todos is both an API route and the Angular page. Browser navigations
	# (Accept: text/html) go to the frontend, API calls to the backend.
	@todosPage {
		path /todos
		header Accept *text/html*
	}
	handle @todosPage {
		reverse_proxy 127.0.0.1:4200
	}

	@api path /auth /auth/* /todos /todos/* /users /users/* /groups /groups/* /uploads/*
	handle @api {
		reverse_proxy 127.0.0.1:8000
	}

	handle {
		reverse_proxy 127.0.0.1:4200
	}
}
```

The `handle` blocks are tried in this order and only the first match runs, so `@todosPage` must stay above `@api`. Angular's `HttpClient` sends `Accept: application/json, text/plain, */*`, so API calls never match it. After editing, check and apply the config with `caddy validate --config /etc/caddy/Caddyfile` and `sudo systemctl reload caddy`; the deploy smoke test (below) fails if `/todos` doesn't return HTML.

**Service worker (PWA).** The production build ships the Angular service worker (`ngsw-worker.js`, configured in `frontend/ngsw-config.json`). After each deploy, open tabs download the new version in the background and show an "Update available — Reload" toast, so for a while some users run the previous frontend against the new backend: keep API changes backward compatible for one release. The SSR server already sends `Cache-Control: no-cache` for `ngsw-worker.js`, `ngsw.json` and `manifest.webmanifest`; a proxy in front must not cache them either. **Kill switch:** if a release ships a broken service worker, make `/ngsw.json` return 404: add `handle /ngsw.json { respond 404 }` to the Caddyfile **above** the other `handle` blocks (a bare `respond /ngsw.json 404` doesn't work — `handle` blocks run first) and reload Caddy. Every client's service worker then deletes its caches and unregisters itself on its next check. Remove the rule once a fixed release is deployed.

```bash
# Production secrets live in docker/docker.prod.env (never committed)
make prod

# Check status
make status

# Monitoring
docker stats
```

### Continuous deployment (GitHub Actions)

`.github/workflows/deploy.yml` runs after the `CI` workflow succeeds on a push to `develop` (PR runs never deploy):

1. **build** — on a native ARM runner (`ubuntu-24.04-arm`, because the production server is ARM64; switch it to `ubuntu-latest` for an x86_64 server) builds the production backend and frontend images and pushes them to GHCR as `ghcr.io/<owner>/<repo>-backend:<commit sha>` and `...-frontend:<commit sha>`. The frontend gets `API_URL` from the `PUBLIC_URL` variable, so `API_URL` in `docker.prod.env` only matters for `make prod`.
2. **deploy** — connects to the server over SSH, checks out the same commit in the server's clone (`git checkout --detach <sha>`, so `docker-compose.yml` and the `Makefile` match the images) and runs `make deploy`, which pulls the images, dumps the database with `make backup-db STACK=prod` (see [Database Backup and Restore](#database-backup-and-restore)) and records that dump and the schema revision in `.deploy/` on the server, runs `alembic upgrade head` with the new backend image, recreates the containers (`up -d --no-build --wait`, needs Docker Compose v2) and keeps the 3 newest releases of each image. The job's short-lived `GITHUB_TOKEN` is used for `docker login ghcr.io` and logged out afterwards, so the server needs no registry credentials.
3. **smoke test** — `GET <PUBLIC_URL>/login` (frontend) and `GET <PUBLIC_URL>/auth/health` (backend and database; under `/auth` so the reverse proxy already routes it) must both return 2xx, and `GET <PUBLIC_URL>/todos` with `Accept: text/html` must return HTML (the reverse proxy sends page navigations to `/todos` to the frontend, see [Production deployment](#production-deployment)). When it passes, the SHA is saved on the server as the last good release (`.deploy/release`).
4. **automatic rollback** — if the deploy step or the smoke test fails, the job puts back the last good release: `make deploy-rollback-db` restores the dump taken just before this deploy's migrations — only if they changed the schema revision, otherwise the data is left alone — then the server checks out the previous SHA, runs `make deploy` for it and the smoke test runs again. The job still fails, with the rolled-back SHA in its summary. Restoring the dump loses whatever was written between the migration and the rollback (a minute or two, while the site was failing anyway). The first deploy after this was introduced takes the commit checked out on the server as the last good release.

Deploys never run in parallel. **Manual rollback:** Actions → Deploy → _Run workflow_ with `sha` set to the full commit SHA of an earlier release (its images are already in GHCR, nothing is rebuilt). This does not undo migrations: if the newer release changed the schema, restore a dump first (`make restore-db STACK=prod BACKUP=...`, below). With `sha` empty, _Run workflow_ builds and deploys the selected branch.

**One-time setup**

On the server (the clone that already runs `make prod`, with `docker/docker.prod.env` in place):

```bash
# Key pair used only by GitHub Actions; the deploy user must be in the docker group
ssh-keygen -t ed25519 -N "" -C github-deploy -f ~/.ssh/github_deploy
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/github_deploy        # -> SSH_PRIVATE_KEY secret, then delete this file
# -> SSH_KNOWN_HOSTS secret: the server's own host keys, labelled with the name(s)
#    you put in SSH_HOST (for a non-22 port use [host]:port instead)
for f in /etc/ssh/ssh_host_*_key.pub; do echo "todo.example.com,203.0.113.10 $(cut -d' ' -f1,2 "$f")"; done
```

(`ssh-keyscan <host>` from your own machine works too, except with the Windows OpenSSH build, which fails against OpenSSH 9.x servers with `choose_kex: unsupported KEX method`.)

`git fetch` must work non-interactively in the clone (public repo, or a read-only deploy key for a private one). From now on deploy through the workflow rather than `make prod`, which rebuilds the images locally.

In GitHub → Settings → Secrets and variables → Actions add the secrets and **repository** variables below (the build job needs `PUBLIC_URL` and runs outside any environment). The deploy job runs in the `production` environment, created on the first run; in Settings → Environments you can limit it to `develop` or add required reviewers, and keep the secrets there instead of at repository level.

| Name              | Kind     | Value                                                                 |
| ----------------- | -------- | --------------------------------------------------------------------- |
| `SSH_PRIVATE_KEY` | secret   | Private key generated above                                           |
| `SSH_KNOWN_HOSTS` | secret   | Host key lines generated above                                        |
| `SSH_HOST`        | variable | Server hostname or IP                                                 |
| `SSH_USER`        | variable | SSH user that owns the clone                                          |
| `DEPLOY_PATH`     | variable | Absolute path of the clone on the server                              |
| `PUBLIC_URL`      | variable | Site origin without a trailing slash, e.g. `https://todo.example.com` |
| `SSH_PORT`        | variable | Optional, defaults to `22`                                            |

Only the key material is secret. Keep `SSH_HOST` and `SSH_USER` as variables: GitHub masks every secret value in all logs, so a secret holding the domain or the repo owner's name hides the site URL and image names (`https://***`) and stops the environment URL from being shown.

Dependency updates come from Dependabot (`.github/dependabot.yml`): one grouped PR per ecosystem each week for minor/patch updates, separate PRs for majors (ignored: frontend majors — run `ng update` by hand — and `@types/node` / `typescript` majors in `e2e/`). In the backend, `pytest*` packages are grouped together (their version ranges depend on each other) and `ruff` updates get their own PR, since new ruff versions add lint rules. Merging one deploys it like any other change.

### Database Backup and Restore

```bash
# Backup to backups/<stack>-<UTC timestamp>.dump (pg_dump custom format, mode 600).
# Keeps the newest 10 per stack (BACKUP_KEEP=..., BACKUP_DIR=... to change).
make backup-db               # dev stack
make backup-db STACK=prod    # production; `make deploy` runs this before every migration

# Restore a dump: stops backend and frontend, then replaces the whole public schema
# with the dump in one transaction (a broken dump leaves the database untouched).
make restore-db BACKUP=backups/dev-20260101T120000Z.dump
make restore-db STACK=prod BACKUP=backups/prod-20260101T120000Z.dump
# ...then start the app again: `make dev`, or redeploy the matching release in production
```

`backups/` is ignored by git and by the Docker build context. The dumps contain the database only: avatars live in the `backend_uploads` Docker volume and are not backed up. These dumps stay on the same machine as the database, so they protect against a bad migration or deploy, not against losing the server — [Off-server backups](#off-server-backups) covers that.

### Off-server backups

`.github/workflows/backup.yml` runs every night (02:23 UTC) and on demand (Actions → Backup → _Run workflow_). Over SSH, with the same key and variables as the deploy, it runs `make backup-db STACK=prod` on the server (so the server also gets a daily dump in `backups/`), streams the dump back, encrypts it with [age](https://age-encryption.org) and stores it as a workflow artifact `db-backup-prod-<timestamp>` for 90 days (GitHub's maximum). The repository is public and any signed-in GitHub user can download its artifacts, so only the encrypted file is ever stored; it can be decrypted only with your private key.

**One-time setup**

1. Install age on your own machine (`winget install FiloSottile.age`, `brew install age` or `apt install age`) and generate a key pair:

   ```bash
   age-keygen -o todo-backup-key.txt   # prints "Public key: age1..."
   ```

   `todo-backup-key.txt` is the **private** key. Keep it out of the repository and off the server — e.g. in a password manager plus an offline copy. Without it the backups cannot be decrypted.

2. In GitHub → Settings → Secrets and variables → Actions → **Variables**, add `BACKUP_AGE_RECIPIENT` = the public key (`age1...`). The workflow also reads `SSH_HOST`, `SSH_USER`, `SSH_PORT`, `DEPLOY_PATH` (variables) and `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS` (secrets) from [Continuous deployment](#continuous-deployment-github-actions); it has no environment, so those must be repository-level, not only in the `production` environment.
3. Run it once by hand (Actions → Backup → _Run workflow_) and check the run summary lists the artifact.

**Restoring from an off-server backup**

```bash
# 1. Download the artifact from the Backup run (Actions → Backup → run → Artifacts) and unzip it, then decrypt:
age --decrypt --identity todo-backup-key.txt --output prod-20260101T022300Z.dump prod-20260101T022300Z.dump.age

# 2. Copy the dump to the server and restore it there (see "Database Backup and Restore" above)
scp prod-20260101T022300Z.dump <user>@<server>:<DEPLOY_PATH>/backups/
ssh <user>@<server> 'cd <DEPLOY_PATH> && make restore-db STACK=prod BACKUP=backups/prod-20260101T022300Z.dump'
# 3. Redeploy the matching release: Actions → Deploy → Run workflow
```

GitHub emails you when a scheduled run fails. It also pauses scheduled workflows in public repositories after 60 days without any repository activity; re-enable it in the Actions tab if that happens.

## 🗄️ Database Management (Alembic)

The project uses **Alembic** for managing database migrations. This allows for versioning the database schema and making changes easily.

### Basic commands

All commands should be executed from the `backend/` directory.

```bash
# 1. Create a new migration (after modifying SQLAlchemy models)
alembic revision --autogenerate -m "change description"

# 2. Run pending migrations (update db)
alembic upgrade head

# 3. Rollback the last migration
alembic downgrade -1

# 4. Check current db version
alembic current
```

### Usage with Docker

If the app runs in containers, commands must be executed within the backend container:

```bash
make migrate   # alembic upgrade head in the backend container

# other Alembic commands:
docker-compose -f docker/docker-compose.yml --env-file docker/docker.env exec backend alembic current
```

---

## 📁 Project Structure

```
todo-app/
├── backend/                 # Python FastAPI backend
│   ├── AGENTS.md            # Backend rules for contributors and AI agents
│   ├── config/              # database, auth, api_messages, password validation
│   ├── i18n/                # en.json, pl.json - email texts
│   ├── templates/email/     # Jinja2 email templates (layout, shared blocks, one .html + .txt per email)
│   ├── models/              # SQLAlchemy models (user, todo, group, refresh_token) + Pydantic schemas
│   ├── routes/              # API routes (auth, users, todos, groups)
│   ├── services/            # Business logic (auth, email)
│   ├── migrations/          # Alembic migrations
│   ├── openapi/             # export_openapi.py + the exported openapi.json (input of `npm run generate-api`)
│   ├── scripts/             # seed.py - sample data for development
│   ├── tests/               # Pytest suite
│   ├── main.py              # Application entrypoint
│   ├── requirements.txt     # Python runtime dependencies (production image)
│   ├── requirements-dev.txt # + pytest, ruff, httpx (CI, dev container)
│   ├── ruff.toml            # Ruff lint/format configuration
│   └── .env                 # Environment variables (non-Docker setup)
├── frontend/                # Angular frontend
│   ├── AGENTS.md            # Frontend rules for contributors and AI agents
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/        # Guards, interceptors, services, store/ (AuthStore), config, models, tokens, utils
│   │   │   ├── features/    # auth/, groups/, todos/ (components/ plus store/ or services/), legal/ (privacy policy)
│   │   │   ├── shared/
│   │   │   │   ├── ui/              # Design system primitives (badge, empty-state, form-field, icon-button)
│   │   │   │   ├── global-styling/  # SCSS partials, incl. _tokens.scss (design tokens)
│   │   │   │   ├── components/      # Shared components
│   │   │   │   ├── pipes/
│   │   │   │   └── utils/
│   │   │   └── layout/      # Layout components
│   │   ├── libs/generated-api/  # Generated OpenAPI client (@api)
│   │   ├── assets/i18n/     # en.json, pl.json
│   │   └── server.ts        # SSR server (security headers, CSP)
│   ├── public/              # Served as-is: favicon.ico, icons/ (app icons, icon.svg = master, splash/ = iOS launch screens), screenshots/ (install dialog), manifest.webmanifest, theme-init.js
│   ├── scripts/             # generate-icons.mjs + icons/ (masters of the full-bleed icons and the "New task" shortcut icon)
│   ├── ngsw-config.json     # Service worker: what it caches (app shell only) and which navigations it serves
│   ├── angular.json
│   ├── package.json
│   └── ...
├── docs/                    # Design notes and plans (e.g. pwa-plan.md)
├── docker/                  # Dockerfiles, docker-compose files (incl. the e2e stack), docker.env.example
├── e2e/                     # Playwright end-to-end tests (fixtures/, pages/, tests/, AGENTS.md)
├── .github/workflows/       # CI, CD and nightly off-server DB backups (GitHub Actions)
├── .husky/                  # Git hooks: pre-commit (lint-staged), post-checkout (syncs the dev stack)
├── .dockerignore            # Keeps host node_modules out of image builds
├── Makefile                 # Entry point for all dev tasks
├── AGENTS.md                # Repo-wide guidelines for contributors and AI agents (area rules in backend/, frontend/, e2e/)
├── LICENSE                  # MIT
├── README.md                # This file
└── .gitignore
```

## ✉️ API Message System

The application uses a centralized messaging structure between backend and frontend:

1.  **Backend (`api_messages.py`)**: All codes (e.g., `AUTH_LOGIN_SUCCESS`) are defined as an Enum.
    - When adding a new endpoint, append its code here.
    - Use `api_error()` for exceptions and `api_success()` for successes.
    - Always return appropriate HTTP status codes (200, 201, 400, 401, 403, 404).

2.  **Frontend (Toasts)**: `notificationInterceptor` automatically catches these codes and displays toasts.
3.  **Translations**: A map from codes to text content (PL/EN) sits in `frontend/src/assets/i18n/`.

## 🎨 Design System

The frontend has a small design system layered on top of the PrimeNG (PrimeUIX Aura) theme.

**Design tokens** — `frontend/src/app/shared/global-styling/_tokens.scss`

- Colors always come from the theme: semantic `--p-primary-*`, `--p-surface-*`, `--p-text-color`, `--p-text-muted-color`, `--p-content-border-color` and palettes `--p-{red,blue,amber,...}-{50..950}`.
- `--app-*` tokens hold only what the theme doesn't define: font sizes and weights (`--app-text-*`, `--app-font-*`), spacing (`--app-space-1..8`), safe-area insets for notched screens (`--app-safe-top/right/bottom/left`), radii (`--app-radius-*`), shadows (`--app-shadow-*`, dark variants under `.dark`), focus ring, transitions and glass panels.
- Use tokens in component styles instead of hardcoded values.

**Shared UI primitives** — `frontend/src/app/shared/ui/`

| Primitive               | Usage                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `button[appIconButton]` | Square icon button; `variant` (`ghost` / `primary` / `danger`), `size` (`sm`–`xl`), `reveal` (visible on container hover) |
| `app-badge`             | Small label / pill (e.g. group badge on a todo)                                                                           |
| `app-empty-state`       | Empty list / info state with icon or emoji, heading and description                                                       |
| `app-form-field`        | Label (with optional icon) + projected control and error messages; presentational only — validation stays in the form     |

Before adding a new ad-hoc button, badge or empty state, check whether one of these fits.

## 🔧 Development

### Adding new features

1. **Backend**: Add a new endpoint in `routes/`, model in `models/`
2. **Frontend**: Add components and a store under `features/<feature>/`; reuse `shared/ui` primitives and design tokens
3. **Database**: Update SQLAlchemy model and generate a migration

### Best Practices

- **Backend**: Use Pydantic for validation, SQLAlchemy for queries
- **Frontend**: Rely on OnPush change detection, always provide `track` in `@for` loops
- **Git**: Small commits in the [Conventional Commits](https://www.conventionalcommits.org/) format (see [Contributing](#-contributing))
- **Tests**: Cover key business logic with tests

### Useful Commands

```bash
# Backend
uvicorn main:app --reload          # Development server
alembic revision --autogenerate    # Database migrations

# Frontend
ng generate component component-name  # Skeleton for a new component
ng generate service service-name      # Skeleton for a new service
npm run generate-api                  # Regenerate API types (@api) after backend changes
                                      # runs on the host: needs Python + backend deps, backend/.env and Java
npm run generate-icons                # Regenerate favicon.ico, app icons, shortcut icon and iOS launch screens (+ their <link> tags in src/index.html) after editing the master SVGs

# Docker
docker-compose logs -f service_name   # View container logs
docker-compose exec backend bash      # Shell into container
```

## 🤝 Contributing

The full rules are in [AGENTS.md](AGENTS.md) (_Git — commits, branches, PRs_). In short:

1. Create a branch from `develop` named `<type>/<short-kebab-description>` (e.g. `fix/refresh-cookie-path`); never commit directly to `develop`
2. Commit using Conventional Commits: `type(scope): subject` (e.g. `fix(auth): expire the old refresh cookie`), one logical change per commit
3. Run the checks CI runs (see [Continuous Integration](#continuous-integration-github-actions)) and update this README when your change makes it wrong
4. Open a Pull Request against `develop` with a `## Summary` and a `## Test plan`

Merging to `develop` deploys to production (see [Continuous deployment](#continuous-deployment-github-actions)).

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

⭐ If you like this project, please consider giving it a star on GitHub!
