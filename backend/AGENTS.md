# Agent Guidelines — Backend (FastAPI)

> Rules for work inside `backend/`. Read them together with the root [`AGENTS.md`](../AGENTS.md) (commands, workflow, Git, OpenAPI, README rules), which always applies.

---

## Framework and conventions

- FastAPI with SQLAlchemy (models) and Pydantic (schemas).
- **Imports:** group as 1) standard library, 2) third-party, 3) local modules.
- **Naming:**
  - Functions / variables: `snake_case`
  - Classes: `PascalCase`
  - Schemas: suffix with `Create`, `Update` where applicable (e.g. `TodoCreate`, `TodoUpdate`).
- **Typing:** use Python type hints everywhere, in the modern syntax (`list[str]`, `dict[str, int]`, `X | None`, `collections.abc.Sequence`) — not `typing.List` / `Optional` / `Union`; `ruff check` enforces it.
- **Formatting:** follow PEP 8 (4-space indentation, enforced by `ruff format`). Double quotes for strings unless single quotes are required.
- **Linting:** `ruff check` with Ruff's default rule set, configured in `backend/ruff.toml` (Python 3.12 target, FastAPI `Depends()`/`File()` defaults allowed). Fix findings instead of silencing them; a deliberate exception gets `# noqa: <CODE> - <reason>`.

---

## Error handling and API messages

Use `fastapi.HTTPException` with appropriate status codes from `fastapi.status`. Use the project's stylized API message system:

- Add new message codes to the `ApiMessages` enum in `backend/config/api_messages.py`.
- Use `api_error(ApiMessages.CODE)` for error details.
- Use `api_success(ApiMessages.CODE)` or include `message: ApiMessages.CODE.value` in success responses.
- Ensure success schemas (like `Token` or `UserResponse`) include an optional `message` field.
- Always use appropriate HTTP status codes (201 for created, 400 for bad request, 401 unauthorized, 403 forbidden, 404 not found, etc.).
- Every new code needs a translation in both `frontend/src/assets/i18n/en.json` and `pl.json` under `API_MESSAGES` — the frontend shows these codes as toasts.

---

## Emails

Every email the backend sends follows the same rules, so a new one looks and behaves like the others.

- **One template per email:** `templates/email/<name>.html` extends `base.html` (logo, card, footer) and `<name>.txt` extends `base.txt` — always both, the plain-text part goes into every message. Build the body from the macros in `_components.html` (`paragraph`, `button`, `notice`, `link_fallback`, `divider`); add a macro there rather than one-off markup in a template.
- **Texts in `i18n/en.json` and `pl.json`** under a category named like the template, with at least `subject`, `preheader` (inbox preview line) and `title`; `tests/test_email_service.py` fails when the two files have different keys. Values use `{placeholders}` filled from the render params; counts go through a plural helper such as `format_hours()` (Polish has `one`/`few`/`many` forms), never a "godzinę/godziny" text. Footer texts live in `common`.
- **Language of the account:** pass `user.language` (set at sign-up from the interface language, updated by `PUT /users/me/language`). Never guess from request headers.
- **Send through `send_templated_email(to, "<name>", language, **params)`**, wrapped in a thin `send_<name>_email()` with explicit parameters. Values like link lifetimes come from the route's constants as arguments, never repeated in the email code.
- **Look:** dark only (`color-scheme: dark`), colors from `EMAIL_COLORS` (the app's Aura dark surfaces and cyan primary — not the user's palette), font `EMAIL_FONT`. Email clients need table layout and inline styles; no CSS variables, no SVG, no JavaScript, no external CSS except the web font.
- **Links:** absolute, built from `FRONTEND_URL`; every button has the same link shown below it as text (`link_fallback`). The e2e tests read links from the message body, so keep the URL path in it.
- **Security:** Jinja2 autoescapes `.html` templates — never mark user input `|safe`; tokens go only into URLs, never into logs.
- **Tests:** add the template to `TEMPLATES` in `tests/test_email_service.py` (renders in every language, no leftover placeholders) and test the route that sends it with the `sent` fixture. Check the result in MailHog (`http://localhost:8025`) before finishing.

