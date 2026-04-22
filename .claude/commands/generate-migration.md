# generate-migration

Create an Alembic migration for changes in SQLAlchemy models. Enforces the checklist from `AGENTS.md` section "Working with Alembic Migrations".

---

## Task

User provided: **$ARGUMENTS**
(If empty — infer the migration description from the diff in `backend/models/`.)

## Steps

1. **Diff the models** — check what changed in `backend/models/`:
   - `git status backend/models/`
   - `git diff backend/models/` (or compare against HEAD)

2. **Validate imports in `backend/migrations/env.py`:**
   - Open `backend/migrations/env.py`
   - For EACH model that changed or is new, ensure an import exists in the form:
     ```python
     from models.<module> import <ClassName>  # noqa: E402, F401
     ```
   - If it's missing — add it BEFORE generating the migration. Without it, Alembic won't detect the changes.

3. **Determine the migration description** (`$ARGUMENTS` or infer):
   - Format: `snake_case`, short, imperative mood, English
   - Examples: `add_avatar_to_user`, `drop_is_public_from_todo`, `create_group_invites_table`

4. **Generate the migration** (inside the backend container):
   ```bash
   docker-compose -f docker/docker-compose.yml exec backend alembic revision --autogenerate -m "<description>"
   ```

5. **Review the generated file** in `backend/migrations/versions/`:
   - Verify that `upgrade()` does what you intend (create_table / add_column / alter_column / drop).
   - Verify that `downgrade()` is symmetric (the migration can be rolled back).
   - **If the migration uses PostgreSQL-specific features (enums, JSONB, arrays)** — rewrite it conditionally, following the pattern from `AGENTS.md`:
     ```python
     conn = op.get_bind()
     is_postgres = conn.dialect.name == 'postgresql'
     if is_postgres:
         # postgres path (enum/jsonb/...)
     else:
         # sqlite fallback (String + application-level validation)
     ```
   - Verify that `down_revision` points to the previous head.

6. **Apply the migration:**
   ```bash
   make migrate
   ```
   (equivalent to: `docker-compose -f docker/docker-compose.yml exec backend alembic upgrade head`)

7. **Regenerate OpenAPI** (if anything changed in schemas or models exposed through the API):
   ```bash
   docker-compose -f docker/docker-compose.yml exec frontend npm run generate-api
   ```

8. **Report back to the user** — summarize:
   - Migration filename (`<hash>_<description>.py`)
   - Operations it contains (`create_table`, `add_column`, etc.)
   - Whether conditional PostgreSQL/SQLite logic was needed
   - Whether OpenAPI was regenerated
   - Whether the migration applied cleanly (`alembic current`)

## Pitfalls (don't forget)

- **Missing import in `env.py`** = empty "No changes detected" migration. Always check this file BEFORE running generate.
- **SQLAlchemy `Enum` in SQLite** does not behave like PostgreSQL — use conditional logic.
- **Column rename** is seen by Alembic autogenerate as drop+add. For a true rename that preserves data, edit the migration manually (`op.alter_column` with `new_column_name`).
- **Never use `--no-verify`** on commits containing a migration. If tests fail, fix the migration.
