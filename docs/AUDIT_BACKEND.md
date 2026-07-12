# Audyt backendu — bezpieczeństwo, jakość kodu, zabezpieczenia

**Projekt:** Todo App (backend)
**Stack:** FastAPI 0.117 · SQLAlchemy 2.0 · PostgreSQL · JWT (python-jose) · bcrypt · slowapi · Alembic · Docker
**Data audytu:** 2026-07-11
**Zakres:** cały katalog `backend/` (~2 580 linii) + infrastruktura `docker/`
**Metoda:** ręczny przegląd kodu, analiza statyczna (`ruff` z regułami `S`/`B` = flake8-bandit), audyt zależności przez bazę OSV.dev, skan historii Git pod kątem sekretów.

> Raport ma charakter wyłącznie informacyjny — **nie wprowadzono żadnych zmian w kodzie**. Numeracja `ID` służy do odwoływania się przy naprawach.

---

## 1. Podsumowanie wykonawcze

Backend jest napisany starannie i ma solidne fundamenty bezpieczeństwa na poziomie **kodu aplikacji**: hasła są hashowane bcryptem (12 rund), tokeny jednorazowe przechowywane jako SHA-256, refresh token jest `HttpOnly`/`SameSite=strict` z rotacją, dostęp do danych ma poprawne kontrole właściciela (brak podatności IDOR na modyfikacji danych), a zapytania idą przez ORM (brak SQL injection). To dobra baza.

Najpoważniejsze ryzyka leżą jednak w **konfiguracji i warstwie wdrożeniowej**, nie w samej logice:

