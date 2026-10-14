# Agent Guidelines — Todo App (FastAPI + Angular)

> Guidelines for AI coding agents (Claude Code, Cursor, Codex, Copilot Agents, etc.) and human contributors working on this repository. This root file holds what applies everywhere: stack, commands, workflow, Git, the backend ↔ frontend contract and AI-specific configuration. Area-specific rules live next to the code.

## Where the rules live

| File                                       | Read it when you work on                                         |
| ------------------------------------------ | ---------------------------------------------------------------- |
| `AGENTS.md` (this file)                    | Anything — always applies                                        |
| [`backend/AGENTS.md`](backend/AGENTS.md)   | FastAPI code, API messages, pytest, database models, Alembic     |
| [`frontend/AGENTS.md`](frontend/AGENTS.md) | Angular components, stores, forms, styling and the design system |
| [`e2e/AGENTS.md`](e2e/AGENTS.md)           | Playwright tests, fixtures and page objects                      |

Agents that load nested `AGENTS.md` files automatically pick them up when working in that directory; otherwise open the matching file before changing code there. A change that spans areas (e.g. a new endpoint plus its UI) needs every matching file. Each rule lives in exactly one file — don't copy rules between them.

---

## Stack (TL;DR)

- **Backend:** FastAPI + SQLAlchemy + Alembic + PostgreSQL, `backend/`
- **Frontend:** Angular 21 + PrimeNG + signal-based stores (`@ngrx/signals`), `frontend/`
- **Dev infra:** Docker Compose, everything runs through the root `Makefile`
- **PWA:** the production frontend registers the Angular service worker, so after a deploy some users keep running the previous frontend until they reload — keep API changes backward compatible for one release (add fields first, remove them a release after the frontend stops using them).
- **OpenAPI:** backend generates the schema → frontend consumes generated types from `@api` in `frontend/src/libs/generated-api/`

### Dev URLs

- Frontend: `http://localhost:4200`
- API: `http://localhost:8000`
- API docs (Swagger): `http://localhost:8000/docs`
- pgAdmin: `http://localhost:5050`

---

## Quick Commands

All major operations are managed via the root `Makefile`. Always prefer Docker-based commands (through `make` or `docker-compose exec`) over local ones — the project assumes a containerized toolchain.

**One-time setup:** `cp docker/docker.env.example docker/docker.env`, then set `SECRET_KEY` in it (32+ random characters; the placeholder is rejected). `docker-compose.yml` has no hardcoded credentials and refuses to start without this file. No `backend/.env` is needed for Docker — `ALLOWED_HOSTS`/`CORS_ORIGINS` have localhost defaults in the compose file.

**Dev vs prod stack:** `make dev` / `make prod` start the respective stack. All operational targets (`down`, `logs*`, `shell-*`, `migrate`, `test-backend`, `lint-frontend`, `status`, `clean*`) target the **dev** stack by default; add `STACK=prod` to target production (`docker/docker.prod.env`, never committed), e.g. `make logs STACK=prod`.

**Raw commands:** docker-compose always needs the env file. Below, `DC` means `docker-compose -f docker/docker-compose.yml --env-file docker/docker.env` (the dev stack must be running).

