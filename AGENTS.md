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
- **Error Handling:** Use `fastapi.HTTPException` with appropriate status codes from `fastapi.status`. Use the stylized API message system:
  - Add new message codes to `ApiMessages` enum in `backend/config/api_messages.py`.
  - Use `api_error(ApiMessages.CODE)` for error details.
  - Use `api_success(ApiMessages.CODE)` or include `message: ApiMessages.CODE.value` in success responses.
  - Ensure success schemas (like `Token` or `UserResponse`) include an optional `message` field.
- **HTTP Status Codes:** Always use appropriate codes (e.g., 201 for created, 400 for bad request, 401 for unauthorized, 403 for forbidden, 404 for not found).
- **Formatting:** Follow PEP 8 (handled by toolings, but keep it clean). Use double quotes for strings unless single quotes are required.
- **OpenAPI:** after changes in API, regenerate OpenAPI models using `npm run generate-api` inside frontend folder.

### Frontend (TypeScript/Angular)

- **Framework:** Angular with PrimeNG UI library.
- **Components:** All components are standalone by default. Do NOT add `standalone: true` to `@Component` decorators as it is handled by Angular.
- **Imports:** Preferred order: 1. Angular core/common, 2. Third-party libraries, 3. Shared/Core services, 4. Local models/components. Dont import CommonModule in components.
- **Class Structure & Order:**

  ```typescript
  @Component({...})
  export class PrzykladowyComponent {
    // 1. Injects (readonly #private)
    readonly #http = inject(HttpClient);
    readonly #store = inject(Store);

    // 2. Static constants
    static readonly STALA = 'wartosc';

    // 3. Decorators input()
    dane! = input.required<Data>();
    config = input<Config | null>();

    // 4. Decorators output()
    save = output<TodoCreate>();

    // 5. Decorators viewChild/viewChildren
    searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

    // 6. Signals (always readonly)
    readonly daneSygnalu = signal<string[]>([]);
    readonly status = signal<'active' | 'inactive'>('active');

    // 7. Readonly variables
    readonly nazwaKomponentu = 'PrzykladowyComponent';

    // 8. Private variables (use # prefix)
    #innaPrivate: number;

    // 9. Public variables
    publicData: any;

    // 10. Constructor
    constructor() { }

    // 11. Lifecycle methods
    ngOnInit(): void { }
    ngOnDestroy(): void { }

    // 12. Private methods (use # prefix)
    #metodaPrywatna(): void { }

    // 13. Public methods
    publicMethod(): void { }

    // 14. Event handlers (use 'on' prefix)
    onSubmit(): void { }

    // 15. Getters and Setters
    get wartosc(): string { return this.#prywatnaZmienna; }
  }
  ```

- **Rules & Best Practices:**
  - **Private Fields:** Use the `#` prefix for private fields and methods (native private syntax).
  - **Signals:** Signals must always be `readonly`.
  - **Injects:** Place `inject()` calls at the very top of the class as `readonly #private` fields.
  - **Event Handlers:** Use the `on` prefix for methods handling events (e.g., `onSubmit()`, `onDelete()`).
  - **Access Modifiers:** Within each section, maintain order: `public` -> `protected` -> `private`.
  - **Grouping:** Group functionally related elements together.
  - **Readability:** Add empty lines between different sections.
- **Naming:**
  - Components/Services/Classes: `PascalCase`.
  - Variables/Methods: `camelCase`.
  - Interfaces/Models: suffix with `.model.ts`.
- **Data Models:** Use auto-generated OpenAPI models from `@api`. Do NOT manually define interfaces for API resources.
- **Styling:** Use SCSS partials in `src/app/shared/global-styling`.
- **Formatting:** Single quotes, 2-space indentation, 100 char line limit.
- **State Management:** Use Signal-based stores (`AuthStore`, `TodoStore`).
- **Translations:** Use `ngx-translate`. Add translations to `src/assets/i18n/en.json` and `pl.json` under `API_MESSAGES`.
- **SSR mode:** Remember to add correct routes with params in `app.routes.server.ts`.
- **Error Handling:** Use `catchError` and `handleError`. Toasts are handled by `notificationInterceptor`.

---

## 📂 Project Structure

- `/backend`: FastAPI application, models, routes, and tests.
- `/frontend`: Angular source code, components, and assets.
  - `/frontend/src/app/core/store`: Signal-based state stores (AuthStore)
  - `/frontend/src/app/features/todos/store`: Feature-specific stores (TodoStore)
- `/docker`: Dockerfiles and docker-compose configurations.
- `Makefile`: Root entry point for all development tasks.
