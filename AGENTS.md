# Agent Guidelines — Todo App (FastAPI + Angular)

> Single source of truth for AI coding agents (Claude Code, Cursor, Codex, Copilot Agents, etc.) and human contributors working on this repository. Covers stack, commands, workflow, code conventions, migrations, and AI-specific configuration.

---

## Stack (TL;DR)

- **Backend:** FastAPI + SQLAlchemy + Alembic + PostgreSQL, `backend/`
- **Frontend:** Angular 21 + PrimeNG + signal-based stores (`@ngrx/signals`), `frontend/`
- **Dev infra:** Docker Compose, everything runs through the root `Makefile`
- **OpenAPI:** backend generates the schema → frontend consumes generated types from `@api` in `frontend/src/libs/generated-api/`

### Dev URLs

- Frontend: `http://localhost:4200`
- API: `http://localhost:8000`
- API docs (Swagger): `http://localhost:8000/docs`
- pgAdmin: `http://localhost:5050`

---

## Quick Commands

All major operations are managed via the root `Makefile`. Always prefer Docker-based commands (through `make` or `docker-compose exec`) over local ones — the project assumes a containerized toolchain.

| Goal                                           | Command                                                                                   |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Dev environment (hot-reload, front+back+db+pgadmin) | `make dev`                                                                           |
| Prod environment                               | `make prod`                                                                               |
| Stop all services                              | `make down`                                                                               |
| View logs                                      | `make logs`, `make logs-backend`, `make logs-frontend`                                    |
| Clean environment (containers, images, volumes)| `make clean`                                                                              |
| Backend tests                                  | `make test-backend`                                                                       |
| Single backend test                            | `docker-compose -f docker/docker-compose.yml exec backend python -m pytest backend/tests/test_filename.py::test_function_name` |
| Frontend tests (non-watching)                  | `make test-frontend`                                                                      |
| Single frontend test                           | `docker-compose -f docker/docker-compose.yml exec frontend npx ng test --include=src/app/path/to/spec.ts` |
| Frontend lint                                  | `docker-compose -f docker/docker-compose.yml exec frontend npm run lint`                  |
| Migrate to head                                | `make migrate`                                                                            |
| New migration (autogenerate)                   | `docker-compose -f docker/docker-compose.yml exec backend alembic revision --autogenerate -m "description"` |
| Regenerate API types after backend changes     | `docker-compose -f docker/docker-compose.yml exec frontend npm run generate-api`          |
| Backend shell                                  | `make shell-backend`                                                                      |
| Database shell                                 | `make shell-db`                                                                           |

---

## Workflow — before you finish a task

1. **Backend:** if you changed models/schemas/routes → regenerate OpenAPI (`npm run generate-api`).
2. **Backend:** if you changed models → create an Alembic migration (`alembic revision --autogenerate`), review it, then run `make migrate`.
3. **Frontend:** run lint (`npm run lint`) before considering the task done.
4. **Tests:** if you touched logic → run `make test-backend` and/or `make test-frontend`.
5. **i18n:** new API messages must have keys in both `frontend/src/assets/i18n/en.json` and `pl.json` under `API_MESSAGES`.

---

## Project Structure

```
backend/
  config/        # api_messages.py, settings
  models/        # SQLAlchemy models (user, todo, group)
  routes/        # FastAPI endpoints
  services/      # business logic
  migrations/    # Alembic (remember to register models in env.py!)
  tests/         # pytest; conftest.py sets TESTING=1
frontend/src/app/
  core/          # guards, interceptors, services, tokens, stores (AuthStore)
  features/      # auth/, groups/, todos/ (each with components/, store/)
  shared/        # components, global-styling, pipes
  layout/
docker/          # Dockerfiles and docker-compose configurations
Makefile         # root entry point for all development tasks
```

---

## General Principles

- **DRY & KISS:** keep it simple, don't repeat yourself, don't add abstractions "just in case".
- **Docker-first:** assume all tools run inside containers. Even `alembic` goes through `docker-compose exec backend`.
- **Absolute paths:** when using tools, always prefer absolute paths over relative ones.

---

## Backend — Python / FastAPI

### Framework and conventions

- FastAPI with SQLAlchemy (models) and Pydantic (schemas).
- **Imports:** group as 1) standard library, 2) third-party, 3) local modules.
- **Naming:**
  - Functions / variables: `snake_case`
  - Classes: `PascalCase`
  - Schemas: suffix with `Create`, `Update` where applicable (e.g. `TodoCreate`, `TodoUpdate`).
