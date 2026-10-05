# Todo App - Full-Stack Application

Todo App built with **Angular 21** + **Python FastAPI** + **PostgreSQL** using **Docker**.

## ✅ Project Status - Fully Functional!

🎉 **Application is working!** All components have been implemented and containerized.

### ✅ Completed Features:

- ✅ **FastAPI Backend** - REST API with full CRUD, PostgreSQL, Pydantic
- ✅ **Angular 21 Frontend** - Signals, Control Flow, Standalone Components, SSR
- ✅ **Docker** - Full containerization, multi-stage builds, production ready
- ✅ **Database** - PostgreSQL with persistent storage
- ✅ **Backend Tests** - 89 unit and integration tests with coverage (min. 80% enforced)
- ✅ **E2E Tests** - Playwright tests of the full stack (register, verify email via MailHog, login, tasks)
- ✅ **CI** - GitHub Actions runs lint, tests, builds and E2E tests on every push and pull request
- ✅ **Simple Local Setup** - Single database for development and local testing

### 🚀 How to Run (3 Simple Steps):

```bash
git clone https://github.com/agencik007/todo-app.git
cd todo-app
cp docker/docker.env.example docker/docker.env   # then adjust the values (at least SECRET_KEY)
make dev
```

> [!IMPORTANT]
> `docker/docker.env` is required — `docker-compose.yml` has no hardcoded credentials and refuses to start without `POSTGRES_*`, `PGADMIN_*` etc. `make dev` loads this file automatically; `make prod` loads `docker/docker.prod.env` instead (never committed). Compose interpolates `$` in that file; write a literal dollar sign as `$$`.
>
> Replace `SECRET_KEY` with a random value of at least 32 characters (`openssl rand -hex 32`) — the placeholder from the example file is rejected and the backend won't start. Docker does not need a `backend/.env`; `ALLOWED_HOSTS` and `CORS_ORIGINS` default to localhost values in `docker-compose.yml` and can be overridden in `docker/docker.env`.

Open: http://localhost:4200

**Alternatively using Makefile:**

```bash
make dev      # Development mode
make prod     # Production mode
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

**Note:** MailHog is part of `docker-compose.yml`, so it also starts with `make prod`. In production set `USE_MAILHOG=false` and the `SMTP_*` variables so emails go through a real SMTP server.

---

## 📋 Table of Contents

- [🎯 Project Description](#-project-description)
- [🛠 Technologies](#-technologies)
- [📋 Prerequisites](#-prerequisites)
- [🚀 Installation](#-installation)
- [⚙️ Configuration](#️-configuration)
- [🏃‍♂️ Running the app](#️-running-the-app)
- [📚 API Documentation](#-api-documentation)
- [🧪 Testing](#-testing)
- [🚀 Quick Start](#-quick-start)
- [🐳 Docker - Detailed Documentation](#-docker---detailed-documentation)
- [🗄️ Database Management (Alembic)](#️-database-management-alembic)
- [📁 Project Structure](#-project-structure)
- [✉️ API Message System](#️-api-message-system)
- [🎨 Design System](#-design-system)
- [🔧 Development](#-development)

## 🎯 Project Description

A simple Todo application for task management with full CRUD (Create, Read, Update, Delete) support. The backend written in FastAPI provides a REST API, while the frontend in Angular 21 offers a modern user interface. Data is stored in a PostgreSQL database.

### Features

- ✅ Create, edit, complete and delete tasks; drag & drop reordering
- ✅ Groups for organizing tasks
- ✅ User accounts: registration, email verification, password reset, avatar
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
- **Uvicorn** - ASGI server

### Frontend

- **Angular 21** - frontend framework (standalone components, signals, SSR)
- **TypeScript** - programming language
- **@ngrx/signals** - signal-based stores (`AuthStore`, `TodoStore`)
- **RxJS** - reactive programming
- **OpenAPI Generator** - generates TypeScript types from backend
- **PrimeNG** - UI component library (Aura theme)
- **Design system** - design tokens + shared UI primitives on top of PrimeNG (see [Design System](#-design-system))

### DevOps

- **Docker** - containerization
- **Docker Compose** - container orchestration
- **PostgreSQL** - database in container
- **GitHub Actions** - CI (see [Continuous Integration](#continuous-integration-github-actions))
- **Playwright** - end-to-end tests (see [End-to-End Tests](#end-to-end-tests-playwright))

## 📋 Prerequisites

Before starting, ensure you have installed:

- **Python 3.12+** - [Download](https://www.python.org/downloads/)
- **Node.js 20.19+ or 22.12+** (required by Angular 21) - [Download](https://nodejs.org/)
- **PostgreSQL** - [Download](https://www.postgresql.org/download/)
- **Docker Desktop** - [Download](https://www.docker.com/products/docker-desktop/)
- **Git** - [Download](https://git-scm.com/)

## 🚀 Installation

### 1. Clone the repository

```bash
git clone <repository-url>
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

