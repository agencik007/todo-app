# PWA implementation plan

> **Status:** proposal, nothing implemented yet.
> **Scope:** `frontend/` (Angular 21 SSR), `docker/`, `e2e/`, docs. The backend changes only in the optional Phase 3.

This plan turns the Todo App into an installable Progressive Web App that starts instantly, survives flaky networks and shows the user's last known data offline, without weakening the current security model (in-memory access token, HttpOnly refresh cookie, strict CSP). It is split into small, independently shippable PRs, because every merge to `develop` is a production release.

---

## Table of contents

1. [Goals and non-goals](#1-goals-and-non-goals)
2. [Current state](#2-current-state)
3. [Key decisions](#3-key-decisions)
4. [Phase 0 — prerequisites](#4-phase-0--prerequisites)
5. [Phase 1 — installable app shell](#5-phase-1--installable-app-shell)
6. [Phase 2 — offline read mode](#6-phase-2--offline-read-mode)
7. [Phase 3 (optional) — offline writes](#7-phase-3-optional--offline-writes)
8. [Phase 4 (optional) — polish](#8-phase-4-optional--polish)
9. [Testing strategy](#9-testing-strategy)
10. [Deployment and operations](#10-deployment-and-operations)
11. [Documentation updates](#11-documentation-updates)
12. [PR and commit breakdown](#12-pr-and-commit-breakdown)
13. [Risks and mitigations](#13-risks-and-mitigations)
14. [Definition of done](#14-definition-of-done)
15. [Open questions](#15-open-questions)

---

## 1. Goals and non-goals

### Goals

- **Installable** on Android, desktop Chrome/Edge and iOS/iPadOS (Add to Home Screen) with correct name, icons, theme colour and standalone display.
- **Fast repeat visits:** the app shell (JS, CSS, fonts, icons, i18n) is served from the service worker cache.
- **Resilient:** an offline reload shows the app instead of the browser's offline page; a signed-in user sees their last synced todos and groups read-only (Phase 2).
- **Safe updates:** a new release is downloaded in the background and the user is offered a reload; a broken cache never leaves the user stuck.
- **No security regression:** no API response containing user data lands in a shared, user-agnostic cache; logout and account deletion wipe everything stored on the device.

### Non-goals (for now)

- **Push notifications** — todos have no due date or reminders (`backend/models/todo.py`), so there is nothing to notify about yet. Revisit when reminders exist.
- **Offline writes** — needs backend support and conflict handling; planned as optional Phase 3 and decided after Phase 2 ships.
- **Replacing the native (Capacitor) apps** — the PWA and the Capacitor apps (see `CORS_ORIGINS` in `docker/docker.env.example`) coexist; the service worker is disabled inside Capacitor.
- **Custom service worker / Workbox** — we use `@angular/service-worker` (NGSW): it is the framework's supported solution, understands the build's hashed output and has a built-in kill switch.

---

## 2. Current state

Findings from the codebase that shape the plan:

| Area                | Finding                                                                                                                                                                                                                              | Impact on PWA                                                                                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Build               | `@angular/build:application`, `outputMode: "server"`, `'**'` prerendered, two routes `RenderMode.Server` (`frontend/src/app/app.routes.server.ts`)                                                                                   | With SSR the browser output contains `index.csr.html`, not `index.html`. NGSW's `index` must point at it.                                                                                                                |
| Static serving      | `frontend/src/server.ts` serves `dist/browser` with `maxAge: '1y'` for **every** file                                                                                                                                                | `ngsw-worker.js`, `ngsw.json`, `safety-worker.js` and `manifest.webmanifest` must not be cached for a year — otherwise updates and the kill switch break.                                                                |
| CSP                 | Set in `server.ts`: `default-src 'self'`, `script-src 'self'`, no `worker-src` / `manifest-src`                                                                                                                                      | Both fall back to `'self'`, so NGSW and the manifest work, but we make them explicit. Changing CSP later requires a versioned SW script URL (see §10).                                                                   |
| Fonts               | JetBrains Mono from Google Fonts (`frontend/src/index.html`)                                                                                                                                                                         | Third-party request on every cold start, not cacheable by NGSW without extra config, and a GDPR concern (IP sent to Google; relevant to the privacy policy page). Self-host it.                                          |
| Icons               | `index.html` links `favicon.ico`, but `frontend/public/` contains only `theme-init.js`                                                                                                                                               | The favicon is a 404 today. There are no app icons at all.                                                                                                                                                               |
| Auth                | Access token in memory only (`features/auth/services/auth.service.ts`); refresh token is an HttpOnly, `SameSite=Strict` cookie on path `/auth/refresh`, 24 h lifetime (`backend/routes/auth.py`, `backend/services/auth_service.py`) | Good fit for a PWA (nothing secret persisted in JS-readable storage). But `AuthStore.initializeAuth()` treats **any** refresh failure — including "offline" — as logged out, and `authGuard` then redirects to `/login`. |
| Data                | `TodoService.todosResource` is an `httpResource`; `TodoStore` / `GroupStore` hold state in signals; nothing is persisted except the avatar in IndexedDB (`core/services/indexed-db.service.ts`)                                      | Offline data needs a per-user IndexedDB snapshot (Phase 2).                                                                                                                                                              |
| Routing in prod     | README "Production deployment": the reverse proxy routes `/auth`, `/todos`, `/users`, `/groups`, `/uploads` to the backend. `/todos` is also the main Angular route.                                                                 | A hard navigation to `https://<domain>/todos` (refresh, bookmark, **PWA `start_url`**) reaches FastAPI and returns JSON. Must be fixed before shipping (Phase 0).                                                        |
| Theme               | `theme-init.js` applies `.dark` before boot; `ThemeService` toggles it                                                                                                                                                               | `<meta name="theme-color">` should follow the effective theme.                                                                                                                                                           |
| Weather             | `WeatherService` calls `api.open-meteo.com` directly                                                                                                                                                                                 | Not cached; the widget must degrade gracefully offline.                                                                                                                                                                  |
| Tests               | No frontend unit test runner; Playwright e2e against production images on `localhost` (`docker/docker-compose.e2e.yml`); `e2e/fixtures/test.ts` mocks open-meteo with `page.route`                                                   | Service workers are allowed on `localhost`, so e2e can test the real SW. Existing tests must block SWs to keep `page.route` deterministic.                                                                               |
| `docker/nginx.conf` | Not referenced by any Dockerfile, compose file or workflow                                                                                                                                                                           | Not part of the serving path; leave it alone here (flagged separately).                                                                                                                                                  |

---

## 3. Key decisions

| #   | Decision                  | Recommendation                                                                                                                | Why                                                                                                                                                                                     |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Service worker technology | `@angular/service-worker` via `ng add @angular/pwa`                                                                           | First-party, aware of hashed build output, `SwUpdate` API, fail-safe via `ngsw.json` 404.                                                                                               |
| D2  | Caching API responses     | **Never** in NGSW `dataGroups`; offline data in an app-owned IndexedDB store keyed by user id                                 | NGSW caches by URL only — it ignores the `Authorization` header, so on a shared device user B could be served user A's `/todos` after logout. App-owned storage can be wiped on logout. |
| D3  | Navigation fallback       | NGSW `index: "/index.csr.html"`; navigation URLs exclude backend-only paths                                                   | Prerendered HTML is per-route; the CSR shell works for every route. Hydration is simply skipped when the SW serves the shell.                                                           |
| D4  | Registration strategy     | `registerWhenStable:30000`                                                                                                    | Don't compete with first render; register at most 30 s after boot.                                                                                                                      |
| D5  | Update UX                 | Prompt ("New version available — Reload"), never silent reload; force reload only on `unrecoverable`                          | Silent reloads lose unsaved form input.                                                                                                                                                 |
| D6  | Fonts                     | Self-host JetBrains Mono (`@fontsource-variable/jetbrains-mono`)                                                              | Offline-capable, removes two CSP origins and a GDPR issue.                                                                                                                              |
| D7  | `/todos` route conflict   | Short term: proxy routes navigations (`Accept: text/html`) on `/todos` to the frontend. Long term: move the API under `/api`. | Short-term fix is a proxy-config change only; `/api` is a breaking API change for the Capacitor apps and deserves its own PR.                                                           |
| D8  | Capacitor                 | SW disabled in native builds                                                                                                  | Assets are bundled in the native app; `capacitor://` doesn't support service workers on iOS.                                                                                            |
| D9  | Offline writes            | Out of scope until Phase 2 is used in practice                                                                                | Requires idempotent backend endpoints and a conflict policy (see Phase 3).                                                                                                              |

---

## 4. Phase 0 — prerequisites

Small, independent fixes that the PWA depends on. Each is its own PR.

### 0.1 HTTPS in production

Service workers only run in a secure context (HTTPS, or `localhost`). Production already sits behind a TLS-terminating proxy per the README; verify `PUBLIC_URL` is `https://…` and that `SECURE_COOKIES=True`. Nothing to build if this holds.

### 0.2 Fix hard navigations to `/todos`

**Done** — the routing rule and a Caddyfile example are in README "Production deployment"; the deploy smoke test checks that `GET <PUBLIC_URL>/todos` with `Accept: text/html` returns HTML.

The proxy used to send every `/todos*` request to FastAPI. Now browser navigations to `/todos` (matched on `Accept: text/html`) go to the frontend and API calls go to the backend. `Accept` is used rather than `Sec-Fetch-Mode: navigate` because every browser sends it on navigations (Safari only sends `Sec-Fetch-*` since 16.4), while Angular's `HttpClient` sends `application/json, text/plain, */*`.

Open a follow-up issue for the long-term fix (API under `/api`), see [Open questions](#15-open-questions).

### 0.3 Self-host the font

**Done** — JetBrains Mono comes from `@fontsource-variable/jetbrains-mono` (variable weight, upright and italic, imported in `frontend/src/styles.scss`). The Google Fonts links are gone from `index.html` and `https://fonts.googleapis.com` / `https://fonts.gstatic.com` from the CSP in `server.ts`. The browser downloads only the unicode subsets a page uses (latin, plus latin-ext for Polish). The privacy policy never listed Google Fonts; with no request to Google left, it is now accurate.

### 0.4 Icons and favicon

Create one master SVG (the app logo) and generate from it, into `frontend/public/icons/`:

| File                                             | Size     | Purpose                                                                             |
| ------------------------------------------------ | -------- | ----------------------------------------------------------------------------------- |
| `favicon.ico` (in `public/`)                     | 16/32/48 | Legacy browsers; fixes today's 404                                                  |
| `icon.svg`                                       | vector   | Modern favicon (`<link rel="icon" type="image/svg+xml">`)                           |
| `icon-192.png`, `icon-512.png`                   | 192, 512 | Manifest, `purpose: "any"`                                                          |
| `icon-maskable-192.png`, `icon-maskable-512.png` | 192, 512 | Manifest, `purpose: "maskable"` (logo inside the 80 % safe zone, opaque background) |
| `apple-touch-icon.png`                           | 180      | iOS home screen (no transparency)                                                   |

Generate with a reproducible script (e.g. `npx pwa-asset-generator` or `sharp`) committed under `frontend/scripts/`, not by hand, so the icons can be regenerated when the logo changes. Verify maskable icons on maskable.app.

---

## 5. Phase 1 — installable app shell

One PR: `feat(frontend): make the app an installable PWA`.

### 1.1 Scaffold

Run `ng add @angular/pwa` inside the dev container, then review every generated change — the schematic's defaults are not right for this app:

- replace the generated placeholder icons with the ones from 0.4;
- check that `angular.json` got `"serviceWorker": "ngsw-config.json"` under `build.options` (it applies to the production build only because registration is gated, see 1.4);
- add `@angular/service-worker` pinned to the same minor as `@angular/core`.

### 1.2 `frontend/ngsw-config.json`

```json
{
  "$schema": "./node_modules/@angular/service-worker/config/schema.json",
  "index": "/index.csr.html",
  "assetGroups": [
    {
      "name": "app",
      "installMode": "prefetch",
      "resources": {
        "files": [
          "/favicon.ico",
          "/index.csr.html",
          "/manifest.webmanifest",
          "/theme-init.js",
          "/*.css",
          "/*.js",
          "/assets/i18n/*.json"
        ]
      }
    },
    {
      "name": "assets",
      "installMode": "lazy",
      "updateMode": "prefetch",
      "resources": {
        "files": [
          "/icons/**",
          "/media/**",
          "/**/*.(svg|cur|jpg|jpeg|png|apng|webp|avif|gif|otf|ttf|woff|woff2)"
        ]
      }
    }
  ],
  "navigationUrls": [
    "/**",
    "!/**/*.*",
    "!/**/*__*",
    "!/**/*__*/**",
    "!/auth/**",
    "!/users/**",
    "!/groups/**",
    "!/uploads/**",
    "!/docs",
    "!/redoc",
    "!/openapi.json",
    "!/health"
  ],
  "navigationRequestStrategy": "performance"
}
```

Notes:

- **`app` group** (`prefetch`): everything needed to boot, downloaded when the SW installs. `/assets/i18n/*.json` is in it because `provideTranslateHttpLoader` loads it at boot; without it an offline start renders raw translation keys.
- **`assets` group** (`lazy`, `updateMode: prefetch`): icons, flag SVGs (`flag-icons`), PrimeIcons and the self-hosted font, cached on first use. Prerendered `…/index.html` files are not cached either (they would double the install size): repeat visits get the CSR shell from the SW, first visits still get SSR/prerender from the server.
- **No `dataGroups` on purpose** — API responses carry per-user data (decision D2).
- **`navigationUrls`:** the first four entries are NGSW's defaults; the rest exclude backend-only paths that can be reached by a navigation (uploads, API docs, health). `/todos` is intentionally **not** excluded: as a navigation it is the Angular route (Phase 0.2); API calls to `/todos` are never navigations, so NGSW passes them straight to the network.
- After the first build verify that `dist/frontend/browser/` really contains `index.csr.html` and that the generated `ngsw.json` lists the expected files and no API URLs.

### 1.3 `frontend/public/manifest.webmanifest`

```json
{
  "id": "/",
  "name": "Todo App",
  "short_name": "Todo",
  "description": "Personal todo lists with groups.",
  "start_url": "/todos?source=pwa",
  "scope": "/",
  "display": "standalone",
  "display_override": ["window-controls-overlay", "standalone"],
  "orientation": "any",
  "background_color": "#ffffff",
  "theme_color": "#ffffff",
  "lang": "en",
  "dir": "ltr",
  "categories": ["productivity"],
  "icons": [
    {
      "src": "icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "icons/icon-maskable-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "icons/icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

- Take `background_color` / `theme_color` from the PrimeUIX surface colour of the light theme (resolve the `--p-*` value once and write the hex here — the manifest cannot read CSS variables; this is the one sanctioned place for a literal colour).
- `id` is fixed so the installed app keeps its identity if `start_url` changes later.
- `screenshots` (one narrow, one wide) enable the richer install dialog on Android/desktop; add them once the UI is final.
- The manifest is English-only. Localised manifests per language aren't worth the complexity for a two-word name.
- A "New todo" shortcut (`shortcuts` → `/todos?action=new`) is added in Phase 4, together with the code that handles `?action=new`.

### 1.4 `frontend/src/index.html`

```html
<link rel="icon" href="favicon.ico" sizes="48x48" />
<link rel="icon" href="icons/icon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png" />
<link rel="manifest" href="manifest.webmanifest" />
<meta
  name="theme-color"
  content="#ffffff"
  media="(prefers-color-scheme: light)"
/>
<meta
  name="theme-color"
  content="#0b0b0b"
  media="(prefers-color-scheme: dark)"
/>
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta
  name="viewport"
  content="width=device-width, initial-scale=1, viewport-fit=cover"
/>
```

- The `theme-color` values are literals for the same reason as in the manifest (meta tags can't read CSS variables); take them from the PrimeUIX light/dark surface colours.
- `viewport-fit=cover` + `env(safe-area-inset-*)` padding on `.app-shell` (in `app.scss`, via the spacing tokens) so the standalone app doesn't draw under the notch / home indicator.
- `ThemeService.applyTheme()` updates the `theme-color` meta when the user overrides the system theme (`light`/`dark` mode), so the title bar matches the app.

### 1.5 Register the service worker

`frontend/src/app/app.config.ts`:

```ts
provideServiceWorker('ngsw-worker.js', {
  enabled: environment.serviceWorker,
  registrationStrategy: 'registerWhenStable:30000',
}),
```

- Add `serviceWorker: boolean` to both environment files: `false` in `environment.ts` (dev server — a SW in dev causes stale-code confusion), `true` in `environment.prod.ts`. A future Capacitor build configuration sets it to `false` (D8).
- `provideServiceWorker` is a no-op on the server (no `navigator.serviceWorker`), so SSR needs no special handling — verify in `make prod` logs.

### 1.6 Update handling — `core/services/app-update.service.ts`

New root service, instantiated through `provideAppInitializer` (browser only, guarded with `isPlatformBrowser`). Follows the class layout from `AGENTS.md`:

- `readonly #swUpdate = inject(SwUpdate)`; return early when `!this.#swUpdate.isEnabled`.
- `versionUpdates` filtered to `VERSION_READY` → PrimeNG toast (key `app-update`, `sticky: true`) with a **Reload** action → `document.location.reload()`. Uses the existing `MessageService`; no new UI primitive.
- `VERSION_INSTALLATION_FAILED` → `console.error` only (the current version keeps working).
- `unrecoverable` → toast explaining the problem, then reload (the user cannot continue anyway).
- Periodic check: `checkForUpdate()` on `document.visibilitychange` → `visible` and every 6 h while visible (`interval` from RxJS, started after `ApplicationRef.isStable`). Installed PWAs can stay open for days; the browser's navigation-triggered check alone isn't enough.

i18n — add to **both** `en.json` and `pl.json`:

```json
"PWA": {
  "UPDATE_READY_SUMMARY": "Update available",
  "UPDATE_READY_DETAIL": "A new version of the app is ready.",
  "UPDATE_RELOAD": "Reload",
  "UNRECOVERABLE_SUMMARY": "The app needs to reload",
  "UNRECOVERABLE_DETAIL": "Cached files are out of date. Reloading now.",
  "OFFLINE": "You are offline",
  "OFFLINE_DETAIL": "Showing data from your last sync. Changes are disabled."
}
```

### 1.7 Server headers — `frontend/src/server.ts`

- Serve SW-related files with `Cache-Control: no-cache` before the generic `express.static` (so a 1-year `maxAge` never applies to them):

  ```ts
  const noCacheFiles = new Set([
    '/ngsw-worker.js',
    '/ngsw.json',
    '/safety-worker.js',
    '/worker-basic.min.js',
    '/manifest.webmanifest',
  ]);
  ```

  Implement via `express.static`'s `setHeaders` callback (one place, no duplicate middleware): `no-cache` for those paths and for `*.html`, `public, max-age=31536000, immutable` for hashed bundles, a short `max-age` (1 day) for unhashed files in `public/` (icons, `theme-init.js`).

- CSP: add `worker-src 'self'` and `manifest-src 'self'` explicitly (documents intent; no behaviour change today).
- `Service-Worker-Allowed` is **not** needed (scope `/` equals the script location).

### 1.8 Install UX (minimal)

Browsers already show their own install affordance. Phase 1 only adds an **Install app** item to the user menu (`layout/auth-nav`) that appears when `beforeinstallprompt` fired (Chromium) and hides in `display-mode: standalone`. iOS has no install API — show nothing there (no "share → add to home screen" nag in Phase 1).

---

## 6. Phase 2 — offline read mode

One PR: `feat(frontend): show the last synced todos when offline`.

### 2.1 Connectivity signal — `core/services/network-status.service.ts`

- `readonly online = signal(navigator.onLine)` updated from `online`/`offline` window events (browser only; `true` on the server).
- `navigator.onLine === true` only means "has a network interface", so also mark offline when an API call fails with `status === 0` and back online on the next successful response (hook into the existing `notificationInterceptor` rather than adding a third interceptor).

### 2.2 Offline-aware session restore — `core/store/auth.store.ts`

Today: refresh fails → logged out. New behaviour:

| Refresh result                                       | Behaviour                                                                                                                                                                                                 |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | -------------------- |
| Success                                              | Unchanged. Save a minimal profile snapshot (`id`, `email`, `name`, `language`, `avatarUrl`) to IndexedDB.                                                                                                 |
| `401` / `AUTH_INVALID_REFRESH_TOKEN`                 | Unchanged (logged out) **and** wipe all offline data (2.4).                                                                                                                                               |
| Network error (`status === 0`) and a snapshot exists | New `isOfflineSession` state: `currentUser` from the snapshot, `isAuthenticated` stays `false` for API purposes, the UI reads from the offline store. `authGuard` allows `/todos` when `isAuthenticated() |     | isOfflineSession()`. |
| Network error and no snapshot                        | Logged out (show login page with the offline banner).                                                                                                                                                     |

When the connection returns, `AuthStore` retries `initializeAuth()` once; on success it leaves offline mode and the stores reload from the API, on `401` it logs out as usual.

The access token is still never persisted. The profile snapshot contains no secrets.

### 2.3 Offline store — extend `core/services/indexed-db.service.ts`

- Bump the DB version to 2 and add an object store `snapshots` keyed by `userId`, value `{ todos: Todo[], groups: Group[], user: UserSnapshot, savedAt: string }`. Keep the existing `avatars` store untouched (upgrade path from v1 must keep the cached avatar).
- `TodoStore` and `GroupStore` write the snapshot after every successful load and mutation (debounced, ~500 ms), and read it when `isOfflineSession()` or when the resource errors with `status === 0`.
- Types come from `@api` (`Todo`, `Group`, `UserResponse`) — no hand-written API interfaces.
- Request persistent storage once after login (`navigator.storage.persist()`), so the browser doesn't evict the snapshot under storage pressure. Failure is harmless.

### 2.4 Wipe on logout and account deletion

`AuthStore.clearUser()` (called by logout, failed refresh and account deletion) clears the `snapshots` store and the avatar. Also handle a user switch on the same device: on login, if the snapshot's `userId` differs from the new user, delete it before writing.

### 2.5 UI

- Offline banner (`app-offline-banner`, built from `app-badge` / tokens, `role="status"`, `aria-live="polite"`) under the nav while `!online()`; shows "last synced …" using `savedAt` and the existing date util.
- While offline: create/edit/delete/reorder/toggle controls are disabled with a tooltip ("Changes are disabled while offline"); the command palette hides mutating commands. This is honest about what works — no optimistic writes that silently vanish.
- Weather widget: hide (not an error toast) when offline.
- Login/register/forgot-password forms show the offline banner and disable submit.

---

## 7. Phase 3 (optional) — offline writes

Only if Phase 2 shows real demand. Requires backend work, so it gets its own design review before implementation. Sketch:

- **Outbox** in IndexedDB: ordered queue of mutations (`create`, `update`, `toggle`, `delete`, `reorder`) per user, replayed in order when online. Not Background Sync API — it is Chromium-only; replay on `online`/app start instead.
- **Idempotency:** `POST /todos` accepts a client-generated `client_id` (UUID, unique per user) so a replayed create after a lost response doesn't duplicate. Requires a model change + Alembic migration + OpenAPI regeneration.
- **Conflicts:** last-write-wins on `updated_at` for field edits; `reorder` is replayed as "move after todo X" rather than an absolute index; deletes win over edits. A todo deleted on the server is dropped from the outbox with a toast.
- **Temporary ids:** optimistic todos get negative local ids, remapped on server response.
- Rate limits and `401` during replay pause the queue instead of dropping it.

---

## 8. Phase 4 (optional) — polish

- Handle `?action=new` (manifest shortcut) → `TodoStore.showCreateForm()`; then add the shortcut to the manifest.
- Manifest `screenshots` for the rich install UI.
- App Badging API (`navigator.setAppBadge(pendingTodos().length)`) behind feature detection, with a user setting.
- Window Controls Overlay styling for desktop installs (`env(titlebar-area-*)`).
- iOS splash screens (`apple-touch-startup-image`) if the white flash on launch is noticeable.

---

## 9. Testing strategy

There is no frontend unit test runner, so the checks are lint, build and Playwright.

### Local checks per PR

- `make lint-frontend`, `npm run format:check` and `ng build` (production) inside the frontend container.
- After `ng build`: `dist/frontend/browser/ngsw.json` exists, its `index` is `/index.csr.html`, `assetGroups[0].urls` contains the i18n files and no `/auth`, `/todos` API URLs.
- `make prod` → Chrome DevTools → Application: manifest has no errors, installability passes, SW is "activated and running", "Offline" checkbox + reload renders the app.
- Lighthouse no longer has a PWA category (removed in v12); use its performance/best-practices audits and the DevTools installability panel instead.

### Playwright (`e2e/`)

- Set `serviceWorkers: 'block'` in `playwright.config.ts` `use` for the existing projects, so `page.route` mocks (open-meteo in `fixtures/test.ts`) keep working and tests stay independent of SW timing.
- New project `pwa` (`serviceWorkers: 'allow'`) running only `tests/pwa.spec.ts`:
  1. `GET /manifest.webmanifest` returns valid JSON with the expected `name`, `start_url`, icons that resolve (HTTP 200).
  2. After load, `navigator.serviceWorker.ready` resolves and, after one reload, `navigator.serviceWorker.controller` is set. Wait for `ready` with a 40 s timeout instead of shortening `registrationStrategy` for tests — the production registration path is what we want to cover.
  3. `context.setOffline(true)` + reload `/todos` → app shell renders (not Chromium's offline page).
  4. Phase 2: logged-in user with todos → offline reload → todos visible, "You are offline" banner shown, create button disabled; logout → offline reload → no todos visible (wipe test).
  5. Response headers: `ngsw-worker.js` and `ngsw.json` have `Cache-Control: no-cache`.
- Locate everything by role/name in page objects under `e2e/pages/` (`AGENTS.md` rules). Run `npm run typecheck` in `e2e/`.
- CI already runs e2e against production images, so no workflow change is needed beyond the new project being picked up.

### Manual device matrix (once per phase)

Android Chrome (install, offline, update prompt), iOS Safari (Add to Home Screen, safe areas, offline), desktop Chrome/Edge (install, window controls), Firefox (no install, but SW + offline must work).

---

## 10. Deployment and operations

- **Release = SW update.** Every deploy changes `ngsw.json`; open clients download the new version in the background and show the reload prompt. Old clients can therefore run the previous frontend for a while — **the API must stay backward compatible with the previous frontend release** (additive changes; remove fields only one release after the frontend stops using them). Add this rule to `AGENTS.md`.
- **Rollback** (`deploy.yml` redeploys the last good image): the older build has a different `ngsw.json` hash, so clients treat it as a new version and move back. No special handling.
- **Kill switch:** if a release ships a broken SW, make `/ngsw.json` return `404` (delete the file in the image or route it to 404 at the proxy). NGSW then clears its caches and unregisters itself. Document the exact steps in README "Production deployment". Keep `safety-worker.js` (emitted by the build) as the fallback for the case where the SW script name changes.
- **Header changes:** if CSP or other SW response headers change without the SW script changing, bump the registration URL (`ngsw-worker.js?v=2`) so browsers reinstall it (Angular DevOps guide).
- **Proxy:** must not cache `ngsw-worker.js`, `ngsw.json` or `manifest.webmanifest`; must serve `*.webmanifest` as `application/manifest+json` (Express does by default).
- **Monitoring:** the DevTools debug page `/ngsw/state` is available in production — useful for support ("open this URL and send a screenshot").

---

## 11. Documentation updates

Per `AGENTS.md` → "Keeping README.md up to date", in the same PRs:

- **README:** Features (installable, offline read), Technologies (`@angular/service-worker`, self-hosted font), Project Structure (`ngsw-config.json`, `public/manifest.webmanifest`, `public/icons/`, new services), Production deployment (proxy rule from 0.2, cache headers, kill switch), Testing (`pwa` Playwright project), Design System if the offline banner adds a primitive.
- **AGENTS.md:** SW is disabled on `ng serve`; test PWA behaviour with `make prod` or `make e2e-up`; API backward-compatibility rule (§10); new i18n `PWA` keys live outside `API_MESSAGES`.
- **Privacy policy page:** it doesn't mention Google Fonts today although every page load sends the visitor's IP to Google — self-hosting (0.3) fixes that at the source. Phase 2 adds what is stored on the device (offline snapshot) and that logout removes it.

---

## 12. PR and commit breakdown

Branches from `develop`, Conventional Commits, one logical change per commit.

| PR  | Branch                       | Commits                                                                                                                                                                                                                                                                                                                                                       |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.2 | `fix/todos-navigation-proxy` | `docs(readme): route /todos navigations to the frontend` · `ci: smoke-test a hard navigation to /todos`                                                                                                                                                                                                                                                       |
| 0.3 | `perf/self-host-font`        | `perf(frontend): self-host the JetBrains Mono font` · `fix(security): drop Google Fonts origins from the CSP`                                                                                                                                                                                                                                                 |
| 0.4 | `feat/app-icons`             | `feat(frontend): add favicon and app icons` · `build(frontend): add script that generates the app icons`                                                                                                                                                                                                                                                      |
| 1   | `feat/pwa-app-shell`         | `feat(frontend): add web app manifest` · `feat(frontend): register the Angular service worker` · `feat(frontend): prompt the user to reload when an update is ready` · `fix(frontend): serve service worker files without long-term caching` · `test(e2e): cover manifest, service worker and offline shell` · `docs: document the PWA setup and kill switch` |
| 2   | `feat/offline-read-mode`     | `feat(frontend): track network status` · `feat(auth): keep an offline session when the refresh request fails offline` · `feat(todos): persist a per-user offline snapshot` · `feat(frontend): show an offline banner and disable changes offline` · `test(e2e): cover offline read mode and logout wipe` · `docs: document offline mode`                      |
| 3   | `feat/offline-writes`        | after a separate design review                                                                                                                                                                                                                                                                                                                                |

PR descriptions: `## Summary` + `## Test plan`, base `develop`.

---

## 13. Risks and mitigations

| Risk                                                                                                              | Likelihood           | Impact     | Mitigation                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------- | -------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Users stuck on a broken cached version                                                                            | Low                  | High       | `unrecoverable` handler, update prompt, `no-cache` on SW files, documented kill switch.                                           |
| User data leaking between accounts on a shared device                                                             | Medium without D2    | High       | No API `dataGroups`; per-user IndexedDB snapshot wiped on logout/user switch; e2e wipe test.                                      |
| `/todos` refresh returns JSON in production                                                                       | Certain today        | High       | Phase 0.2 before Phase 1.                                                                                                         |
| Old frontend calling a changed API after deploy                                                                   | Medium               | Medium     | Backward-compatibility rule, update prompt, periodic `checkForUpdate`.                                                            |
| iOS: separate cookie jar for home-screen apps (login again after install), 24 h refresh lifetime → daily re-login | Certain              | Low/Medium | Expected; offline read mode keeps data visible. Longer sliding refresh lifetime is a separate security decision (Open questions). |
| iOS evicts storage of non-installed sites after 7 days without use                                                | Certain (Safari ITP) | Low        | Only affects the offline snapshot; data is re-fetched on next online start.                                                       |
| Hydration mismatch warnings when SW serves the CSR shell                                                          | Medium               | Low        | Expected (no server state → client render). Verify no errors in the console on a SW-served load.                                  |
| Install size growth (flag-icons SVGs, PrimeIcons)                                                                 | Medium               | Low        | They are in the lazy group, fetched on first use, not on install. Check `ngsw.json` prefetch size < 2 MB.                         |

---

## 14. Definition of done

Phase 1:

- [ ] Chrome DevTools reports the app installable with no manifest warnings; maskable icons look correct on Android.
- [ ] Offline reload of `/todos`, `/login` and `/privacy` renders the app shell with translations.
- [ ] A new deploy produces the "Update available" toast in an open tab within one visibility change; Reload shows the new version.
- [ ] `ngsw-worker.js`, `ngsw.json`, `manifest.webmanifest` and HTML are served `no-cache`; hashed bundles `immutable`.
- [ ] No API URL appears in `ngsw.json`.
- [ ] Hard navigation to `https://<domain>/todos` returns HTML (Phase 0.2).
- [ ] Lint, Prettier, production build, backend tests and e2e (including `pwa` project) green in CI.
- [ ] README and AGENTS.md updated.

Phase 2:

- [ ] Signed-in user going offline sees the last synced todos and groups read-only with a "last synced" time.
- [ ] Logout, failed refresh (`401`) and account deletion leave no todos/groups/profile in IndexedDB.
- [ ] Logging in as another user on the same device never shows the previous user's data.
- [ ] Coming back online leaves offline mode without a reload.

---

## 15. Open questions

1. **API prefix:** move the backend under `/api` (clean separation of navigations and API calls, simpler proxy and NGSW config)? It is a breaking change for the Capacitor apps' `API_URL` and needs a coordinated release.
2. **Refresh token lifetime:** 24 h means an installed PWA asks for a password almost daily. Is a longer sliding lifetime with rotation acceptable from a security point of view?
3. **Offline writes (Phase 3):** is there demand once offline read mode ships?
4. **Brand assets:** is there an existing logo for the icons, or should one be designed?
5. **Manifest colours:** follow the default (light) PrimeUIX surface, or the user's selected colour palette (`ColorService`)? The manifest is static, so only one can be the install-time colour.