- **Typing:** use Python type hints everywhere (`typing.List`, `Optional`, etc.).
- **Formatting:** follow PEP 8. Double quotes for strings unless single quotes are required.

### Error handling and API messages

Use `fastapi.HTTPException` with appropriate status codes from `fastapi.status`. Use the project's stylized API message system:

- Add new message codes to the `ApiMessages` enum in `backend/config/api_messages.py`.
- Use `api_error(ApiMessages.CODE)` for error details.
- Use `api_success(ApiMessages.CODE)` or include `message: ApiMessages.CODE.value` in success responses.
- Ensure success schemas (like `Token` or `UserResponse`) include an optional `message` field.
- Always use appropriate HTTP status codes (201 for created, 400 for bad request, 401 unauthorized, 403 forbidden, 404 not found, etc.).

### Testing

- The full suite is 81+ tests; run with `make test-backend`.
- Tests use the database configured by `DATABASE_URL`.
- An autouse fixture `db_cleanup` in `conftest.py` clears all data between tests.
- **Rate limiting in tests:** rate limiting is enabled by default on sensitive endpoints (registration, login, verify email). Tests must run with `TESTING=1`, which `backend/tests/conftest.py` sets automatically via `os.environ["TESTING"] = "1"`.
- **When adding new rate-limited endpoints**, always check `enabled=not IS_TESTING` or `os.getenv("TESTING") != "1"` so the test suite continues to bypass limiting.

### OpenAPI

After changes to models, schemas, or routes, regenerate the OpenAPI models:

```bash
docker-compose -f docker/docker-compose.yml exec frontend npm run generate-api
```

This produces TypeScript interfaces and enums in `frontend/src/libs/generated-api/`.

---

## Frontend — TypeScript / Angular

### Framework

Angular 21 with PrimeNG UI and signal-based stores (`@ngrx/signals`, `AuthStore`, `TodoStore`).

### Components

- All components are **standalone by default**. Do **NOT** add `standalone: true` to `@Component` decorators — Angular handles it.
- Do **NOT** import `CommonModule`. Use the built-in control flow: `@if`, `@for`, `@switch`.

### Imports

Preferred order: 1) Angular core/common, 2) third-party libraries, 3) shared/core services, 4) local models/components.

### Class structure and order

```typescript
@Component({...})
export class ExampleComponent {
  // 1. Injects (readonly #private)
  readonly #http = inject(HttpClient);
  readonly #store = inject(Store);

  // 2. Static constants
  static readonly CONSTANT = 'value';

  // 3. input() decorators
  data = input.required<Data>();
  config = input<Config | null>();

  // 4. output() decorators
  save = output<TodoCreate>();

  // 5. viewChild / viewChildren
  searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  // 6. Signals (always readonly)
  readonly items = signal<string[]>([]);
  readonly status = signal<'active' | 'inactive'>('active');

  // 7. Readonly variables
  readonly componentName = 'ExampleComponent';

  // 8. Private variables (use # prefix)
  #internalCounter: number;

  // 9. Public variables
  publicData: any;

  // 10. Constructor
  constructor() { }

  // 11. Lifecycle methods
  ngOnInit(): void { }
  ngOnDestroy(): void { }

  // 12. Private methods (use # prefix)
  #privateMethod(): void { }

  // 13. Public methods
  publicMethod(): void { }

  // 14. Event handlers (use 'on' prefix)
  onSubmit(): void { }

  // 15. Getters and setters
  get value(): string { return this.#internalValue; }
}
```

### Rules and best practices

- **Private fields:** use the `#` prefix for private fields and methods (native private syntax). Never use the `private` keyword.
- **Signals:** signals must always be `readonly`.
- **Injects:** place `inject()` calls at the very top of the class as `readonly #private` fields.
- **Event handlers:** use the `on` prefix (`onSubmit()`, `onDelete()`, not `handleSubmit()`).
- **Access modifiers:** within each section, keep order `public` → `protected` → `private`.
- **Grouping & readability:** group functionally related elements together; add empty lines between sections.

### Naming

- Components / services / classes: `PascalCase`.
- Variables / methods: `camelCase`.
- Interfaces / models files: suffix with `.model.ts`.

### Data models

Use auto-generated OpenAPI models from `@api`. Do **NOT** manually define interfaces for API resources.

### Styling

Use SCSS partials in `src/app/shared/global-styling`.

### Formatting

Single quotes, 2-space indentation, 100-character line limit.

### Accessibility

Use PrimeNG accessibility features. Remember about `tabindex` and keyboard navigation when creating clickable containers.

