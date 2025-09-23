# Todo App - Full-Stack Application

Aplikacja Todo zbudowana w technologii **Angular 20** + **Python FastAPI** + **PostgreSQL** z wykorzystaniem **Docker** i **CI/CD**.

## ✅ Status projektu - W pełni funkcjonalny!

🎉 **Aplikacja działa!** Wszystkie komponenty zostały zaimplementowane i skonteneryzowane.

### ✅ Zrealizowane funkcjonalności:
- ✅ **Backend FastAPI** - REST API z pełnym CRUD, PostgreSQL, Pydantic
- ✅ **Frontend Angular 20** - Signals, Control Flow, Standalone Components, SSR
- ✅ **Docker** - Pełna konteneryzacja, multi-stage builds, production ready
- ✅ **Baza danych** - PostgreSQL z persistent storage
- 🔄 **Testy** - W trakcie implementacji
- ⏳ **CI/CD** - Planowane

### 🚀 Jak uruchomić (3 proste kroki):
```bash
git clone <repo>
cd todo-app/docker
docker-compose up --build
```
Otwórz: http://localhost:4200

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

| Metoda | Endpoint | Opis |
|--------|----------|------|
| GET | `/` | Status aplikacji |
| GET | `/health` | Health check |
| GET | `/todos` | Pobierz wszystkie zadania |
| GET | `/todos/{id}` | Pobierz zadanie po ID |
| POST | `/todos` | Utwórz nowe zadanie |
| PUT | `/todos/{id}` | Aktualizuj zadanie |
| DELETE | `/todos/{id}` | Usuń zadanie |

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
docker-compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml up --build
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
docker-compose -f docker/docker-compose.yml up -d

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

## 🔄 CI/CD

Projekt zawiera konfigurację GitHub Actions w `.github/workflows/`. Pipeline wykonuje:

1. **Linting** - sprawdzenie jakości kodu
2. **Testy** - uruchamianie testów jednostkowych
3. **Build** - budowanie aplikacji
4. **Deploy** - automatyczne wdrażanie (jeśli skonfigurowane)

### Lokalne uruchomienie CI/CD

```bash
# Uruchom linting
npm run lint  # frontend
black .       # backend (python)

# Uruchom testy
npm test      # frontend
pytest        # backend
```

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