# Install dependencies
pip install -r requirements.txt
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

If you prefer using Docker, the entire application can be run in containers — see [Option 2](#option-2-running-with-docker) below.

## 🏃‍♂️ Running the app

### Option 1: Running without Docker

#### 1. Backend

On the **first run, against an empty database** (created in [4. PostgreSQL Database](#4-postgresql-database)), you do **not** need to (and should not) run `alembic upgrade head` manually — just start the backend:

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
> On startup the app creates all tables itself from the SQLAlchemy models (`Base.metadata.create_all`) and marks the database as being on the latest Alembic revision (`_ensure_alembic_stamped()` in `backend/main.py`). The first migration in the repo (`658f4b511d04_initial_schema_camel_case`) is intentionally empty — Docker works the same way (`Dockerfile.backend` also just runs `uvicorn`, with no `alembic upgrade head` before it starts).
>
> Only run `alembic upgrade head` once the database already exists and has run at least once (e.g. after a `git pull` that added new migration files) — it then applies just the incremental changes.

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

```bash
# One-time: create the env file used by docker-compose,
# then set SECRET_KEY in it (openssl rand -hex 32)
cp docker/docker.env.example docker/docker.env

# Start all services (hot-reload)
make dev
```

## 📚 API Documentation

After running the backend with `DEBUG=True`, API documentation is available at:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

> [!NOTE]
> With `DEBUG=False` (production) `/docs`, `/redoc` and `/openapi.json` are disabled. `make dev` sets `DEBUG=True` automatically.

### Available endpoints

| Prefix    | Description                                                            |
| --------- | ---------------------------------------------------------------------- |
| `/`       | Application status                                                     |
| `/health` | Health check                                                           |
| `/auth`   | Registration, login, token refresh, email verification, password reset |
| `/users`  | Current user's avatar and language preference                          |
| `/todos`  | Tasks CRUD and reordering                                              |
| `/groups` | Task groups CRUD                                                       |

All `/todos`, `/groups` and `/users` endpoints require an authenticated user with a verified email. The full, up-to-date list is in Swagger UI.

---

## 🧪 Testing

### Backend - Tests (Pytest)

The application has a comprehensive suite of tests (currently **89**), including API tests for Todo, Auth, and Groups. `pytest.ini` always measures coverage and fails the run below **80%**.

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

`e2e/` holds Playwright tests that drive the real app in Chromium: registration with email verification (the link is read from MailHog's API), login and logout, and creating, editing, completing, filtering and deleting tasks.

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
| `backend`  | `ruff check`, `ruff format --check` and the full `pytest` suite (with the coverage gate) against PostgreSQL 15 |
| `frontend` | `npm ci`, `npm run lint`, `npm run format:check` (Prettier) and `npm run build` (SSR + prerender)              |
| `e2e`      | Builds the production Docker images, starts `docker/docker-compose.e2e.yml` and runs the Playwright tests      |

To reproduce the backend job locally, format and lint with `ruff format` / `ruff check` in `backend/` (the pre-commit hook already does this for staged files) and run `make test-backend`. For the frontend job, run `npm run lint` and `npm run format:check` in `frontend/` (`npx prettier --write .` fixes formatting). For the e2e job, run `make test-e2e`; when it fails in CI, the HTML report (with traces and screenshots) is attached to the run as the `playwright-report` artifact.

When CI passes on a push to `develop`, `.github/workflows/deploy.yml` deploys that commit to production — see [Continuous deployment](#continuous-deployment-github-actions).

## 🚀 Quick Start

### Prerequisites

- **Docker Desktop** installed and running

### Step 1: Clone the repository

```bash
git clone <repository-url>
cd todo-app
```

### Step 2: Start the application (Docker)

```bash
# One-time: create the env file and adjust the values
# (at least SECRET_KEY: a random value of 32+ characters, e.g. openssl rand -hex 32)
cp docker/docker.env.example docker/docker.env

# Start all services
make dev
```

### Step 3: Access the app

Once started, open these in your browser:

- **📱 Frontend App**: http://localhost:4200
- **🔧 Backend API**: http://localhost:8000
- **📚 API Documentation**: http://localhost:8000/docs
- **📧 MailHog**: http://localhost:8025
- **🗄️ PgAdmin** (Database Manager): http://localhost:5050
  - Login: `PGADMIN_EMAIL` / `PGADMIN_PASSWORD` from `docker/docker.env`

---

## 🐳 Docker - Detailed Documentation

### Application Architecture in Docker

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │────│    Backend      │────│   PostgreSQL    │
│   (Angular)     │    │   (FastAPI)     │    │   (Alpine)      │
│   Port: 4200    │    │   Port: 8000    │    │   Port: 5433    │
│   Single Page   │    │   REST API      │    │   Persistent    │
│   Application   │    │   + Swagger     │    │   Volume        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │    PgAdmin (optional)   │
                    │    Database Management  │
                    │    Port: 5050          │
                    │    Web UI for PostgreSQL│
                    └─────────────────────────┘
```

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

# Clean up (remove containers and volumes)
make clean          # Removes containers and images
make clean-volumes  # WARNING: Deletes database data!
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
- **Server**: Uvicorn with 2 workers (production); `docker-compose.override.yml` switches it to `--reload` for development
- **Security**: Non-root user
- **Health checks**: Socket connection test

#### Dockerfile.frontend

- **Base**: Node.js 22 Alpine
- **Install**: `npm ci` (reproducible install from `package-lock.json`)
- **Build**: Angular CLI production build with SSR. The `API_URL` build arg (from `API_URL` in the env file, default `http://localhost:8000`) sets the URL the browser calls the API at; rebuild the image after changing it
- **Server**: Angular SSR Node server (`dist/frontend/server/server.mjs`), which also sets the security headers and Content Security Policy (`frontend/src/server.ts`)
- **Development**: `docker-compose.override.yml` runs `ng serve` with hot-reload instead

#### docker-compose.yml

- **Network**: Isolated todo-network
- **Volumes**: Persistent PostgreSQL data
- **Health checks**: Service dependencies
- **Ports**: Port mapping host:container
- **Images**: backend and frontend are tagged `${BACKEND_IMAGE:-todo-backend}:${IMAGE_TAG:-local}` / `${FRONTEND_IMAGE:-todo-frontend}:${IMAGE_TAG:-local}`; local builds use the defaults, `make deploy` points them at the GHCR images

### Troubleshooting Docker

#### Problem: Port is already in use

```bash
# Check what process uses the port
netstat -ano | findstr :4200

# Change port in docker-compose.yml
ports:
  - "3000:4200"  # Use 3000 instead of 4200
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
# Check connection
docker-compose exec db pg_isready -U todo_user -d todo_db

# Reset database
docker-compose down -v  # WARNING: Deletes all data!
docker-compose up --build db
```

#### Problem: Frontend not connecting to backend

```bash
# Check if backend works
curl http://localhost:8000/health

# Check Docker network
docker-compose exec frontend curl http://backend:8000/health
```

### Development workflow

1. **Code**: Edit files locally
2. **Build**: `docker-compose build` (only when modifying a Dockerfile)
3. **Run**: `docker-compose up` (automatically reloads code)
4. **Test**: Open http://localhost:4200 in the browser
5. **Debug**: `docker-compose logs -f` for real-time logs

### Production deployment

When the app is served from a real domain, put a TLS-terminating reverse proxy (e.g. Caddy or nginx) in front of it: route `/auth`, `/todos`, `/users`, `/groups` and `/uploads` to the backend (port 8000) and everything else to the frontend (port 4200). In `docker/docker.prod.env` set `API_URL` to the site origin (e.g. `https://todo.example.com`), `SECURE_COOKIES=True`, `ALLOWED_HOSTS` and `CORS_ORIGINS`/`FRONTEND_URL` to the domain, and `FORWARDED_ALLOW_IPS` to the Docker network range so rate limiting sees real client IPs.

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
2. **deploy** — connects to the server over SSH, checks out the same commit in the server's clone (`git checkout --detach <sha>`, so `docker-compose.yml` and the `Makefile` match the images) and runs `make deploy`, which pulls the images, dumps the database with `make backup-db STACK=prod` (see [Database Backup and Restore](#database-backup-and-restore)), runs `alembic upgrade head` with the new backend image, recreates the containers (`up -d --no-build --wait`, needs Docker Compose v2) and keeps the 3 newest releases of each image. The job's short-lived `GITHUB_TOKEN` is used for `docker login ghcr.io` and logged out afterwards, so the server needs no registry credentials.
3. **smoke test** — `GET <PUBLIC_URL>/login` must return 2xx.

Deploys never run in parallel. **Rollback:** Actions → Deploy → _Run workflow_ with `sha` set to the full commit SHA of an earlier release (its images are already in GHCR, nothing is rebuilt). With `sha` empty, _Run workflow_ builds and deploys the selected branch.

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

Dependency updates come from Dependabot (`.github/dependabot.yml`): one grouped PR per ecosystem each week for minor/patch updates, separate PRs for majors (ignored: frontend majors — run `ng update` by hand — and `@types/node` / `typescript` majors in `e2e/`). Merging one deploys it like any other change.

### Database Backup and Restore

```bash
# Backup to backups/<stack>-<UTC timestamp>.dump (pg_dump custom format, mode 600).
# Keeps the newest 10 per stack (BACKUP_KEEP=..., BACKUP_DIR=... to change).
make backup-db               # dev stack
make backup-db STACK=prod    # production; `make deploy` runs this before every migration

# Restore a dump (replaces the objects it contains). Production: use docker/docker.prod.env
docker-compose -f docker/docker-compose.yml --env-file docker/docker.env exec -T db \
  sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' \
  < backups/dev-20260101T120000Z.dump
```

`backups/` is ignored by git and by the Docker build context. The dumps stay on the same machine as the database, so they protect against a bad migration or deploy, not against losing the server — copy them elsewhere for that.

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
│   ├── config/              # database, auth, api_messages, password validation
│   ├── models/              # SQLAlchemy models (user, todo, group, refresh_token) + Pydantic schemas
│   ├── routes/              # API routes (auth, users, todos, groups)
│   ├── services/            # Business logic (auth, email)
│   ├── migrations/          # Alembic migrations
│   ├── tests/               # Pytest suite
│   ├── main.py              # Application entrypoint
│   ├── requirements.txt     # Python dependencies
│   └── .env                 # Environment variables (non-Docker setup)
├── frontend/                # Angular frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/        # Guards, interceptors, services, stores (AuthStore)
│   │   │   ├── features/    # auth/, groups/, todos/ (each with components/, store/)
│   │   │   ├── shared/
│   │   │   │   ├── ui/              # Design system primitives (badge, empty-state, form-field, icon-button)
│   │   │   │   ├── global-styling/  # SCSS partials, incl. _tokens.scss (design tokens)
│   │   │   │   ├── components/      # Shared components
│   │   │   │   └── pipes/
│   │   │   └── layout/      # Layout components
│   │   ├── libs/generated-api/  # Generated OpenAPI client (@api)
│   │   ├── assets/i18n/     # en.json, pl.json
│   │   └── server.ts        # SSR server (security headers, CSP)
│   ├── angular.json
│   ├── package.json
│   └── ...
├── docker/                  # Dockerfiles, docker-compose files (incl. the e2e stack), docker.env.example
├── e2e/                     # Playwright end-to-end tests (fixtures/, pages/, tests/)
├── .github/workflows/       # CI and CD (GitHub Actions)
├── .dockerignore            # Keeps host node_modules out of image builds
├── Makefile                 # Entry point for all dev tasks
├── AGENTS.md                # Guidelines for contributors and AI agents
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
- `--app-*` tokens hold only what the theme doesn't define: font sizes and weights (`--app-text-*`, `--app-font-*`), spacing (`--app-space-1..8`), radii (`--app-radius-*`), shadows (`--app-shadow-*`, dark variants under `.dark`), focus ring, transitions and glass panels.
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
- **Git**: Commit often with descriptive messages
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

# Docker
docker-compose logs -f service_name   # View container logs
docker-compose exec backend bash      # Shell into container
```

## 🤝 Contributing

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License. See the LICENSE file for details.

## 📞 Contact

Got questions? Feel free to reach out!

---

⭐ If you like this project, please consider giving it a star on GitHub!
