# Agent Guidelines — Frontend (Angular)

> Rules for work inside `frontend/`. Read them together with the root [`AGENTS.md`](../AGENTS.md) (commands, workflow, Git, OpenAPI, README rules), which always applies.

---

## Framework

Angular 21 with PrimeNG UI and signal-based stores (`@ngrx/signals`, `AuthStore`, `TodoStore`).

---

## Components

- All components are **standalone by default**. Do **NOT** add `standalone: true` to `@Component` decorators — Angular handles it.
- Do **NOT** import `CommonModule`. Use the built-in control flow: `@if`, `@for`, `@switch`.

---

## Imports

Preferred order: 1) Angular core/common, 2) third-party libraries, 3) shared/core services, 4) local models/components.

---

## Class structure and order

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

---

## Naming

- Components / services / classes: `PascalCase`.
- Variables / methods: `camelCase`.
- Interfaces / models files: suffix with `.model.ts`.

---

## Data models

Use auto-generated OpenAPI models from `@api` (`src/libs/generated-api/`). Do **NOT** manually define interfaces for API resources, and never edit the generated files by hand — regenerate them ([OpenAPI](../AGENTS.md#openapi) in the root file).

---

## Styling

Use SCSS partials in `src/app/shared/global-styling`.

**Design system** (details in the README's _Design System_ section):

- Use design tokens from `_tokens.scss` (`--app-space-*`, `--app-radius-*`, `--app-text-*`, `--app-shadow-*`, `--app-transition-*`) instead of hardcoded values. Colors come from the PrimeUIX theme (`--p-*` variables) — never hardcode hex colors.
- Reuse the primitives in `src/app/shared/ui/` (`button[appIconButton]`, `app-badge`, `app-empty-state`, `app-form-field`) before creating ad-hoc equivalents. Add a new primitive only when a pattern repeats in at least two features.
- App icons are the one place with literal colors (images can't read CSS variables). Edit the masters `public/icons/icon.svg` and `scripts/icons/icon-maskable.svg` (keep the mark inside the central 80 % of the maskable one), then run `npm run generate-icons` and commit the regenerated `favicon.ico` and PNGs.

---

## Formatting

Single quotes, 2-space indentation (`frontend/.prettierrc`, also used for SCSS, HTML and JSON; `.editorconfig` matches), 100-character line limit for HTML templates. Everything outside Python uses 2 spaces. CI fails on unformatted files — run `npx prettier --write .` in `frontend/`.

---

## Accessibility

Use PrimeNG accessibility features. Remember about `tabindex` and keyboard navigation when creating clickable containers.

---

## State management

Signal-based stores (`AuthStore`, `TodoStore`).

---

## Translations

Use `ngx-translate`. Add translations to `src/assets/i18n/en.json` and `pl.json` under `API_MESSAGES`.

---

## PWA (service worker)

- The Angular service worker is registered only in the production build (`environment.serviceWorker`); `ng serve` runs without it. Check PWA behaviour (offline shell, update toast) on `make prod` or the e2e stack.
- `ngsw-config.json` caches the app shell only. Never add `dataGroups` for API URLs: the cache is keyed by URL, not by user, so it would serve one user's data to the next one on a shared device (see `docs/pwa-plan.md`, decision D2).
- A new backend-only path that users can open by navigation (a link, a bookmark) must be excluded in `navigationUrls`, or the service worker answers it with the app shell.
- `AppUpdateService` (`core/services/app-update.service.ts`) shows the reload toast when a new version is ready; its texts live under `PWA` in the i18n files. `PwaInstallService` keeps the browser's install prompt for the user menu's "Install app" item.
- **Offline read mode.** `OfflineDataService` keeps one snapshot (user, todos, groups) in IndexedDB; `AuthStore` starts an _offline session_ from it when the API can't be reached at startup and wipes it in `clearUser()` (logout, expired session, deleted account). Save only data the server confirmed, and never share it through the service worker cache.
- Offline is "the API can't be reached": `isServerUnreachable()` (`core/utils/network-error.util.ts`) — status 0, or 502/503/504, because the service worker answers a failed fetch with a synthetic **504**. Don't test for `status === 0` alone.
- Anything that changes data needs the server: gate it on `AuthStore.canWrite` (signed in _and_ online). Use `hasSession` (online or offline session) for what a signed-in user may see.
- `index.html` uses `viewport-fit=cover`, so on notched phones the page reaches under the notch and the home indicator. `.app-shell` pads itself with the `--app-safe-*` tokens; anything `position: fixed` that sits below the nav or at the screen edge must add them too (e.g. `top: calc(50px + var(--app-safe-top))`).

---

## SSR

Remember to register parameterized routes in `app.routes.server.ts`.

---

## Error handling

Use `catchError` and `handleError`. Toasts are handled by `notificationInterceptor`.

---

## Forms

All forms use the **Signal Forms API** (`@angular/forms/signals`, experimental in Angular 21) — do not add `ReactiveFormsModule` or template-driven forms. Follow the existing forms (e.g. `features/auth/components/login/`) and the rules in `.claude/commands/edit-forms.md`; the slash command `/edit-forms` re-applies that style across all forms.

---

## Before you finish a frontend change

There is no unit test runner yet (`angular.json` has no `test` target), so these are the checks:

1. `make lint-frontend`.
2. `npm run format:check` in `frontend/` (fix with `npx prettier --write .`).
3. `ng build` passes.
4. Changed a user-facing flow → run and update the e2e tests ([`e2e/AGENTS.md`](../e2e/AGENTS.md)).
