# Todo App - Full-Stack Application

Aplikacja Todo zbudowana w technologii **Angular 20** + **Python FastAPI** + **PostgreSQL** z wykorzystaniem **Docker** i **CI/CD**.

## ✅ Status projektu - W pełni funkcjonalny!

🎉 **Aplikacja działa!** Wszystkie komponenty zostały zaimplementowane i skonteneryzowane.

### ✅ Zrealizowane funkcjonalności:

- ✅ **Backend FastAPI** - REST API z pełnym CRUD, PostgreSQL, Pydantic
- ✅ **Frontend Angular 20** - Signals, Control Flow, Standalone Components, SSR
- ✅ **Docker** - Pełna konteneryzacja, multi-stage builds, production ready
- ✅ **Baza danych** - PostgreSQL z persistent storage
- ✅ **Testy backendu** - 29 testów jednostkowych z coverage
- ✅ **CI/CD** - GitHub Actions z automatycznym buildem i deployem

### 🚀 Jak uruchomić (3 proste kroki):

```bash
git clone https://github.com/YOUR_USERNAME/todo-app.git
cd todo-app
make dev  # lub: cd docker && docker-compose up --build
```

Otwórz: http://localhost:4200

**Alternatywnie z Makefile:**

```bash
make dev      # Development mode
make prod     # Production mode
make status   # Check status
make logs     # View logs
```

### 📧 MailHog - Email Testing

Aplikacja używa **MailHog** do testowania funkcji emailowych (weryfikacja emaila, reset hasła). MailHog to development SMTP server, który przechwytuje wszystkie emaile bez wysyłania prawdziwych wiadomości.

**Jak używać MailHog:**

1. MailHog uruchamia się automatycznie z docker-compose
2. Otwórz przeglądarkę: **http://localhost:8025**
3. Wszystkie emaile wysyłane przez aplikację pojawią się w interfejsie MailHog
4. Możesz przeglądać treść, nagłówki i testować funkcjonalności emailowe

**Uwaga:** MailHog działa tylko w środowisku deweloperskim. W produkcji użyj prawdziwego serwera SMTP.

---

## 📋 Spis treści

