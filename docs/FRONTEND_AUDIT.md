# Audyt frontendu — Todo App (Angular 21 + SSR)

**Data audytu:** 2026-07-11
**Zakres:** `frontend/` (Angular 21, SSR, PrimeNG 21, @angular/forms/signals, ngx-translate) + konfiguracja serwująca frontend (`docker/nginx.conf`, `docker/Dockerfile.frontend`, SSR `server.ts`)
**Branch:** `feature/ui-modifications`

Skala ocen: 🔴 Krytyczne · 🟠 Wysokie · 🟡 Średnie · 🔵 Niskie / informacyjne

---

## Podsumowanie wykonawcze

Frontend jest napisany **nowocześnie i solidnie jak na aplikację tej skali**: standalone components, signals + `linkedSignal`/`httpResource`, lazy loading tras, strict TypeScript, strict templates, ESLint + Prettier + husky/lint-staged. Model uwierzytelniania (access token wyłącznie w pamięci + refresh token w cookie HttpOnly) to **wzorcowe podejście** — dużo lepsze niż typowe trzymanie JWT w localStorage.

Największe problemy to nie kod aplikacji, tylko **otoczka**:

1. 🔴 **Znane podatności w zależnościach produkcyjnych** — w tym krytyczne SSRF/Open Redirect w `@angular/ssr` i bypass sanitizera XSS w `@angular/compiler`. Naprawialne przez `npm audit fix` (patche w linii 21.2.x).
2. 🔴 **Prawdziwe sekrety w pliku `docker/docker.prod.env` na dysku** (hasło do Postgresa, hasło SMTP Brevo). Plik nie jest śledzony przez git (zweryfikowano historię), ale leży w repo obok kodu i łatwo o wyciek.
3. 🟠 **Brak nagłówków bezpieczeństwa na serwerze SSR** oraz **fasadowe CSP + `Access-Control-Allow-Origin: *` w nginx.conf**.
4. 🟠 **Praktycznie brak testów** — 2 pliki spec na ~40 plików źródłowych.

Nie znaleziono żadnego użycia `innerHTML`, `bypassSecurityTrust*`, `eval` ani wstrzykiwania nietrustowanych danych do szablonów — warstwa XSS w kodzie aplikacji jest czysta.

---

## 1. Bezpieczeństwo

### 1.1 🔴 Podatności w zależnościach (npm audit)

Pełny audyt: **59 podatności (5 critical, 33 high)**; po zawężeniu do zależności produkcyjnych: **11 podatności (1 critical, 9 high, 1 moderate)**. Najważniejsze:

| Pakiet | Wersja | Waga | Podatność |
|---|---|---|---|
| `@angular/ssr` | 21.1.2 | **Critical** | SSRF + Header Injection (GHSA-x288-3778-4hhx), Open Redirect przez `X-Forwarded-Prefix` (GHSA-xh43-g2fq-wjrj i GHSA-69xr-m8h6-h664), Protocol-Relative URL Injection (GHSA-vfx2-hv2g-xj5f) |
| `@angular/compiler` / `@angular/core` | 21.1.2 | High | **Bypass sanitizera XSS**: Two-Way Property Binding Sanitization Bypass (GHSA-58w9-8g37-x9v5), Namespace Sanitization Bypass (GHSA-f3m7-gqxr-g87x) |
| `path-to-regexp` (przez Express 5) | 8.x | High | ReDoS (GHSA-j3q9-mxjg-w52f, GHSA-27v5-c462-wpq7) |
| `qs` (przez Express) | 6.x | Moderate | DoS przez parsowanie tablic |
| `vite`, `undici`, `ws`, `tar`, `tmp` (dev) | — | High | path traversal / smuggling / DoS — dotyczą środowiska deweloperskiego i buildu |

**Podatności SSR są szczególnie istotne**, bo aplikacja faktycznie działa w trybie `outputMode: server` z Expressem wystawionym w kontenerze (`Dockerfile.frontend` → `node dist/frontend/server/server.mjs`).