### State management

Signal-based stores (`AuthStore`, `TodoStore`).

### Translations

Use `ngx-translate`. Add translations to `src/assets/i18n/en.json` and `pl.json` under `API_MESSAGES`.

### SSR

Remember to register parameterized routes in `app.routes.server.ts`.

### Error handling

Use `catchError` and `handleError`. Toasts are handled by `notificationInterceptor`.

### Forms

The project is migrating to the **Signal Forms API (Angular 21 experimental)** — see Claude memory files `project_angular_forms_style.md` and `project_forms.md` for the target style. The slash command `/edit-forms` covers the global form rewrite.

---

## Database & Migrations

### Configuration

- Local development: database configured via `DATABASE_URL`.
- Production: PostgreSQL (via `DATABASE_URL`).
- Migration tool: Alembic.

### Creating a migration

**Before generating a migration**, make sure every model is imported in `backend/migrations/env.py`:

```python
from models.user import User  # noqa: E402, F401
from models.todo import Todo  # noqa: E402, F401
from models.group import Group  # noqa: E402, F401
```

Without these imports, Alembic will not detect new models.

Generate the migration:

```bash
docker-compose -f docker/docker-compose.yml exec backend alembic revision --autogenerate -m "descriptive_message"
```

**Always review the generated migration** before running `make migrate`.

### SQLite vs PostgreSQL

When a migration touches database-specific features (e.g. PostgreSQL enums), branch on the dialect:

```python
from sqlalchemy.dialects import postgresql

def upgrade() -> None:
    conn = op.get_bind()
    is_postgres = conn.dialect.name == 'postgresql'

    if is_postgres:
        my_enum = postgresql.ENUM('value1', 'value2', name='myenum')
        my_enum.create(conn, checkfirst=True)
        column_type = my_enum
    else:
        # SQLite: fall back to String + application-level validation
        column_type = sa.String()

    op.create_table(
        'my_table',
        sa.Column('my_column', column_type, nullable=False),
        ...
    )

def downgrade() -> None:
    conn = op.get_bind()
    is_postgres = conn.dialect.name == 'postgresql'

    op.drop_table('my_table')

    if is_postgres:
        postgresql.ENUM(name='myenum').drop(conn, checkfirst=True)
```

### Enums in SQLAlchemy

When you need a fixed set of values (e.g. colors, statuses):

1. Define a Python `Enum`:

   ```python
   import enum
   from sqlalchemy import Enum

   class MyEnum(str, enum.Enum):
       VALUE1 = "value1"
       VALUE2 = "value2"
   ```

2. Use it in the model:

   ```python
   my_field = Column(Enum(MyEnum), nullable=False, default=MyEnum.VALUE1)
   ```

3. Reuse it in the Pydantic schema:

   ```python
   from models.my_model import MyEnum

   class MySchema(BaseModel):
       my_field: MyEnum = MyEnum.VALUE1
   ```

Benefits: type safety in Python, validation at DB level (PostgreSQL) or app level (SQLite), automatic OpenAPI export, consistency between frontend and backend.

### Migration troubleshooting

- **"Can't locate revision"** → inspect the `alembic_version` table and fix it manually if needed.
- **Enum not working in SQLite** → use the conditional pattern above.
- **Model not detected by Alembic** → make sure it's imported in `migrations/env.py`.

---

## AI Agent Configuration

### Claude Code — slash commands

Stored in `.claude/commands/`:

- `/edit-forms` — global rewrite of the six forms following Signal Forms + the Angular Style Guide (`.claude/commands/edit-forms.md`).
- `/generate-migration` — workflow for creating an Alembic migration with `env.py` import validation.

### Language policy for AI configuration files

**All AI configuration files must be written in English**: slash commands (`.claude/commands/*.md`), skills (`.claude/skills/*`), subagent definitions (`.claude/agents/*`) — prompts, headings, checklists, and comments. User-facing chat can continue in Polish, but config files for AI agents stay in English. Rationale: consistency with built-in skills, better model performance, easier review.

### Persistent memory (Claude Code)

Location: `C:\Users\<user>\.claude\projects\D--Code-todo-app-agencik007\memory\`. Contains, among other things, Signal Forms rules; Claude reads them automatically when relevant.

### Working with AI agents in this repo

- Always use Docker-based commands (`make ...` or `docker-compose exec ...`). Do not rely on locally installed Python/Node — even the backend and `alembic` run through `docker-compose exec backend`.
- Use absolute paths, not relative ones.
- DRY & KISS: do not introduce abstractions speculatively.
