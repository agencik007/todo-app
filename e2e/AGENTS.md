# Agent Guidelines — E2E tests (Playwright)

> Rules for work inside `e2e/`. Read them together with the root [`AGENTS.md`](../AGENTS.md) (commands, workflow, Git, README rules), which always applies.

---

## Running the tests

- Playwright lives in `e2e/` and tests the running stack from `docker/docker-compose.e2e.yml` (production images, throwaway DB, MailHog, `TESTING=1`). `make test-e2e` starts it, runs everything and tears it down; `make e2e-up` / `make e2e-down` keep it running while you iterate with `cd e2e && npx playwright test`.
- Stop the dev stack first — both stacks use the same ports.
- **Exception to Docker-first:** Playwright runs on the host (Node 22) because the frontend calls the API at `http://localhost:8000` — the browser must reach both on `localhost`.
- CI runs the suite against the production Docker images on every PR.

---

## Writing tests

- Layout: `fixtures/` (API and MailHog helpers, test fixtures), `pages/` (page objects), `tests/` (specs).
- Every test gets its own user from the `user` / `loggedIn` fixtures in `e2e/fixtures/test.ts` (registered and verified through the API + MailHog). Never share accounts between tests.
- Service workers are blocked in the default `chromium` project, so `page.route()` mocks see every request. PWA tests go in `tests/pwa.spec.ts`, which runs in the `pwa` project with service workers allowed. To go offline there, also abort the requests with `context.route()`: `context.setOffline()` alone doesn't stop the service worker's own fetches in Chromium.
- Offline-mode tests (`tests/pwa.spec.ts`) read the offline snapshot straight from IndexedDB (`offlineTodoTitles`) to wait until it is saved, and `goOnline()` lifts both the routes and the offline flag.
- Locate elements by role and accessible name (`getByRole`, `getByLabel`), in English (`locale: 'en-US'`). Keep selectors in page objects under `e2e/pages/`. Add `data-testid` to a template only when there is no accessible way to reach an element.

---

## Before you finish an e2e change

1. `npm run typecheck` in `e2e/` (CI runs it too).
2. `make test-e2e` passes.