**Rekomendacja:** `npm audit fix` w `frontend/` (podnosi Angulara do 21.2.18/21.2.19 — wersje patch/minor w tej samej linii, niskie ryzyko regresji). Rozważyć dodanie `npm audit --omit=dev --audit-level=high` do CI.

### 1.2 🔴 Sekrety w `docker/docker.prod.env`

Plik zawiera **realne dane uwierzytelniające**: hasło PostgreSQL (`Jaksiemasz345`) oraz aktywny klucz SMTP Brevo (`xsmtpsib-5b46...`). Zweryfikowano: plik **nie jest i nigdy nie był commitowany** (jest w `.gitignore`, `git log --all` pusty). Mimo to:

- leży w drzewie projektu i jeden nieuważny `git add -f`, zip projektu lub udostępnienie katalogu = wyciek;
- hasło SMTP wygląda na produkcyjne i aktualne.

**Rekomendacja:** przenieść sekrety poza repo (np. do menedżera sekretów / zmiennych środowiskowych na serwerze), zrotować hasło SMTP Brevo i hasło DB. W repo trzymać wyłącznie `docker.env.example` z placeholderami (już istnieje).

### 1.3 🟠 nginx.conf — CSP fasadowe i CORS „allow all"

[docker/nginx.conf](docker/nginx.conf):

- **CSP w linii 54:** `default-src 'self' http: https: data: blob: 'unsafe-inline'` — taka polityka **dopuszcza wszystko** (dowolny zewnętrzny skrypt przez `http:`/`https:` + inline). Daje złudzenie ochrony, realnie nie chroni przed XSS wcale.
- **CORS w linii 74:** `Access-Control-Allow-Origin: *` na proxy `/todos` przy jednoczesnym dopuszczeniu nagłówka `Authorization` — niepotrzebnie otwiera API na żądania z dowolnego originu. CORS powinien obsługiwać backend (FastAPI) z konkretną listą originów, nie nginx z wildcardem.
- `X-XSS-Protection` (linia 51) — nagłówek przestarzały, ignorowany przez współczesne przeglądarki (nieszkodliwy, ale do usunięcia).
- Proxy obejmuje tylko `/todos` — brak `/auth`, `/users`, `/groups`, więc ta konfiguracja wygląda na **nieaktualną względem obecnego API** (frontend w compose i tak serwowany jest przez SSR node, nie nginx — plik wygląda na częściowo martwy artefakt; jeśli tak, warto go usunąć albo zaktualizować przed użyciem w prod).

**Rekomendowane CSP na start** (do dopracowania pod Google Fonts):
`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://api.open-meteo.com; frame-ancestors 'self'`

### 1.4 🟠 Serwer SSR (Express) bez nagłówków bezpieczeństwa

[frontend/src/server.ts](frontend/src/server.ts) serwuje aplikację bez żadnych nagłówków (`X-Content-Type-Options`, `frame-ancestors`/`X-Frame-Options`, `Referrer-Policy`, CSP, `Strict-Transport-Security`). Skoro w produkcji frontend serwuje właśnie ten proces (a nie nginx), nagłówki muszą być ustawiane tutaj (np. `helmet` z dostosowanym CSP) albo na odwrotnym proxy przed nim. Dodatkowo Express domyślnie wysyła `X-Powered-By: Express` — wyłączyć (`app.disable('x-powered-by')`).

### 1.5 🟡 `environment.prod.ts` wskazuje na `http://localhost:8000`

[environment.prod.ts](frontend/src/environments/environment.prod.ts) ma `apiUrl: 'http://localhost:8000'` — czyli build produkcyjny woła API po **HTTP bez TLS** i pod adresem lokalnym. Przed wdrożeniem musi tu trafić docelowa domena po **https** (cookie refresh tokena powinno mieć `Secure`; mieszanie http/https złamie też `withCredentials`).

### 1.6 🟡 Zewnętrzne zasoby: Google Fonts + open-meteo