- **Krytyczne:** `docker-compose.yml` domyślnie startuje z publicznie znanym kluczem `SECRET_KEY=your-secret-key-here`, który **omija zabezpieczenie** w kodzie → możliwe fałszowanie tokenów JWT i przejęcie dowolnego konta.
- **Wysokie:** twarde, słabe hasła bazy i pgAdmina w wersjonowanym compose (używanym też jako „prod"); żywy klucz SMTP Brevo w pliku `docker.prod.env` na dysku; **9 zależności z aktywnymi CVE** (m.in. `python-multipart 0.0.9` z arbitrary file write i wieloma DoS, `starlette 0.48.0` z SSRF/DoS); kontener produkcyjny działa w trybie `--reload`.
- **Średnie:** SMTP STARTTLS bez weryfikacji certyfikatu, rate limiting nieskuteczny za reverse proxy, enumeracja użytkowników, testy uruchamiane na produkcyjnej bazie (kasują dane), brak walidacji zmiennych środowiskowych.

**Pozytyw:** sekrety **nie** wyciekły do historii Git (zweryfikowane — patrz sekcja 6).

### Tabela znalezisk

| ID | Waga | Obszar | Znalezisko |
|----|------|--------|-----------|
| C-1 | 🔴 Krytyczne | Sekrety | Domyślny `SECRET_KEY` w compose omija strażnika → fałszowanie JWT |
| H-1 | 🟠 Wysokie | Sekrety | Twarde hasła DB/pgAdmin w wersjonowanym `docker-compose.yml` (także „prod") |
| H-2 | 🟠 Wysokie | Sekrety | Żywy klucz SMTP Brevo + hasło DB w `docker.prod.env` (plaintext na dysku) |
| H-3 | 🟠 Wysokie | Zależności | 9 zależności z aktywnymi CVE (multipart, starlette, cryptography, dotenv, ecdsa) |
| H-4 | 🟠 Wysokie | Wdrożenie | Kontener produkcyjny: `uvicorn --reload` + bind-mount źródeł + ekspozycja portów DB/pgAdmin |
| M-1 | 🟡 Średnie | E-mail | STARTTLS bez kontekstu SSL → brak weryfikacji certyfikatu (MITM) |
| M-2 | 🟡 Średnie | Rate limit | Limity kluczowane po IP klienta — nieskuteczne za nginx/proxy |
| M-3 | 🟡 Średnie | Auth | Enumeracja użytkowników (różne błędy logowania + rejestracja + timing) |
| M-4 | 🟡 Średnie | Auth | Hasło >72 bajty → bcrypt rzuca wyjątek → 500 przy rejestracji (brak `max_length`) |
| M-5 | 🟡 Średnie | Testy | Testy używają produkcyjnego `DATABASE_URL` i kasują wszystkie rekordy |
| M-6 | 🟡 Średnie | Konfiguracja | Brak walidacji env (`ALLOWED_HOSTS`/`CORS_ORIGINS`/`DATABASE_URL`) → crash/misconfig |
| M-7 | 🟡 Średnie | Ekspozycja | `/docs`, `/redoc`, `/openapi.json` zawsze publiczne; flaga `DEBUG` nieużywana |
| M-8 | 🟡 Średnie | Auth | Brak unieważniania tokenów — logout nie kończy sesji, brak wykrywania reużycia refresh |
| M-9 | 🟡 Średnie | Wdrożenie | nginx proxuje tylko `/todos` — `/auth`, `/users`, `/groups` nietrasowane |
| L-1 | 🔵 Niskie | Upload | Brak weryfikacji zawartości pliku; całość wczytana do RAM przed sprawdzeniem rozmiaru |
| L-2 | 🔵 Niskie | Autoryzacja | 403 vs 404 zdradza istnienie cudzych zasobów |
| L-3 | 🔵 Niskie | Prywatność | Przewidywalne ścieżki `/uploads/{id}/avatar.*` — enumeracja awatarów |
| L-4 | 🔵 Niskie | Logowanie | `print()` z adresami e-mail (PII); brak konfiguracji logów i audytu zdarzeń auth |
| L-5 | 🔵 Niskie | Schemat | `create_all()` przy starcie współistnieje z migracjami Alembic → dryf schematu |
| L-6 | 🔵 Niskie | Wydajność | N+1 przy `todo.group`; zbędny join po e-mailu właściciela |
| I-* | ⚪ Info | Jakość | Chaining wyjątków (B904), dwie instancje limitera, CSP `unsafe-inline`, brak `pool_pre_ping` |

---

## 2. Znaleziska krytyczne

### C-1 — Domyślny `SECRET_KEY` w docker-compose omija zabezpieczenie kodu 🔴

**Lokalizacja:** [docker/docker-compose.yml:37](../docker/docker-compose.yml#L37), [backend/services/auth_service.py:20-25](../backend/services/auth_service.py#L20-L25)

Kod ma strażnika, który wygląda solidnie:

```python
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY or SECRET_KEY == "your-secret-key-here-change-in-production":
    raise ValueError("No secure SECRET_KEY set for application. ...")
```

Ale `docker-compose.yml` ustawia:

```yaml
- SECRET_KEY=${SECRET_KEY:-your-secret-key-here}
```

Wartość domyślna `your-secret-key-here` **różni się** od jedynego łańcucha blokowanego przez strażnika (`your-secret-key-here-change-in-production`), więc **przechodzi walidację**. Jeśli operator uruchomi `make prod` / `docker compose up` bez wyeksportowanego `SECRET_KEY`, aplikacja wystartuje z publicznie znanym, wpisanym w repozytorium kluczem podpisującym JWT.

**Scenariusz ataku:** atakujący zna klucz (jest w repo), więc może samodzielnie podpisać token dostępu `{"sub": "<dowolne_id>", "type": "access"}` i uwierzytelnić się jako **dowolny użytkownik** — pełne przejęcie kont, obejście weryfikacji e-mail i całej autoryzacji. Dodatkowo aktualny `SECRET_KEY` w `backend/.env` (`JakSieMasz12!@uFiSXu`, 19 znaków) jest zbyt krótki jak na HS256 (zalecane ≥ 32 bajty losowe).

**Rekomendacja:**
- Usunąć wartość domyślną z compose (`- SECRET_KEY=${SECRET_KEY:?SECRET_KEY must be set}` — `:?` wymusza błąd startu przy braku).
- Rozszerzyć strażnika w `auth_service.py` o blokadę **wszystkich** znanych placeholderów oraz minimalną długość (np. `len(SECRET_KEY) < 32 → raise`).
- Wygenerować realny klucz: `openssl rand -hex 32` i trzymać wyłącznie w środowisku/sekret-managerze.

---

## 3. Znaleziska wysokie

### H-1 — Twarde poświadczenia w wersjonowanym `docker-compose.yml` 🟠

**Lokalizacja:** [docker/docker-compose.yml:10-12](../docker/docker-compose.yml#L10-L12), [:35](../docker/docker-compose.yml#L35), [:133-138](../docker/docker-compose.yml#L133-L138)

Plik jest śledzony w Git i zawiera na sztywno:
- hasło Postgresa `todo_password` (linie 11 i 35 — także w `DATABASE_URL`),
- pgAdmin `admin@example.com` / `admin123` z `PGADMIN_CONFIG_SERVER_MODE: "False"` (linie 134-136).

Ten sam plik jest jednocześnie celem produkcyjnym (`Makefile`: `prod`, `up`, `quick-start` używają `docker-compose.yml`). Oznacza to, że „produkcja" domyślnie dostaje trywialne, publiczne hasła. pgAdmin wystawiony na `:5050` z hasłem `admin123` to bezpośrednia droga do bazy.

**Rekomendacja:** przenieść wszystkie poświadczenia do zmiennych `${...}` bez wartości domyślnych, dostarczanych z pliku env spoza repo; osobny compose dla prod bez pgAdmina (lub za VPN/siecią wewnętrzną).

### H-2 — Żywy klucz SMTP i hasło DB w `docker.prod.env` (plaintext) 🟠

**Lokalizacja:** [docker/docker.prod.env:8-10](../docker/docker.prod.env#L8-L10), [:26-27](../docker/docker.prod.env#L26-L27)

Plik zawiera realne, wyglądające na aktywne poświadczenia:
- `SMTP_PASSWORD=xsmtpsib-5b461add...` (klucz API Brevo),
- `SMTP_USER=a50feb001@smtp-brevo.com`,
- `POSTGRES_PASSWORD=Jaksiemasz345`.

**Dobra wiadomość:** plik jest objęty `.gitignore` ([.gitignore:83](../.gitignore#L83)) i **nie znajduje się w historii Git** (zweryfikowane, sekcja 6). Ryzyko nie dotyczy więc wycieku przez repozytorium, ale: (a) żywy sekret leży w czytelnej formie w katalogu roboczym i trafia do każdej kopii/backupu katalogu; (b) klucz API do bramki e-mail pozwala wysyłać pocztę „w imieniu" aplikacji.

**Rekomendacja:** potraktować klucz Brevo jako potencjalnie skompromitowany i **zrotować go**. Docelowo trzymać sekrety w menedżerze sekretów (Docker/Swarm secrets, Vault, zmienne CI/CD), nie w plikach `.env` na dysku.

### H-3 — Zależności z aktywnymi CVE 🟠

**Lokalizacja:** [backend/requirements.txt](../backend/requirements.txt)
**Źródło:** zapytanie wsadowe do OSV.dev (2026-07-11) na faktycznie zainstalowanych wersjach z `venv`.

| Pakiet | Wersja | CVE / GHSA | Waga | Opis | Naprawiono w |
|--------|--------|-----------|------|------|--------------|
| **python-multipart** | 0.0.9 | CVE-2026-24486 | HIGH | Arbitrary File Write (konfiguracja niedomyślna) | 0.0.22 |
| | | CVE-2024-53981 | HIGH | DoS przez zdeformowaną granicę `multipart/form-data` | 0.0.18 |
| | | CVE-2026-42561 | HIGH | DoS przez nieograniczone nagłówki części | 0.0.27 |
| | | CVE-2026-53539 | HIGH | DoS — kwadratowy czas parsowania querystring | 0.0.30 |
| | | CVE-2026-40347 | MODERATE | DoS przez duży preambuł/epilog multipart | 0.0.26 |
| | | +4 kolejne (LOW) | LOW | smuggling parametrów, ujemny Content-Length | 0.0.30/0.0.31 |
| **starlette** | 0.48.0 | CVE-2026-48818 | HIGH | SSRF / kradzież poświadczeń NTLM przez ścieżki UNC w `StaticFiles` (Windows) | 1.1.0 |
| | | CVE-2025-62727 | HIGH | DoS O(n²) przez nagłówek Range w `FileResponse` | 0.49.1 |
| | | CVE-2026-54283 | HIGH | Ignorowane limity `request.form()` → DoS | 1.3.1 |
| | | CVE-2026-48710 | MODERATE | Brak walidacji Host → zatruwanie `request.url.path`, obejście kontroli po ścieżce | 1.0.1 |
| | | CVE-2026-48817 | MODERATE | Dowolna metoda HTTP przez `getattr` w `HTTPEndpoint` | 1.1.0 |
| | | +2 (LOW) | LOW | zatruwanie hostname, smuggling | 1.3.0 |
| **cryptography** | 46.0.7 | GHSA-537c-gmf6-5ccf | HIGH | Podatny OpenSSL w koła (wheels) cryptography | 48.0.1 |
| **python-dotenv** | 1.1.1 | CVE-2026-28684 | MODERATE | Podążanie za symlinkiem w `set_key` (aplikacja nie używa `set_key`) | 1.2.2 |
| **ecdsa** (tranz. jose) | 0.19.2 | CVE-2024-23342 | HIGH | Atak czasowy Minerva na P-256 — **brak łatki** | brak |

Uwagi kontekstowe: `starlette StaticFiles` jest aktywnie używane (mount `/uploads`), a `python-multipart` obsługuje upload awatara — obie podatne biblioteki leżą na ścieżce żądań. `ecdsa` jest istotny tylko dla algorytmów EC w JWT; aplikacja używa HS256, więc podatność Minerva nie jest tu bezpośrednio eksploatowalna, ale pakiet pozostaje bez łatki. `python-jose 3.4.0` jest w porządku (starsze CVE algorithm-confusion naprawione w 3.4.0).

**Rekomendacja:** podnieść `python-multipart ≥ 0.0.31`, `starlette` do wersji zgodnej z aktualnym FastAPI (i przetestować — starlette 1.x bywa breaking), `cryptography ≥ 48.0.1`, `python-dotenv ≥ 1.2.2`. Wdrożyć `pip-audit` w CI jako bramkę. Zmienić `bcrypt>=4.0.0` na pinowaną wersję (patrz M-4).

### H-4 — Kontener produkcyjny w trybie deweloperskim 🟠

**Lokalizacja:** [docker/Dockerfile.backend:32](../docker/Dockerfile.backend#L32), [docker/docker-compose.yml:52-54](../docker/docker-compose.yml#L52-L54)

`CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]` — flaga `--reload` jest przeznaczona wyłącznie do developmentu (obserwator plików, jeden worker, wyższe zużycie zasobów, większa powierzchnia ataku). Dodatkowo compose montuje `../backend:/app`, nadpisując kod z obrazu żywym katalogiem hosta, a wszystkie porty (`5432`, `8000`, `5050`, `1025/8025`) są publikowane na host.

**Rekomendacja:** osobny `CMD` dla prod bez `--reload`, z wieloma workerami (np. `uvicorn ... --workers N` lub gunicorn+uvicorn workers); nie montować źródeł w prod; nie publikować portu bazy i pgAdmina na interfejs publiczny.

---

## 4. Znaleziska średnie

### M-1 — SMTP STARTTLS bez weryfikacji certyfikatu 🟡

**Lokalizacja:** [backend/services/email_service.py:152-156](../backend/services/email_service.py#L152-L156)

```python
with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
    server.ehlo(); server.starttls(); server.ehlo()
    server.login(SMTP_USER, SMTP_PASSWORD)
```

`starttls()` wywołane bez argumentu `context` powoduje, że `smtplib` buduje kontekst przez `ssl._create_stdlib_context()`, który ma `check_hostname=False` i `verify_mode=CERT_NONE`. Połączenie jest szyfrowane, ale **certyfikat serwera nie jest weryfikowany** — atakujący w pozycji MITM może podszyć się pod serwer SMTP i przechwycić poświadczenia logowania (`SMTP_USER`/`SMTP_PASSWORD`) oraz treść e-maili (w tym linki resetu hasła).

**Rekomendacja:** `server.starttls(context=ssl.create_default_context())`.

### M-2 — Rate limiting nieskuteczny za reverse proxy 🟡

**Lokalizacja:** [backend/main.py:55](../backend/main.py#L55), [backend/routes/auth.py:44](../backend/routes/auth.py#L44)

Limiter używa `key_func=get_remote_address`, który czyta `request.client.host`. Za nginx/proxy jest to zawsze adres proxy, nie klienta — aplikacja nie honoruje `X-Forwarded-For` (brak `ProxyHeadersMiddleware`/`--forwarded-allow-ips`). Efekt: albo wszyscy użytkownicy dzielą jeden wspólny limit (przy jednym proxy), albo limity brute-force na `/auth/login`, `/auth/forgot-password` itd. przestają chronić poszczególnych klientów. To osłabia kluczowy mechanizm anty-brute-force.

**Rekomendacja:** skonfigurować zaufane proxy i wyprowadzać klienta z `X-Forwarded-For` (własny `key_func` lub uvicorn `--proxy-headers --forwarded-allow-ips`). Docelowo backend rate-limitu na Redis (obecny jest in-memory, nie działa przy >1 workerze).

### M-3 — Enumeracja użytkowników 🟡

**Lokalizacja:** [backend/routes/auth.py:211-228](../backend/routes/auth.py#L211-L228), [:114-119](../backend/routes/auth.py#L114-L119), [backend/services/auth_service.py:169-174](../backend/services/auth_service.py#L169-L174)

Logowanie zwraca **rozróżnialne** odpowiedzi: `AUTH_INVALID_CREDENTIALS` (401) dla złych danych, ale `AUTH_EMAIL_NOT_VERIFIED` / `AUTH_INACTIVE_USER` (403) gdy konto istnieje — to potwierdza istnienie adresu w systemie. Rejestracja zwraca `AUTH_EMAIL_ALREADY_REGISTERED` (400), również ujawniając istnienie konta. Dodatkowo `authenticate_user` zwraca `None` natychmiast, gdy użytkownik nie istnieje (bez porównania hasła), co daje **różnicę czasową** (bcrypt liczy się tylko gdy użytkownik istnieje) — klasyczny kanał boczny do enumeracji.

Warto odnotować, że `/auth/forgot-password` jest zrobione **wzorowo** (zawsze zwraca sukces — brak enumeracji). Ta sama dyscyplina powinna objąć logowanie i rejestrację.

**Rekomendacja:** ujednolicić komunikat błędu logowania (te same 401 dla „nie ma konta / złe hasło / niezweryfikowane"); wykonywać „dummy" weryfikację hasła gdy użytkownik nie istnieje, by wyrównać czas; rozważyć zwracanie generycznej odpowiedzi przy rejestracji + potwierdzenie mailem.

### M-4 — Hasło dłuższe niż 72 bajty wywala rejestrację (500) 🟡

**Lokalizacja:** [backend/services/auth_service.py:54-70](../backend/services/auth_service.py#L54-L70), [backend/models/schemas.py:118-120](../backend/models/schemas.py#L118-L120), [requirements.txt:12](../backend/requirements.txt#L12)

`bcrypt` jest przypięty jako `bcrypt>=4.0.0`, a zainstalowana wersja to **5.0.0**, która rzuca `ValueError: password cannot be longer than 72 bytes` (zweryfikowane eksperymentalnie). Schemat `UserCreate.password` ma `min_length=8`, ale **brak `max_length`**. Rejestracja hasłem >72 bajtów przechodzi walidację Pydantic, po czym `hash_password` rzuca nieobsłużony wyjątek → **HTTP 500**. Przy logowaniu jest łagodniej (`verify_password` łapie wyjątek i zwraca `False`), ale niespójność jest myląca.

**Rekomendacja:** dodać `max_length=72` do `password`/`new_password` w schematach; przypiąć konkretną wersję bcrypt; ewentualnie z góry przyciąć do 72 bajtów w `hash_password`/`verify_password` dla spójności.

### M-5 — Testy uruchamiane na produkcyjnej bazie i kasują dane 🟡

**Lokalizacja:** [backend/tests/conftest.py:34](../backend/tests/conftest.py#L34), [:19-30](../backend/tests/conftest.py#L19-L30)

```python
TEST_DATABASE_URL = os.getenv("DATABASE_URL")   # ta sama baza co aplikacja
...
def cleanup_db(db):
    db.query(Todo).delete(); db.query(Group).delete(); db.query(User).delete(); db.commit()
```

Fikstura `db_cleanup` jest `autouse=True` i **usuwa wszystkie rekordy przed każdym testem**. Ponieważ testy dziedziczą `DATABASE_URL` z tego samego środowiska co aplikacja, uruchomienie `pytest` na maszynie z realnym `.env` **skasuje całą zawartość** tabel `todos`, `groups`, `users`. To realne ryzyko utraty danych, nie tylko kwestia higieny.

**Rekomendacja:** wymusić osobną bazę testową (`TEST_DATABASE_URL`), a najlepiej SQLite in-memory lub kontener efemeryczny; twardo przerwać, jeśli `DATABASE_URL` wskazuje bazę nietestową.

### M-6 — Brak walidacji zmiennych środowiskowych 🟡

**Lokalizacja:** [backend/main.py:30-31](../backend/main.py#L30-L31), [backend/config/database.py:16-19](../backend/config/database.py#L16-L19), [backend/.env:3](../backend/.env#L3)

```python
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS").split(",")   # None.split → AttributeError
CORS_ORIGINS  = os.getenv("CORS_ORIGINS").split(",")
...
engine = create_engine(DATABASE_URL)                    # DATABASE_URL może być None
```

Brak którejkolwiek z tych zmiennych powoduje `AttributeError`/`TypeError` przy imporcie — nieczytelny crash zamiast jasnego komunikatu. Dodatkowo `.env` ma `ALLOWED_HOSTS=localhost,127.0.0.1,192.168.1.155`, a `.env.example` — trailing comma (`...127.0.0.1,`), co daje **pusty string** na liście dozwolonych hostów w `TrustedHostMiddleware`.

**Rekomendacja:** scentralizować konfigurację w `pydantic-settings` (`BaseSettings`) z walidacją i sensownymi błędami; odfiltrować puste elementy po `split`; dostarczyć jawne wartości wymagane.

### M-7 — Interaktywna dokumentacja API zawsze publiczna; flaga `DEBUG` bez efektu 🟡

**Lokalizacja:** [backend/main.py:47-52](../backend/main.py#L47-L52)

`FastAPI(...)` nie ustawia `docs_url`/`redoc_url`/`openapi_url`, więc `/docs`, `/redoc` i `/openapi.json` są dostępne bez uwierzytelnienia również w produkcji, ujawniając pełną powierzchnię API. Jednocześnie zmienna `DEBUG` (ustawiona w `.env`, compose i override) **nigdzie nie jest czytana w kodzie** (potwierdzone grepem) — sugeruje intencję gatingu, która nie została zaimplementowana.

**Rekomendacja:** wyłączać docs w produkcji (`docs_url=None` gdy nie-dev) albo chronić je uwierzytelnieniem; faktycznie użyć flagi `DEBUG` do sterowania tym i innymi zachowaniami dev/prod.

### M-8 — Brak unieważniania tokenów; logout nie kończy sesji 🟡

**Lokalizacja:** [backend/routes/auth.py:472-491](../backend/routes/auth.py#L472-L491), [:297-299](../backend/routes/auth.py#L297-L299)

JWT są bezstanowe i nie ma listy odwołań (`jti`/blocklist). `/auth/logout` jedynie kasuje ciasteczko — skradziony **access token** pozostaje ważny do wygaśnięcia (15 min), a **refresh token** nie jest przechowywany po stronie serwera, więc jego kradzież daje 24 h dostępu. Rotacja refresh tokena istnieje, ale poprzedni token nie jest unieważniany (brak wykrywania reużycia — token replay). Krótki TTL access tokena łagodzi skutki, ale realny „server-side logout" i wykrywanie kradzieży refresh tokena nie istnieją.

**Rekomendacja:** przechowywać refresh tokeny (hash) po stronie serwera z możliwością unieważnienia i rotacją „reuse-detection"; opcjonalnie krótka blocklista `jti` dla access tokenów przy wylogowaniu/zmianie hasła. Zmiana hasła powinna unieważniać istniejące sesje.

### M-9 — nginx trasuje tylko `/todos` 🟡

**Lokalizacja:** [docker/nginx.conf:62](../docker/nginx.conf#L62), [:57-59](../docker/nginx.conf#L57-L59)

Reverse proxy ma `location /todos` kierujący do backendu, ale **nie ma** bloków dla `/auth`, `/users`, `/groups`, `/uploads`. Żądania do tych ścieżek wpadają w `location /` → `try_files ... /index.html` (Angular), więc przez nginx logowanie i rejestracja nie działają. W praktyce oznacza to albo że frontend odwołuje się do backendu bezpośrednio na `:8000` (co omija nginx i wystawia backend wprost, unieważniając nagłówki i CORS z proxy), albo że konfiguracja jest po prostu niekompletna. Dodatkowo blok `/todos` dokleja `Access-Control-Allow-Origin: *`, dublując i rozluźniając CORS ustawiony w FastAPI.

**Rekomendacja:** dodać trasowanie wszystkich prefiksów API do backendu (np. wspólny `location /api/` albo jawne bloki), ujednolicić CORS w jednym miejscu, nie wystawiać backendu bezpośrednio na świat.

---

## 5. Znaleziska niskie i informacyjne

### L-1 — Upload awatara: brak weryfikacji zawartości, pełne wczytanie do RAM 🔵
[backend/routes/users.py:48-62](../backend/routes/users.py#L48-L62) — walidowany jest `content_type` (nagłówek sterowany przez klienta) i rozszerzenie, ale nie faktyczna zawartość pliku (magic bytes). `contents = await file.read()` wczytuje **cały** plik do pamięci, a dopiero potem sprawdza limit 5 MB — w połączeniu z CVE `python-multipart` (ujemny `Content-Length`) daje wektor na zużycie pamięci. Path traversal jest poprawnie zablokowany (nazwa wymuszona na `avatar{ext}`), a SVG nie jest na liście (dobrze — brak XSS przez obraz). *Rekomendacja:* weryfikować sygnaturę pliku (np. `Pillow`/`python-magic`), strumieniować zapis i sprawdzać rozmiar w trakcie.

### L-2 — 403 vs 404 zdradza istnienie cudzych zasobów 🔵
[backend/routes/todo.py:116-129](../backend/routes/todo.py#L116-L129), analogicznie w `groups.py`. Gdy zasób istnieje, ale należy do kogoś innego, zwracane jest 403; gdy nie istnieje — 404. Pozwala to enumerować identyfikatory istniejących obiektów. *Rekomendacja:* zwracać 404 w obu przypadkach.

### L-3 — Przewidywalne ścieżki awatarów 🔵
[backend/main.py:128](../backend/main.py#L128), [backend/routes/users.py:95](../backend/routes/users.py#L95). Awatary są serwowane pod `/uploads/{user_id}/avatar.{ext}` bez autoryzacji, a `user_id` jest sekwencyjne — każdy może pobrać awatar dowolnego użytkownika przez zgadnięcie ID. *Rekomendacja:* losowe nazwy plików/UUID lub serwowanie przez endpoint z kontrolą dostępu, jeśli awatary mają być prywatne.

### L-4 — Logowanie przez `print()` i brak audytu 🔵
[backend/main.py:33-34](../backend/main.py#L33-L34), [backend/services/email_service.py:149](../backend/services/email_service.py#L149),[158](../backend/services/email_service.py#L158),[162](../backend/services/email_service.py#L162). `print()` zamiast `logging`, w tym wypisywanie adresów e-mail odbiorców (PII) i błędów wysyłki. Brak centralnej konfiguracji logów i brak logów audytowych zdarzeń bezpieczeństwa (nieudane logowania, resety hasła, zmiany hasła). *Rekomendacja:* ujednolicić na `logging` z poziomami; dodać audyt zdarzeń auth; nie logować PII w czystej formie.

### L-5 — `create_all()` przy starcie obok migracji Alembic 🔵
[backend/main.py:41](../backend/main.py#L41). `Base.metadata.create_all(bind=engine)` przy każdym starcie tworzy tabele bezpośrednio z modeli, omijając migracje. Przy rozjeździe modeli i migracji prowadzi to do niespójnego schematu i maskuje braki w migracjach. *Rekomendacja:* zrezygnować z `create_all` w aplikacji; polegać wyłącznie na `alembic upgrade head`.

### L-6 — N+1 i zbędny join 🔵
[backend/routes/todo.py:70-86](../backend/routes/todo.py#L70-L86). `response_model=Todo` zawiera `group`, którego lazy-load odpala osobne zapytanie na każde todo (N+1). Join po `User.email` jest zbędny, bo lista jest filtrowana po `user_id == current_user.id` — e-mail to zawsze `current_user.email`. *Rekomendacja:* `selectinload(Todo.group)` i użycie `current_user.email` zamiast joinu.

### Informacyjne (jakość kodu) ⚪

- **Chaining wyjątków (ruff B904):** [routes/auth.py:187](../backend/routes/auth.py#L187),[198](../backend/routes/auth.py#L198), [routes/users.py:89](../backend/routes/users.py#L89) — `raise ... from err`/`from None` dla czytelniejszych tracebacków.
- **Dwie instancje `Limiter`:** jedna w [main.py:55](../backend/main.py#L55) (ustawiona jako `app.state.limiter`), druga w [routes/auth.py:44](../backend/routes/auth.py#L44) (używana w dekoratorach). Enforcement działa przez domknięcie dekoratora, ale duplikacja jest myląca i krucha — warto mieć jeden współdzielony limiter.
- **CSP z `unsafe-inline`:** [main.py:101-107](../backend/main.py#L101-L107) — potrzebne dla Swagger UI; przy wyłączonych docsach w prod można zaostrzyć. Dla API (JSON) wpływ ograniczony.
- **Handler walidacji echo'uje `errors`:** [main.py:85-88](../backend/main.py#L85-L88) — fallback zwraca surową listę błędów Pydantic (może zawierać wartości wejściowe). Rozważyć okrojenie w prod.
- **Brak konfiguracji puli DB:** [config/database.py:19](../backend/config/database.py#L19) — `create_engine(DATABASE_URL)` bez `pool_pre_ping=True`/parametrów puli; ryzyko „stale connections".
- **`seed.py` z hasłem `admin123`:** [scripts/seed.py:24](../backend/scripts/seed.py#L24) — konto seedowe tworzone jako `is_verified=True` z trywialnym hasłem; upewnić się, że nie trafia na produkcję.
- **Pełny wynik `ruff`:** 373 zgłoszenia (w tym 240× `S101 assert` w testach — nieistotne, to normalny pattern pytest). Poza szumem realne pozycje: 3× B904, 2× S106/S107 (fałszywe alarmy — to nazwy `token_type`, nie hasła), kilka `UP`/`I` (modernizacja typów i sortowanie importów).

---

## 6. Sekrety i historia Git

Skan historii (`git log --all -S<sekret>` oraz `git log --all -- <ścieżki .env>`) **nie wykazał** wycieku aktualnych sekretów do repozytorium:

- `backend/.env` — nigdy nie był śledzony; brak w historii.
- `docker/docker.prod.env` — objęty `.gitignore`, brak w historii; obecny tylko w katalogu roboczym (patrz **H-2**).
- Klucz SMTP `xsmtpsib-...`, `SECRET_KEY JakSieMasz12...`, hasło `Jaksiemasz345` — **brak dopasowań** w całej historii.
- Historyczny `docker/docker.env` (usunięty w commicie `bdab870`) zawierał wyłącznie placeholdery (`your-secret-key-here-change-in-production`, `todo_password`), nie realne sekrety.

Wniosek: higiena repozytorium jest poprawna. Ryzyko dotyczy plaintextowych sekretów w katalogu roboczym i słabych domyślnych w wersjonowanym compose (C-1, H-1), nie samej historii.

---

## 7. Co jest zrobione dobrze ✅

Uczciwie — backend ma sporo poprawnych praktyk, które warto utrzymać:

- **Hashowanie haseł:** bcrypt z 12 rundami; `verify_password` odporne na wyjątki.
- **Tokeny jednorazowe:** verification/reset przechowywane jako SHA-256, jednorazowe (czyszczone po użyciu), z czasem ważności (24 h / 1 h).
- **Refresh token:** `HttpOnly`, `SameSite=strict`, `Secure` sterowane env, zawężony `path=/auth/refresh`, z rotacją przy każdym odświeżeniu.
- **Krótki TTL access tokena** (15 min) ogranicza okno kradzieży.
- **Walidacja siły hasła:** lista 20 000 popularnych haseł + wymóg unikalnych znaków.
- **Ochrona przed enumeracją w `forgot-password`** (zawsze sukces) — wzorcowo.
- **Kontrola właściciela** na wszystkich mutacjach todos/groups; walidacja `group_id` po właścicielu — brak IDOR na zapisie.
- **Brak SQL injection** — konsekwentnie ORM/parametryzacja.
- **Brak mass assignment** — `user_id` ustawiany wyłącznie po stronie serwera; schematy nie pozwalają nadpisać `id`/`user_id`.
- **Path traversal przy uploadzie zablokowany** (wymuszona nazwa `avatar{ext}`, whitelist rozszerzeń, brak SVG).
- **Nagłówki bezpieczeństwa** (`X-Content-Type-Options`, `X-Frame-Options`, HSTS, CSP) + `TrustedHostMiddleware`.
- **Rate limiting** na endpointach auth (choć wymaga poprawy za proxy — M-2).
- **Docker:** obraz backendu działa jako **użytkownik nie-root** i ma healthcheck.
- **Migracje Alembic** obecne i sensownie skonfigurowane (URL z env).
- **Testy:** 89 testów pokrywających auth/todos/groups/schematy (do naprawy jest izolacja bazy — M-5).

---

## 8. Sugerowana kolejność napraw

1. **Natychmiast:** C-1 (SECRET_KEY w compose + strażnik), H-2 (rotacja klucza SMTP), M-5 (izolacja bazy testów — ryzyko utraty danych).
2. **Krótki termin:** H-1, H-3 (aktualizacja zależności + `pip-audit` w CI), H-4, M-1, M-2, M-6.
3. **Średni termin:** M-3, M-4, M-7, M-8, M-9 oraz znaleziska L-*.
4. **Ciągłe:** dodać `ruff`/`pip-audit`/skan sekretów do pre-commit i CI (repo ma już husky + lint-staged z `ruff` dla `backend/**/*.py` — wystarczy dołożyć bramkę bezpieczeństwa).

---

*Raport wygenerowany w ramach audytu na żądanie. Nie modyfikowano kodu aplikacji ani konfiguracji — jedyną zmianą jest ten plik.*