| Goal                                                         | Command                                                                       |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Dev environment (hot-reload, front+back+db+pgadmin+mailhog)  | `make dev`                                                                    |
| Prod environment                                             | `make prod`                                                                   |
| Deploy prebuilt images (CD runs it on the server)            | `make deploy IMAGE_TAG=<sha> BACKEND_IMAGE=... FRONTEND_IMAGE=...`            |
| Stop all services                                            | `make down`                                                                   |
| View logs                                                    | `make logs`, `make logs-backend`, `make logs-frontend`                        |
| Clean environment (containers, images, volumes)              | `make clean`                                                                  |
| Backend tests                                                | `make test-backend`                                                           |
| Single backend test                                          | `DC exec backend python -m pytest tests/test_filename.py::test_function_name` |
| Frontend lint                                                | `make lint-frontend`                                                          |
| Frontend tests                                               | None yet — `angular.json` has no `test` target                                |
| E2E tests (Playwright, full stack; stop the dev stack first) | `make test-e2e` — see [`e2e/AGENTS.md`](e2e/AGENTS.md)                        |
| Migrate to head                                              | `make migrate`                                                                |
| Database dump to `backups/` (`STACK=prod` for production)    | `make backup-db`                                                              |
| Restore a dump (replaces the schema; `STACK=prod` for prod)  | `make restore-db BACKUP=backups/<file>.dump`                                  |
| New migration (autogenerate)                                 | `DC exec backend alembic revision --autogenerate -m "description"`            |
| Regenerate API types after backend changes                   | `cd frontend && npm run generate-api` — on the host, see [OpenAPI](#openapi)  |
| Backend shell                                                | `make shell-backend`                                                          |
| Database shell                                               | `make shell-db`                                                               |

---

## Workflow — before you finish a task

1. **Backend:** if you changed models/schemas/routes → regenerate OpenAPI (`npm run generate-api`).
2. **Backend:** if you changed models → create an Alembic migration (`alembic revision --autogenerate`), review it, then run `make migrate`.
3. **Frontend:** run lint (`make lint-frontend`) before considering the task done.
4. **Tests:** if you touched backend logic → run `make test-backend`. The frontend has no unit test runner yet, so lint + `ng build` are the checks there. If you changed a user-facing flow (auth, todos, anything the e2e tests click through) → run `make test-e2e` and update the tests.
5. **i18n:** new API messages must have keys in both `frontend/src/assets/i18n/en.json` and `pl.json` under `API_MESSAGES`.
6. **CI:** `.github/workflows/ci.yml` runs `ruff check`, `ruff format --check`, `alembic upgrade head` + `alembic check` on an empty database, `pytest`, frontend lint + Prettier check (`npm run format:check`) + build, and the Playwright e2e tests against the production Docker images on every PR. Run the same checks locally before pushing, and update the workflow when you change the Python/Node versions in `docker/Dockerfile.*`. Every push to `develop` that passes CI is deployed to production by `.github/workflows/deploy.yml` (images to GHCR, then `make deploy` over SSH, which dumps the database and runs the migrations; if the deploy or the smoke test fails, the job restores that dump when the schema changed and redeploys the last good release) — a merge to `develop` is a release.
7. **Docs:** if your change is one of the triggers listed in [Keeping README.md up to date](#keeping-readmemd-up-to-date) → update `README.md` (and the matching `AGENTS.md`, if it affects agent workflow) **in the same change**.
8. **Git:** commit, branch and open the PR following [Git — commits, branches, PRs](#git--commits-branches-prs).

---

## Git — commits, branches, PRs

Every commit uses [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

Optional body explaining why the change was made.
```

- **Types:** `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `style`, `chore`, `ci`, `build`.
- **Scope** (optional, exactly one): `backend`, `frontend`, `auth`, `todos`, `groups`, `ds`, `docker`, `e2e`, `ci`, `security`, `readme`, `agents`. Pick the narrowest one that fits; omit it when the change spans the whole repo.
- **Subject:** English, imperative mood ("add", not "added"/"adds"), lowercase first letter, no trailing period, at most 72 characters including the prefix.
- **Body** (optional): separated from the subject by a blank line, wrapped at 72 characters, explains _why_ rather than restating the diff.
- **Breaking changes:** add `!` after the scope (`feat(auth)!: ...`) and a `BREAKING CHANGE:` footer describing the migration.
- **One logical change per commit.** Unrelated changes go into separate commits, even within one PR.

Good:

```
fix(security): return 404 instead of 403 for other users' todos/groups
test(e2e): add Playwright end-to-end tests and run them in CI
chore: drop dead Tailwind/PostCSS config
```

Bad:

```
- fixed bugs                                  # no type, past tense, says nothing
feat: add X fix: resolve Y docs: update Z     # several changes in one subject
Smooth out login avatar final fade phase      # no type
```

**Branches:** `<type>/<short-kebab-description>` (e.g. `fix/refresh-cookie-path`, `docs/commit-conventions`), always created from `develop`. Never commit directly to `develop`.

**Pull requests:** base `develop`; title in the same `type(scope): subject` format; description with a `## Summary` (what and why, as bullets) and a `## Test plan` (the checks you ran). Create them with `gh pr create --base develop`; where `gh` isn't installed, push the branch and open `https://github.com/agencik007/todo-app/compare/develop...<branch>?expand=1`.

---

## Project Structure

```
backend/
  AGENTS.md      # backend rules (FastAPI, tests, migrations)
  config/        # api_messages.py, database, auth, password validation
  models/        # SQLAlchemy models (user, todo, group, refresh_token) + schemas.py (Pydantic)
  routes/        # FastAPI endpoints
  services/      # business logic
  migrations/    # Alembic (remember to register models in env.py!)
  openapi/       # export_openapi.py + openapi.json (input of `npm run generate-api`)
  tests/         # pytest; conftest.py sets TESTING=1
  ruff.toml      # Ruff lint/format configuration
frontend/
  AGENTS.md      # frontend rules (Angular, design system, forms)
  public/        # served as-is: favicon.ico, icons/ (generated app icons; icons/icon.svg is a master), manifest.webmanifest
  ngsw-config.json # service worker config (PWA): app shell caching and navigation fallback
  scripts/       # generate-icons.mjs (`npm run generate-icons`) + icons/icon-maskable.svg master
frontend/src/app/
  core/          # guards, interceptors, services, tokens, store/ (AuthStore)
  features/      # auth/, groups/, todos/ (components/; groups and todos also have store/), legal/ (privacy policy)
  shared/        # ui/ (design system primitives), components, global-styling, pipes, utils
  layout/
docs/            # design notes and implementation plans (pwa-plan.md = PWA roadmap)
docker/          # Dockerfiles and docker-compose configurations (docker-compose.e2e.yml = e2e stack)
e2e/             # Playwright tests: fixtures/ (API, MailHog), pages/ (page objects), tests/; AGENTS.md = e2e rules
.github/workflows/ # CI, CD and backup.yml (nightly age-encrypted DB dump as an artifact); .github/dependabot.yml = dependency update PRs
.husky/          # Git hooks (Husky, installed by `npm install` in the root): pre-commit = lint-staged (Prettier + ESLint on staged frontend files, `ruff` on staged Python — these run on the host); post-checkout = rebuild/migrate the running dev stack after a branch switch
Makefile         # root entry point for all development tasks
```

---

## General Principles

- **DRY & KISS:** keep it simple, don't repeat yourself, don't add abstractions "just in case".
- **Docker-first:** assume all tools run inside containers. Even `alembic` goes through `docker-compose exec backend`.
- **Absolute paths:** when using tools, always prefer absolute paths over relative ones.

---

## OpenAPI

After changes to models, schemas, or routes, regenerate the OpenAPI models:

```bash
cd frontend
npm run generate-api
```

This produces TypeScript interfaces and enums in `frontend/src/libs/generated-api/`.

`backend/openapi/export_openapi.py` rewrites file upload fields from FastAPI's OpenAPI 3.1 `contentMediaType` to `format: binary` before writing `openapi.json`; without it the generator types uploads as `string` and drops the multipart `FormData`. Commit the regenerated files as they come out, including deletions of models that are no longer generated.

> **Exception to Docker-first:** this script can't run inside the containers — the frontend image (`node:22-alpine`) has no Python, no Java and no `backend/` directory. Run it on the host; it needs Python with `backend/requirements.txt` installed, a `backend/.env` (the app is imported to export the schema), and Java for `openapi-generator-cli`.

---

## AI Agent Configuration

### Claude Code — slash commands

Stored in `.claude/commands/`:

- `/edit-forms` — brings every form in line with Signal Forms + the Angular Style Guide (`.claude/commands/edit-forms.md`).
- `/generate-migration` — workflow for creating an Alembic migration with `env.py` import validation.

### Language policy for AI configuration files

**All AI configuration files must be written in English**: slash commands (`.claude/commands/*.md`), skills (`.claude/skills/*`), subagent definitions (`.claude/agents/*`) — prompts, headings, checklists, and comments. User-facing chat can continue in Polish, but config files for AI agents stay in English. Rationale: consistency with built-in skills, better model performance, easier review.

### Persistent memory (Claude Code)

Location: `~/.claude/projects/<project-path-slug>/memory/` on each machine (not in the repository, not shared between machines). Claude reads it automatically when relevant; anything every contributor needs belongs in the `AGENTS.md` files instead.

### Keeping README.md up to date

`README.md` is the setup guide for humans; it goes stale silently because nothing tests it. **Every agent must update it in the same change** (same commit or PR) whenever the change touches any of these:

- **Setup & configuration:** environment variables (new, renamed, removed, changed defaults or requirements), `.env` / `docker/docker.env.example` files, config validation at startup.
- **Docker & infrastructure:** `docker/*` (Dockerfiles, compose files, services, ports, volumes, nginx), service URLs, credentials handling.
- **Commands:** `Makefile` targets, `package.json` scripts, how to run, test, lint, migrate or build.
- **Requirements & stack:** runtime versions (Python, Node, PostgreSQL), major dependencies or frameworks added/removed.
- **API surface:** new or removed route prefixes, auth requirements, API docs availability.
- **Architecture & conventions:** project structure, design system (tokens, `shared/ui` primitives), state management, i18n.
- **Numbers the README quotes** (e.g. test count) when your change makes them wrong.

Rules:

- Verify every command and value you write against the code — never document from memory or from the previous README text.
- Update all places that mention the changed thing (Quick Start, Installation, Docker section, Project Structure, ...), not just the first one found; `grep` the README for it.
- If the change also affects how agents work (commands, workflow, conventions), update the matching `AGENTS.md` too: this file for repo-wide rules, `backend/`, `frontend/` or `e2e/AGENTS.md` for area rules.
- Keep the README in English and keep the table of contents anchors valid when adding or renaming sections.
- If you find the README already wrong about something unrelated to your change, fix it or flag it — don't leave it silently.

### Working with AI agents in this repo

- Always use Docker-based commands (`make ...` or `docker-compose exec ...`). Do not rely on locally installed Python/Node — even the backend and `alembic` run through `docker-compose exec backend`. The only exceptions are `npm run generate-api` (see [OpenAPI](#openapi)) and the Playwright runner (see [`e2e/AGENTS.md`](e2e/AGENTS.md)).
- Use absolute paths, not relative ones.
- DRY & KISS: do not introduce abstractions speculatively.