- [🚀 Szybkie uruchomienie aplikacji](#-szybkie-uruchomienie-aplikacji)
- [Opis projektu](#opis-projektu)
- [Technologie](#technologie)
- [🐳 Docker - Szczegółowa dokumentacja](#-docker---szczegółowa-dokumentacja)
- [API Documentation](#api-documentation)
- [Testowanie](#testowanie)
- [CI/CD](#cicd)
- [Struktura projektu](#struktura-projektu)
- [Rozwój](#rozwój)

## 🎯 Opis projektu

Prosta aplikacja Todo do zarządzania zadaniami z pełnym CRUD (Create, Read, Update, Delete). Backend napisany w FastAPI zapewnia REST API, podczas gdy frontend w Angular 20 oferuje nowoczesny interfejs użytkownika. Dane przechowywane są w bazie PostgreSQL.

### Funkcjonalności

- ✅ Tworzenie nowych zadań
- ✅ Wyświetlanie listy zadań
- ✅ Edycja zadań
- ✅ Oznaczanie zadań jako ukończone
- ✅ Usuwanie zadań
- ✅ Responsywny design

## 🛠 Technologie

### Backend

- **Python 3.12**
- **FastAPI** - nowoczesny framework webowy
- **SQLAlchemy** - ORM dla baz danych
- **PostgreSQL** - baza danych
- **Pydantic** - walidacja danych
- **Uvicorn** - serwer ASGI

### Frontend

- **Angular 20** - framework frontendowy
- **TypeScript** - język programowania
- **RxJS** - programowanie reaktywne
- **OpenAPI Generator** - generowanie typów TypeScript z backendu
- **Angular Material** (planowane)

### DevOps

- **Docker** - konteneryzacja
- **Docker Compose** - orkiestracja kontenerów
- **GitHub Actions** - CI/CD
- **PostgreSQL** - baza danych w kontenerze

## 📋 Wymagania wstępne

Przed rozpoczęciem upewnij się, że masz zainstalowane:

- **Python 3.12+** - [Pobierz](https://www.python.org/downloads/)
- **Node.js 18+** - [Pobierz](https://nodejs.org/)
- **PostgreSQL** - [Pobierz](https://www.postgresql.org/download/)
- **Docker Desktop** - [Pobierz](https://www.docker.com/products/docker-desktop/)
- **Git** - [Pobierz](https://git-scm.com/)

## 🚀 Instalacja

### 1. Klonowanie repozytorium

```bash
git clone <repository-url>
cd todo-app
```

### 2. Backend - Python/FastAPI

```bash
cd backend

# Tworzenie środowiska wirtualnego
python -m venv venv

# Aktywacja środowiska wirtualnego
# Windows:
venv\Scripts\activate
# Linux/Mac:
# source venv/bin/activate

# Instalacja zależności
pip install -r requirements.txt
```

### 3. Frontend - Angular

```bash
cd frontend

# Instalacja zależności
npm install
```

### 4. Baza danych PostgreSQL

```bash
# Uruchom PostgreSQL i wykonaj w psql:
CREATE USER todo_user WITH PASSWORD 'todo_password';
CREATE DATABASE todo_db OWNER todo_user;
GRANT ALL PRIVILEGES ON DATABASE todo_db TO todo_user;
```

## ⚙️ Konfiguracja

### Zmienne środowiskowe

Utwórz plik `.env` w katalogu `backend/`:

```env
# Database configuration
DATABASE_URL=postgresql://todo_user:todo_password@localhost:5432/todo_db

# Application settings
DEBUG=True
SECRET_KEY=your-secret-key-here
```

### Docker (alternatywna konfiguracja)

Jeśli wolisz używać Docker, cała aplikacja może być uruchomiona w kontenerach.

## 🏃‍♂️ Uruchomienie

### Opcja 1: Uruchomienie bez Docker

#### Backend

```bash
cd backend
venv\Scripts\activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend będzie dostępny na: http://localhost:8000

#### Frontend

```bash
cd frontend
ng serve
```

Frontend będzie dostępny na: http://localhost:4200

### Opcja 2: Uruchomienie z Docker

```bash
# Uruchom wszystkie serwisy
docker-compose up --build

# Lub w tle
docker-compose up -d --build
```

## 📚 API Documentation

Po uruchomieniu backendu, dokumentacja API jest dostępna pod adresami:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Dostępne endpointy

| Metoda | Endpoint      | Opis                      |
| ------ | ------------- | ------------------------- |
| GET    | `/`           | Status aplikacji          |
| GET    | `/health`     | Health check              |
| GET    | `/todos`      | Pobierz wszystkie zadania |
| GET    | `/todos/{id}` | Pobierz zadanie po ID     |
| POST   | `/todos`      | Utwórz nowe zadanie       |
| PUT    | `/todos/{id}` | Aktualizuj zadanie        |
| DELETE | `/todos/{id}` | Usuń zadanie              |

### Przykładowe żądania

```bash
# Pobierz wszystkie zadania
curl http://localhost:8000/todos

# Utwórz nowe zadanie
curl -X POST http://localhost:8000/todos \
  -H "Content-Type: application/json" \
  -d '{"title": "Moje pierwsze zadanie", "description": "Opis zadania", "completed": false}'
```

## 🧪 Testowanie

### Backend - Testy jednostkowe

```bash
cd backend

# Uruchom testy
pytest

# Z pokryciem kodu
pytest --cov=. --cov-report=html
```

> [!NOTE]
> **Rate Limiting:** Podczas uruchamiania testów (pytest), ograniczanie liczby żądań (rate limiting) jest automatycznie wyłączane za pomocą zmiennej środowiskowej `TESTING=1`. Pozwala to na szybkie wykonywanie testów bez blokowania żądań.

### Frontend - Testy jednostkowe

```bash
cd frontend

# Uruchom testy
ng test

# Z pokryciem kodu
ng test --code-coverage
```

## 🚀 Szybkie uruchomienie aplikacji

### Wymagania wstępne

- **Docker Desktop** zainstalowany i uruchomiony

### Krok 1: Klonowanie repozytorium

```bash
git clone <repository-url>
cd todo-app
```

### Krok 2: Uruchomienie aplikacji (Docker)

```bash
# Przejdź do katalogu docker
cd docker

# Uruchom wszystkie usługi
docker-compose up --build
```

### Krok 3: Dostęp do aplikacji

Po uruchomieniu otwórz w przeglądarce:

- **📱 Frontend aplikacji**: http://localhost:4200
- **🔧 Backend API**: http://localhost:8000
- **📚 Dokumentacja API**: http://localhost:8000/docs
- **🗄️ PgAdmin** (zarządzanie bazą): http://localhost:5050
  - Login: admin@example.com
  - Hasło: admin123

---

## 🐳 Docker - Szczegółowa dokumentacja

### Architektura aplikacji w Docker

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │────│    Backend      │────│   PostgreSQL    │
│   (Angular)     │    │   (FastAPI)     │    │   (Alpine)      │
│   Port: 4200    │    │   Port: 8000    │    │   Port: 5432    │
│   Single Page   │    │   REST API      │    │   Persistent    │
│   Application   │    │   + Swagger     │    │   Volume        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │    PgAdmin (optional)   │
                    │    Database Management  │
                    │    Port: 5050          │
                    │    Web UI for PostgreSQL│
                    └─────────────────────────┘
```

### Tryby uruchomienia

#### Tryb Development (z hot-reload)

```bash
# Z katalogu głównego projektu
make dev

# Lub bezpośrednio:
docker-compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml up -d
```

#### Tryb Production

```bash
# Z katalogu głównego projektu
make prod

# Lub bezpośrednio:
docker-compose -f docker/docker-compose.yml up --build -d
```

### Przydatne komendy Docker

```bash
# Lista wszystkich dostępnych komend
make help

# Status wszystkich kontenerów
make status
# lub: docker-compose ps

# Logs z wszystkich usług
make logs
# lub: docker-compose logs -f

# Logs tylko z jednej usługi
make logs-backend    # Backend logs
make logs-frontend   # Frontend logs
make logs-db         # Database logs
make logs-pgadmin    # PgAdmin logs

# Shell w kontenerze
make shell-backend   # Terminal w backend kontenerze
make shell-db        # Terminal w bazie danych

# Restart wszystkich usług
make restart

# Zatrzymanie wszystkich usług
make down

# Czyszczenie (usunięcie kontenerów i wolumenów)
make clean          # Usuwa kontenery i obrazy
make clean-volumes  # UWAGA: Usuwa dane bazy!
```

### Korzystanie z PgAdmin

PgAdmin to webowe narzędzie do zarządzania bazą danych PostgreSQL:

1. **Otwórz**: http://localhost:5050
2. **Zaloguj się**:
   - Email: admin@example.com
   - Hasło: admin123

3. **Dodaj serwer bazy danych**:
   - Kliknij "Add New Server"
   - Zakładka "General": Nazwa: "Todo Database"
   - Zakładka "Connection":
     - Host: db (lub localhost jeśli łączysz się z zewnątrz)
     - Port: 5432
     - Username: todo_user
     - Password: todo_password
     - Database: todo_db

4. **Przeglądaj dane**:
   - Rozwiń "Todo Database" → "Databases" → "todo_db" → "Schemas" → "public" → "Tables"
   - Kliknij prawym na "todos" → "View/Edit Data" → "All Rows"

### Pliki konfiguracyjne Docker

#### Dockerfile.backend

- **Baza**: Python 3.12 slim
- **Serwer**: Uvicorn z hot-reload
- **Bezpieczeństwo**: Non-root user
- **Health checks**: Socket connection test

#### Dockerfile.frontend

- **Baza**: Node.js 22 Alpine (multi-stage)
- **Build**: Angular CLI production build
- **Serwer**: HTTP-Server dla statycznych plików
- **Optymalizacja**: Minifikacja i kompresja

#### docker-compose.yml

- **Sieć**: Isolated todo-network
- **Volumes**: Persistent PostgreSQL data
- **Health checks**: Service dependencies
- **Ports**: Mapowanie portów host:container

### Troubleshooting Docker

#### Problem: Port już zajęty

```bash
# Sprawdź jaki proces używa portu
netstat -ano | findstr :4200

# Zmień port w docker-compose.yml
ports:
  - "3000:4200"  # Zamiast 4200 użyj 3000
```

#### Problem: Kontener się zatrzymuje

```bash
# Sprawdź logi
docker-compose logs frontend

# Sprawdź status
docker-compose ps

# Przebuduj bez cache
docker-compose build --no-cache frontend
```

#### Problem: Baza danych nie działa

```bash
# Sprawdź połączenie
docker-compose exec db pg_isready -U todo_user -d todo_db

# Reset bazy danych
docker-compose down -v  # UWAGA: Usuwa wszystkie dane!
docker-compose up --build db
```

#### Problem: Frontend nie łączy się z backendem

```bash
# Sprawdź czy backend działa
curl http://localhost:8000/health

# Sprawdź sieć Docker
docker-compose exec frontend curl http://backend:8000/health
```

### Development workflow

1. **Kod**: Edytuj pliki lokalnie
2. **Build**: `docker-compose build` (tylko gdy zmieniasz Dockerfile)
3. **Run**: `docker-compose up` (automatycznie przeładowuje kod)
4. **Test**: Otwórz http://localhost:4200 w przeglądarce
5. **Debug**: `docker-compose logs -f` dla logów w czasie rzeczywistym

### Production deployment

```bash
# Build dla produkcji
docker-compose -f docker/docker-compose.yml build

# Uruchom w tle
cd docker && docker-compose up -d

# Sprawdź status
docker-compose ps

# Monitoring
docker stats
```

### Backup i restore bazy danych

```bash
# Backup
docker-compose exec db pg_dump -U todo_user todo_db > backup.sql

# Restore
docker-compose exec -T db psql -U todo_user todo_db < backup.sql
```

## 🔄 CI/CD - GitHub Actions

Projekt zawiera kompleksową konfigurację CI/CD z GitHub Actions:

### 📋 Workflow CI/CD (`.github/workflows/ci-cd.yml`)

**Dla branchy `main` i `develop`:**

1. **🔍 Testy backendu** - pytest z coverage, PostgreSQL w kontenerze
2. **⚡ Testy frontendu** - linting, build produkcyjny
3. **🛡️ Skanowanie bezpieczeństwa** - Trivy vulnerability scanner
4. **🐳 Build obrazów Docker** - multi-stage builds dla backendu i frontendu
5. **📦 Push do GHCR** - GitHub Container Registry
6. **🚀 Deploy** - staging (develop) / production (main)

### 🔍 Workflow PR Checks (`.github/workflows/pr-checks.yml`)

**Dla Pull Requestów:**

1. **💅 Code Quality** - ESLint, Black, isort, mypy
2. **🔒 Dependency Security** - safety (Python), npm audit
3. **🐳 Docker Build Test** - walidacja obrazów

### 🚀 Pełna historia rozwoju CI/CD

Projekt przeszedł przez kilka iteracji konfiguracji CI/CD:

#### **Faza 1: Podstawowa konfiguracja**

- ✅ Utworzono repozytorium na GitHub
- ✅ Skonfigurowano podstawowe workflow dla backendu i frontendu
- ✅ Dodać testy jednostkowe dla backendu (pytest + SQLite)
- ✅ Frontend - usunięto testy Angular ze względu na problemy z konfiguracją

#### **Faza 2: Docker i deployment lokalny**

- ✅ Skonfigurowano pełne środowisko Docker (backend, frontend, PostgreSQL, PgAdmin)
- ✅ Utworzono multi-stage Dockerfiles
- ✅ Skonfigurowano docker-compose.yml
- ✅ Przetestowano lokalnie - wszystko działa

#### **Faza 3: CI/CD Pipeline**

- ✅ Skonfigurowano GitHub Actions workflow
- ✅ Dodać build obrazów Docker i push do GHCR
- ✅ Skonfigurowano deployment na Oracle Cloud
- ✅ Rozwiązano problemy z SSH połączeniem
- ✅ Dodać automatyczne czyszczenie kontenerów przed deploymentem
- ✅ Skonfigurowano health checks dla kontenerów

#### **Faza 4: Debugowanie i optymalizacja**

- ✅ Rozwiązano problemy z zatrzymywaniem się skryptu deployment
- ✅ Dodać szczegółową diagnostykę błędów
- ✅ Uproszczono logikę sprawdzania katalogów
- ✅ Dodano obsługę sudo dla Docker
- ✅ Skonfigurowano CORS dla Oracle Cloud

#### **Faza 5: Funkcjonalności dodatkowe**

- ✅ Dodać dark/light mode toggle dla frontendu
- ✅ Skonfigurowano localStorage dla preferencji użytkownika
- ✅ Zaimplementowano SSR-safe komponenty

### 🚨 Problemy napotkane i rozwiązania

#### **Problem 1: Skrypt deployment się zatrzymywał**

**Objawy:** Skrypt wykonywał się do sprawdzenia katalogu, potem `Process exited with status 1`
**Przyczyna:** Zbyt skomplikowana logika if-else z wieloma duplikatami kodu
**Rozwiązanie:** Przepisanie sekcji sprawdzania katalogu na czystą, prostą strukturę

#### **Problem 2: Konflikty z istniejącymi kontenerami**

**Objawy:** Nowe deployment nie mógł wystartować z powodu zajętych portów
**Przyczyna:** Poprzednie kontenery blokowały zasoby
**Rozwiązanie:** Dodanie automatycznego czyszczenia wszystkich kontenerów na początku deploymentu

#### **Problem 3: CORS errors na Oracle Cloud**

**Objawy:** Frontend nie mógł się połączyć z backend API
**Przyczyna:** CORS allow_origins nie zawierał adresu Oracle Cloud
**Rozwiązanie:** Dodanie `http://130.61.130.231:4200` do CORS middleware

#### **Problem 4: SSR ErrorEvent undefined**

**Objawy:** `ReferenceError: ErrorEvent is not defined` podczas Docker build
**Przyczyna:** Angular SSR nie rozpoznawał ErrorEvent w server-side środowisku
**Rozwiązanie:** Błąd nie przeszkadza w działaniu aplikacji, ale wymaga dalszego debugowania

#### **Problem 5: GitHub Actions deprecated actions**

**Objawy:** Workflow fail z powodu przestarzałych wersji actions
**Przyczyna:** `actions/upload-artifact@v3` i `github/codeql-action@v1` zostały zdeprecjonowane
**Rozwiązanie:** Aktualizacja do `v4` i `v3` odpowiednio

### 🏆 Końcowy rezultat

Aplikacja działa w pełni na Oracle Cloud:

- 🌐 **Frontend:** `http://130.61.130.231:4200` - Angular z dark/light mode
- 🔧 **Backend:** `http://130.61.130.231:8000` - FastAPI REST API
- 🗄️ **Database:** PostgreSQL z PgAdmin na porcie 5050
- 🚀 **CI/CD:** Automatyczny deployment przy każdym push do main

### 🔐 Konfiguracja Secrets (dla automatycznego deploymentu)

W repo na GitHub → **Settings** → **Secrets and variables** → **Actions**:

| Secret Name       | Opis                      | Przykład                       |
| ----------------- | ------------------------- | ------------------------------ |
| `SERVER_HOST`     | Adres IP instancji Oracle | `130.61.130.231`               |
| `SERVER_USER`     | Użytkownik SSH            | `ubuntu`                       |
| `SSH_PRIVATE_KEY` | Klucz prywatny SSH        | Cała zawartość `~/.ssh/id_rsa` |

**Jak wygenerować SSH key:**

```bash
# Na lokalnej maszynie
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"

# Skopiuj klucz publiczny na serwer
ssh-copy-id ubuntu@130.61.130.231

# Skopiuj klucz prywatny do GitHub secret
cat ~/.ssh/id_rsa
```

### 🌐 Deployment na Oracle Cloud

#### 1. Przygotowanie instancji OCI (Ubuntu):

```bash
# Połącz się z instancją (użytkownik domyślny to 'ubuntu')
ssh -i your-private-key ubuntu@130.61.130.231

# Aktualizuj system
sudo apt update && sudo apt upgrade -y

# Zainstaluj Docker
sudo apt install -y docker.io
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ubuntu

# Zainstaluj Docker Compose (alternatywne metody)
# Metoda 1: Plugin (dla nowszych wersji Docker)
sudo apt install -y docker-compose-plugin || {

# Metoda 2: Standalone binary (jeśli plugin nie działa)
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Metoda 3: Sprawdź czy docker-compose już jest dostępny
docker-compose version || echo "Docker Compose installation failed"
}

# Zainstaluj Git (jeśli nie jest zainstalowany)
sudo apt install -y git

# Sklonuj repo
git clone https://github.com/YOUR_USERNAME/todo-app.git
cd todo-app
```

#### 2. Konfiguracja środowiska:

```bash
# Utwórz plik .env
cp docker/docker.env .env
nano .env

# Przykładowa konfiguracja:
DATABASE_URL=postgresql://todo_user:SECURE_PASSWORD@db:5432/todo_db
SECRET_KEY=your-super-secure-secret-key-here
DEBUG=False
```

#### 3. Uruchomienie aplikacji:

```bash
# Przejdź do katalogu docker
cd docker

# Uruchom aplikację w tle
docker-compose up -d --build

# Sprawdź status kontenerów
docker-compose ps

# Zobacz logi (opcjonalnie)
docker-compose logs -f
```

#### 4. Firewall (jeśli potrzebne):

```bash
# Otwórz porty w Oracle Cloud firewall
# VPC → Security Lists → Dodaj reguły dla portów: 80, 4200, 8000, 5050

# Lub na instancji Ubuntu (UFW)
sudo ufw allow 4200/tcp
sudo ufw allow 8000/tcp
sudo ufw allow 5050/tcp
sudo ufw --force enable
```

#### 5. Konfiguracja Nginx (opcjonalnie dla domeny):

```bash
# Dla domeny, zainstaluj i skonfiguruj Nginx
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/todo-app

# Dodaj konfigurację:
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:4200;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Włącz konfigurację i wyłącz domyślną
sudo ln -s /etc/nginx/sites-available/todo-app /etc/nginx/sites-enabled/
sudo unlink /etc/nginx/sites-enabled/default

# Restartuj Nginx
sudo systemctl restart nginx
```

### 📊 Monitoring CI/CD

- **📈 Coverage Reports** - automatycznie wysyłane do Codecov
- **🛡️ Security Scans** - SARIF reports w GitHub Security
- **🐳 Container Images** - dostępne w `ghcr.io/YOUR_USERNAME/todo-app`

### 🚀 Lokalne uruchomienie CI/CD

```bash
# Backend - testy z coverage
cd backend
python -m pytest tests/ -v --cov=. --cov-report=html

# Frontend - linting i build
cd frontend
npm run lint
npm run build --configuration=production

# Docker - build test
docker build -f docker/Dockerfile.backend .
docker build -f docker/Dockerfile.frontend .
```

## 🗄️ Zarządzanie bazą danych (Alembic)

Projekt używa **Alembic** do zarządzania migracjami bazy danych. Pozwala to na wersjonowanie schematu bazy danych i łatwe wprowadzanie zmian.

### Podstawowe komendy

Wszystkie komendy powinny być wykonywane w katalogu `backend/`.

```bash
# 1. Stworzenie nowej migracji (po zmianie modeli SQLAlchemy)
alembic revision --autogenerate -m "opis zmian"

# 2. Uruchomienie oczekujących migracji (aktualizacja bazy)
alembic upgrade head

# 3. Cofnięcie ostatniej migracji
alembic downgrade -1

# 4. Sprawdzenie aktualnej wersji bazy
alembic current
```

### Użycie z Docker

Jeśli aplikacja działa w kontenerach, komendy należy wywołać wewnątrz kontenera backendu:

```bash
docker-compose exec backend alembic upgrade head
```

---

## 📁 Struktura projektu

```
todo-app/
├── backend/                 # Python FastAPI backend
│   ├── config/
│   │   └── database.py      # Konfiguracja bazy danych
│   ├── models/
│   │   ├── __init__.py
│   │   ├── todo.py          # Model Todo
│   │   └── schemas.py       # Pydantic schemas
│   ├── routes/
│   │   └── todo.py          # API routes
│   ├── main.py              # Główny plik aplikacji
│   ├── requirements.txt     # Zależności Python
│   └── .env                 # Zmienne środowiskowe
├── frontend/                # Angular frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/  # Komponenty Angular
│   │   │   ├── services/    # Serwisy
│   │   │   └── models/      # Modele TypeScript
│   │   └── ...
│   ├── angular.json
│   ├── package.json
│   └── ...
├── docker/                  # Pliki Docker
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   └── docker-compose.yml
├── .github/
│   └── workflows/           # CI/CD pipelines
├── README.md                # Ten plik
└── .gitignore
```

## 🔧 Rozwój

### Dodawanie nowych funkcjonalności

1. **Backend**: Dodaj nowy endpoint w `routes/`, model w `models/`
2. **Frontend**: Utwórz nowy komponent w `components/`, serwis w `services/`
3. **Baza danych**: Zaktualizuj model SQLAlchemy i uruchom migrację

### Najlepsze praktyki

- **Backend**: Używaj Pydantic do walidacji, SQLAlchemy do zapytań
- **Frontend**: Stosuj OnPush change detection, trackBy functions
- **Git**: Commituj często, używaj opisowych wiadomości
- **Testy**: Pokryj testami kluczową logikę biznesową

### Przydatne komendy

```bash
# Backend
uvicorn main:app --reload          # Development server
alembic revision --autogenerate    # Database migrations

# Frontend
ng generate component component-name  # Nowy komponent
ng generate service service-name      # Nowy serwis

# Docker
docker-compose logs -f service_name   # Logi z kontenera
docker-compose exec backend bash      # Shell w kontenerze
```

## 🤝 Przyczynianie się

1. Forknij projekt
2. Utwórz branch dla swojej funkcjonalności (`git checkout -b feature/AmazingFeature`)
3. Commituj zmiany (`git commit -m 'Add some AmazingFeature'`)
4. Pushuj do brancha (`git push origin feature/AmazingFeature`)
5. Otwórz Pull Request

## 📄 Licencja

Ten projekt jest dostępny na licencji MIT. Zobacz plik LICENSE dla szczegółów.

## 📞 Kontakt

Masz pytania? Napisz do mnie!

---

⭐ Jeśli projekt Ci się podoba, daj gwiazdkę na GitHub!