---

## Testing

- The full suite is 124 tests; run with `make test-backend`. `pytest.ini` enforces at least 80% coverage.
- Single test: `docker-compose -f docker/docker-compose.yml --env-file docker/docker.env exec backend python -m pytest tests/test_filename.py::test_function_name`.
- Test and lint tools (pytest, pytest-asyncio, pytest-cov, httpx, ruff) live in `backend/requirements-dev.txt`, not `requirements.txt`: the production image installs runtime dependencies only, the dev container (`target: dev`) and CI install both.
- Tests never use the application database: `conftest.py` derives `<db>_test` from `DATABASE_URL` (created automatically if the DB user has permission), or uses `TEST_DATABASE_URL` if set.
- An autouse fixture `db_cleanup` in `conftest.py` clears all data between tests.
- **Rate limiting in tests:** rate limiting is enabled by default on sensitive endpoints (registration, login, forgot/reset password, resend verification). Tests must run with `TESTING=1`, which `backend/tests/conftest.py` sets automatically via `os.environ["TESTING"] = "1"`.
- **When adding new rate-limited endpoints**, always check `enabled=not IS_TESTING` or `os.getenv("TESTING") != "1"` so the test suite continues to bypass limiting.

---

## Database & Migrations

### Configuration

- PostgreSQL 15 everywhere (dev, tests, CI, production), configured via `DATABASE_URL`. There is no SQLite fallback.
- Migration tool: Alembic. The `/generate-migration` slash command walks through the steps below.

### Creating a migration

**Before generating a migration**, make sure every model is imported in `backend/migrations/env.py`:

```python
from models.group import Group  # noqa: F401
from models.refresh_token import RefreshToken  # noqa: F401
from models.todo import Todo  # noqa: F401
from models.user import User  # noqa: F401
```

Without these imports, Alembic will not detect new models.

Generate the migration:

```bash
docker-compose -f docker/docker-compose.yml --env-file docker/docker.env exec backend alembic revision --autogenerate -m "descriptive_message"
```

**Always review the generated migration** before running `make migrate`. CI runs `alembic upgrade head` + `alembic check` on an empty database, so a model change without a migration fails the build.

### PostgreSQL enums in migrations

Alembic autogenerate does not drop PostgreSQL enum types in `downgrade()` (and does not detect changed enum values). Create the type explicitly and drop it yourself:

```python
from sqlalchemy.dialects import postgresql


def upgrade() -> None:
    my_enum = postgresql.ENUM("value1", "value2", name="myenum")
    my_enum.create(op.get_bind(), checkfirst=True)

    op.create_table("my_table", sa.Column("my_column", my_enum, nullable=False), ...)


def downgrade() -> None:
    op.drop_table("my_table")
    postgresql.ENUM(name="myenum").drop(op.get_bind(), checkfirst=True)
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

Benefits: type safety in Python, validation at DB level, automatic OpenAPI export, consistency between frontend and backend.

### Migration troubleshooting

- **"Can't locate revision"** → inspect the `alembic_version` table and fix it manually if needed.
- **Enum type already exists / not dropped** → use the explicit pattern above.
- **Model not detected by Alembic** → make sure it's imported in `migrations/env.py`.

---

## Before you finish a backend change

1. `make test-backend`, plus `ruff check` and `ruff format --check` (CI runs all three).
2. Changed models → migration generated, reviewed and applied with `make migrate`.
3. Changed models, schemas or routes → regenerate the frontend API client ([OpenAPI](../AGENTS.md#openapi) in the root file) and commit it.
4. New `ApiMessages` codes → `en.json` and `pl.json` keys under `API_MESSAGES`.