- [index.html](frontend/src/index.html#L9-L11) ładuje font z `fonts.googleapis.com` — zewnętrzna zależność runtime (dostępność, prywatność/GDPR). Rozważyć self-hosting fontu (`@fontsource/jetbrains-mono`).
- [weather.service.ts](frontend/src/app/core/services/weather.service.ts#L15) woła `api.open-meteo.com` bezpośrednio z przeglądarki + korzysta z geolokalizacji użytkownika. OK funkcjonalnie, ale musi być ujęte w `connect-src` CSP; współrzędne użytkownika wysyłane są do strony trzeciej (warto odnotować w polityce prywatności).

### 1.7 🟢 Co jest zrobione dobrze (bezpieczeństwo)

- **Tokeny:** access token wyłącznie w pamięci (signal w [auth.service.ts](frontend/src/app/features/auth/services/auth.service.ts#L28-L30)), refresh token w cookie HttpOnly zarządzanym przez backend, `withCredentials` tylko tam gdzie trzeba, silent refresh w [auth.interceptor.ts](frontend/src/app/core/interceptors/auth.interceptor.ts) z retry po 401 i czyszczeniem sesji przy nieudanym refresh. To eliminuje kradzież tokenów przez XSS-localStorage — bardzo dobry wzorzec.
- **Interceptor dokleja `Authorization` tylko do żądań na własne API** (`req.url.startsWith(apiUrl)`) — brak wycieku tokena do zewnętrznych hostów (np. open-meteo).
- **Brak XSS w kodzie:** zero użyć `[innerHTML]`, `bypassSecurityTrust*`, `eval`, `document.write`. Jedyne użycie `DomSanitizer` w [user-profile.ts](frontend/src/app/layout/auth-nav/components/user-profile/user-profile.ts#L81-L88) to *sanityzacja* blob-URL avatara (poprawne, defensywne).
- **Kolory grup są whitelistowane** ([group-colors.config.ts](frontend/src/app/features/groups/config/group-colors.config.ts#L66-L68)) — `[style.border-color]` w badge nie przyjmie dowolnej wartości od użytkownika.
- **Guardy tras** (`authGuard`/`guestGuard`) + kontrola uprawnień w UI (`canEditTodo` porównuje `user.id === todo.userId`). UI-owa kontrola to tylko UX — egzekwowanie musi być po stronie API (jest, sądząc po generowanym kliencie).
- **`returnUrl`** w [login.ts](frontend/src/app/features/auth/components/login/login.ts#L100-L103) przechodzi przez `router.navigate([...])`, więc nie da się nim wywołać przekierowania na zewnętrzną domenę (brak open redirect).
- Avatar cache'owany w IndexedDB jako Blob — bez wykonywalnej treści, odczyt przez `URL.createObjectURL`.

### 1.8 🔵 Drobiazgi bezpieczeństwa

- Tokeny weryfikacji e-mail i resetu hasła podróżują w URL (path/query) — standardowe, ale trafiają do historii przeglądarki i logów serwera; upewnić się, że backend ma krótkie TTL i jednorazowość (to już domena backendu).
- `Dockerfile.frontend` używa `npm install --legacy-peer-deps` zamiast `npm ci` — build nie jest reprodukowalny i może dociągnąć inne wersje niż w lock file. Obraz nie definiuje użytkownika nie-root.
- Skrypt inline w [index.html](frontend/src/index.html#L12-L24) (anty-FOUC dla dark mode) wymusi `'unsafe-inline'` lub nonce/hash w przyszłym CSP — przy wdrażaniu CSP użyć hasha.

---

## 2. Jakość kodu

### 2.1 🟠 Testy praktycznie nie istnieją

W całym frontendzie są **2 pliki `.spec.ts`** (`app.spec.ts`, `command-palette.service.spec.ts`) przy ~40 plikach źródłowych. Zero testów dla: interceptorów (krytyczna logika refresh!), `AuthStore`, `TodoStore`, `GroupStore`, guardów, komponentów formularzy. Dodatkowo ESLint ignoruje pliki `*.spec.ts`, co nie zachęca do ich pisania.

**Rekomendacja:** zacząć od testów jednostkowych `authInterceptor` (scenariusze 401 → refresh → retry / refresh fail → logout), `AuthStore.initializeAuth` i logiki filtrowania w `TodoStore` — to najwyższy stosunek wartości do kosztu.

### 2.2 🟠 Błąd logiczny: drag & drop przy aktywnych filtrach przestawia złe elementy

[todo-list.ts](frontend/src/app/features/todos/components/todo-list/todo-list.ts#L359-L368): `onDrop` bierze indeksy z listy **przefiltrowanej** (`todos()` = `displayedTodos`), a [todo.store.ts `reorderTodo`](frontend/src/app/features/todos/store/todo.store.ts#L131-L158) wykonuje `splice` na **pełnej** liście `_todos`. Gdy aktywny jest filtr statusu, wyszukiwarka lub filtr grup, `event.currentIndex` wskazuje inną pozycję niż w pełnej liście → zadanie ląduje w złym miejscu (lokalnie i w API). Drag nie jest wyłączany podczas filtrowania.

**Rekomendacja:** wyłączyć `cdkDropList` gdy `isFiltered()` albo mapować indeksy z listy przefiltrowanej na pełną przed wywołaniem `reorderTodo`.

### 2.3 🟡 `any` osłabia strict mode

`tsconfig` ma `strict: true`, ale ESLint wyłącza `@typescript-eslint/no-explicit-any` ([eslint.config.js](frontend/eslint.config.js#L79)) i w kodzie jest ~20 użyć `any` / `as any`, m.in.:

- [auth.service.ts](frontend/src/app/features/auth/services/auth.service.ts#L84-L125) — sześć metod rzutowanych `as any`, bo typy wygenerowanego klienta nie pasują do deklarowanych `Observable<{message: string}>`. To ukrywa realną niezgodność kontraktu API (generator zwraca `ApiMessage`?) — lepiej poprawić typy generowane/openapi niż castować.
- [todo.store.ts](frontend/src/app/features/todos/store/todo.store.ts#L42-L44), [notification.interceptor.ts](frontend/src/app/core/interceptors/notification.interceptor.ts#L28-L30) — parsowanie `err.error?.detail?.messageCode` przez `any`; ten sam kształt błędu API jest wyciągany ręcznie w **co najmniej 5 miejscach** (login, register, reset-password, group.store, todo.store, interceptor). Wydzielić `extractApiMessageCode(err): string | null` + typ `ApiErrorBody` i włączyć `no-explicit-any` przynajmniej jako `warn`.
- [todo-list.ts](frontend/src/app/features/todos/components/todo-list/todo-list.ts#L432) — `getGroupById(...): any` zamiast `Group | undefined`.

### 2.4 🟡 `moment.js` — ciężka, zamrożona zależność użyta w 1 komponencie

`moment` (~300 kB z locale, projekt oficjalnie w trybie maintenance) jest importowany tylko w [todo-list.ts](frontend/src/app/features/todos/components/todo-list/todo-list.ts#L21-L22) do `formatDate`/`fromNow`. Do zastąpienia natywnym `Intl.DateTimeFormat` + `Intl.RelativeTimeFormat` (zero KB) albo `date-fns`/`dayjs`. Dodatkowo `moment.locale(lang)` w [getRelativeTime](frontend/src/app/features/todos/components/todo-list/todo-list.ts#L442-L448) mutuje **globalny** locale przy każdym wywołaniu renderu.

### 2.5 🟡 Fantomowa zależność `@angular/cdk`

Kod importuje `@angular/cdk/drag-drop` ([todo-list.ts](frontend/src/app/features/todos/components/todo-list/todo-list.ts#L1-L5)), ale `@angular/cdk` **nie jest zadeklarowany** w `frontend/package.json` — instaluje się tylko jako zależność przechodnia PrimeNG. Zmiana zależności PrimeNG może wywalić build. Dodać `@angular/cdk` do `dependencies`.

### 2.6 🟡 Wzorce async do uporządkowania

- **`setTimeout` jako synchronizacja** w 7 miejscach ([reset-password.ts:88](frontend/src/app/features/auth/components/reset-password/reset-password.ts#L88) — arbitralne 500 ms na pojawienie się tokenu; [login.ts:72](frontend/src/app/features/auth/components/login/login.ts#L72) — 100 ms na toast; [todo-list.ts:302](frontend/src/app/features/todos/components/todo-list/todo-list.ts#L302) — 100 ms na focus). Kruche; w reset-password lepiej użyć samego strumienia `route.params`/`queryParams` zamiast snapshot + subskrypcje + timeout (obecnie są **trzy** równoległe mechanizmy odczytu tokenu).
- **Subskrypcje bez sprzątania:** `route.params.subscribe` / `route.queryParams.subscribe` w konstruktorze reset-password oraz `router.events.subscribe` w [user-profile.ts](frontend/src/app/layout/auth-nav/components/user-profile/user-profile.ts#L66-L74) — brak `takeUntilDestroyed()`. Te komponenty żyją długo/wielokrotnie, więc to realne (choć drobne) wycieki. Ujednolicić: `takeUntilDestroyed(this.#destroyRef)` albo `toSignal()`.
- **Zagnieżdżone subscribe** (login → getCurrentUser, auth.store.initializeAuth) — działa, ale `switchMap`/`async-await` z `firstValueFrom` byłoby czytelniejsze i odporniejsze na wyścigi.
- [auth.store.ts `logout()`](frontend/src/app/core/store/auth.store.ts#L134-L140) — `subscribe()` bez obsługi błędu; jeśli request padnie, cookie po stronie serwera zostaje (UI i tak czyści stan, więc skutek ograniczony).

### 2.7 🟡 Niespójności stylu i drobiazgi

- **Mieszane konwencje pól:** część komponentów używa `readonly #private` (todo.store, user-profile), część `private readonly` (login, auth.store), a [theme.service.ts](frontend/src/app/core/services/theme.service.ts) ma inne wcięcia (2 spacje vs 4 w reszcie). AGENTS.md deklaruje konwencję — warto ją wyegzekwować lintem.
- **Numerowane komentarze sekcji** („// 1. Injects…", „// 2. Static constants… (None)") w [command-palette.ts](frontend/src/app/shared/components/command-palette/command-palette.ts) — puste sekcje to szum; lepiej usuwać nieużywane nagłówki.
- `handleError` w auth.service tylko re-throwuje błąd — martwa abstrakcja (`catchError(this.handleError)` = brak efektu).
- `deleteAvatar()` w [indexed-db.service.ts](frontend/src/app/core/services/indexed-db.service.ts#L81-L97) — wynik pierwszego `store.delete('currentUserAvatar')` jest ignorowany (promise resolve'uje po drugim delete); przy błędzie pierwszego nie ma odrzucenia.
- `initDb()` wywoływane w konstruktorze bez `await`/obsługi odrzucenia → potencjalny unhandled rejection przy starcie na przeglądarkach bez IndexedDB (tryb prywatny starych Safari).
- [check-email.ts](frontend/src/app/features/auth/components/check-email/check-email.ts#L32-L44) czyta `navigation.extras.state.email`, ale rejestracja przekazuje e-mail w `queryParams` — gałąź `state` wygląda na martwą.
- Klucz-hack `this.#languageService.currentLang();` w computed ([command-palette.ts:63](frontend/src/app/shared/components/command-palette/command-palette.ts#L63)) — działa, ale zasłużył na komentarz mniej przypadkowy / użycie `translate.stream`.

### 2.8 🟢 Mocne strony jakości

- Nowoczesny stack: standalone components, signals, `linkedSignal` + `httpResource` (todo.store), nowe `@angular/forms/signals` ze schematami walidacji — spójny, deklaratywny stan.
- `strict: true` + `strictTemplates` + `noImplicitReturns` + `noPropertyAccessFromIndexSignature` — bardzo dobra baza kompilatora.
- Lazy loading wszystkich tras (`loadComponent`), rozdział features/core/shared/layout, wygenerowany klient API z OpenAPI (`@api` alias) — czysta architektura.
- ESLint z `angular-eslint` (w tym **templateAccessibility**), Prettier z organize-imports/attributes, husky + lint-staged na frontend i backend.
- i18n kompletne (en/pl), atrybuty `aria-*`, role, obsługa klawiatury (skróty j/k/x//, focus management po zamknięciu dialogu) — poziom dostępności wyraźnie powyżej średniej.
- SSR z hydratacją (`provideClientHydration`) i poprawnym rozróżnianiem platform (`isPlatformBrowser` przed dostępem do `localStorage`/`indexedDB`).

---

## 3. Wydajność

- 🟡 **`getRelativeTime`/`formatDate`/`getGroupById` wywoływane z szablonu** ([todo-list.html](frontend/src/app/features/todos/components/todo-list/todo-list.html#L313-L364)) — funkcje w template odpalają się przy każdym cyklu CD (zone.js + eventCoalescing). Przy dużych listach: zamienić na pipe'y (pure) lub precompute w computed signal. `getGroupById` robi `find` po tablicy — przy okazji zamienić na `Map`.
- 🟡 **Budżet initial 2–4 MB** w [angular.json](frontend/angular.json#L49-L59) — bardzo liberalny (domyślne 500 kB/1 MB). Moment + PrimeNG + flag-icons łatwo go zapełnią; po wycięciu momenta warto zbić budżet, żeby regresje rozmiaru były widoczne.
- 🔵 Zone.js (`provideZoneChangeDetection`) — Angular 21 pozwala już na tryb zoneless; z signals ten projekt jest niemal gotowy na migrację (usunięcie zone.js = mniejszy bundle i mniej cykli CD). Nie jest to konieczne, ale naturalny następny krok.
- 🔵 `express.static` z `maxAge: '1y'` + `outputHashing: all` — poprawny cache-busting. 👍

---

## 4. Priorytetowa lista działań

| # | Priorytet | Działanie | Wysiłek |
|---|---|---|---|
| 1 | 🔴 | `npm audit fix` w `frontend/` (Angular 21.2.x — łata SSRF w SSR i bypass sanitizera XSS), weryfikacja builda | Mały |
| 2 | 🔴 | Rotacja hasła SMTP Brevo i hasła Postgres; przeniesienie `docker.prod.env` poza drzewo repo | Mały |
| 3 | 🟠 | Nagłówki bezpieczeństwa na serwerze SSR (helmet/własne) + realne CSP; naprawa lub usunięcie martwego `nginx.conf` (CSP, CORS `*`) | Średni |
| 4 | 🟠 | Poprawka reorder przy aktywnych filtrach (mapowanie indeksów lub blokada dragu) | Mały |
| 5 | 🟠 | Testy jednostkowe: authInterceptor, AuthStore, TodoStore | Średni |
| 6 | 🟡 | Ustawić produkcyjny `apiUrl` (https) w `environment.prod.ts` przed wdrożeniem | Mały |
| 7 | 🟡 | Zadeklarować `@angular/cdk` w dependencies | Trywialny |
| 8 | 🟡 | Usunąć `moment` → `Intl` API; obniżyć budżety bundle | Mały |
| 9 | 🟡 | Wspólny helper `extractApiMessageCode` + typ błędu API; włączyć `no-explicit-any` (warn) i posprzątać `as any` w auth.service | Średni |
| 10 | 🔵 | `takeUntilDestroyed` dla subskrypcji w komponentach; sprzątnięcie `setTimeout`-ów; `npm ci` + non-root user w Dockerfile.frontend | Mały |

---

*Audyt wykonany statycznie (przegląd kodu + `npm audit`); nie uruchamiano aplikacji ani testów penetracyjnych. Backend (FastAPI) nie był przedmiotem audytu poza punktami styku (cookies, CORS, proxy).*
