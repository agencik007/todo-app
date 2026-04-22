# Todo App - Full-Stack Application

Todo App built with **Angular 21** + **Python FastAPI** + **PostgreSQL** using **Docker**.

## ✅ Project Status - Fully Functional!

🎉 **Application is working!** All components have been implemented and containerized.

### ✅ Completed Features:

- ✅ **FastAPI Backend** - REST API with full CRUD, PostgreSQL, Pydantic
- ✅ **Angular 21 Frontend** - Signals, Control Flow, Standalone Components, SSR
- ✅ **Docker** - Full containerization, multi-stage builds, production ready
- ✅ **Database** - PostgreSQL with persistent storage
- ✅ **Backend Tests** - 86 unit and integration tests with coverage
- ✅ **Simple Local Setup** - Single database for development and local testing

### 🚀 How to Run (3 Simple Steps):

```bash
git clone https://github.com/YOUR_USERNAME/todo-app.git
cd todo-app
make dev  # or: cd docker && docker-compose up --build
```

Open: http://localhost:4200

**Alternatively using Makefile:**

```bash
make dev      # Development mode
make prod     # Production mode
make status   # Check status
make logs     # View logs
```

### 📧 MailHog - Email Testing

The application uses **MailHog** for testing email functionalities (email verification, password reset). MailHog is a development SMTP server that catches all emails without sending real messages.

**How to use MailHog:**

1. MailHog starts automatically with docker-compose
2. Open your browser: **http://localhost:8025**
3. All emails sent by the application will appear in the MailHog interface
4. You can view content, headers, and test email features

**Note:** MailHog only runs in the development environment. In production, use a real SMTP server.

---

## 📋 Table of Contents

- [🚀 Quick Start](#-quick-start)
- [Project Description](#project-description)
- [Technologies](#technologies)
- [🐳 Docker - Detailed Documentation](#-docker---detailed-documentation)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Development](#development)

## 🎯 Project Description

A simple Todo application for task management with full CRUD (Create, Read, Update, Delete) support. The backend written in FastAPI provides a REST API, while the frontend in Angular 21 offers a modern user interface. Data is stored in a PostgreSQL database.

### Features

- ✅ Create new tasks
- ✅ Display a list of tasks
- ✅ Edit tasks
- ✅ Mark tasks as completed
- ✅ Delete tasks
- ✅ Responsive design

## 🛠 Technologies

### Backend

- **Python 3.12**
- **FastAPI** - modern web framework
- **SQLAlchemy** - ORM for databases
- **PostgreSQL** - database
- **Pydantic** - data validation
- **Uvicorn** - ASGI server

### Frontend

- **Angular 21** - frontend framework
- **TypeScript** - programming language
- **RxJS** - reactive programming
- **OpenAPI Generator** - generates TypeScript types from backend
- **PrimeNG** - UI component library

### DevOps

- **Docker** - containerization
- **Docker Compose** - container orchestration
- **PostgreSQL** - database in container

## 📋 Prerequisites

Before starting, ensure you have installed:

- **Python 3.12+** - [Download](https://www.python.org/downloads/)
- **Node.js 18+** - [Download](https://nodejs.org/)
- **PostgreSQL** - [Download](https://www.postgresql.org/download/)
- **Docker Desktop** - [Download](https://www.docker.com/products/docker-desktop/)
- **Git** - [Download](https://git-scm.com/)

## 🚀 Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd todo-app
```

### 2. Backend - Python/FastAPI

```bash
cd backend

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Frontend - Angular

```bash
cd frontend

# Install dependencies
npm install
```

### 4. PostgreSQL Database

```bash
# Run PostgreSQL and execute in psql:
CREATE USER todo_user WITH PASSWORD 'todo_password';
CREATE DATABASE todo_db OWNER todo_user;
GRANT ALL PRIVILEGES ON DATABASE todo_db TO todo_user;
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Database configuration
DATABASE_URL=postgresql://todo_user:todo_password@localhost:5432/todo_db

# Application settings
DEBUG=True
SECRET_KEY=your-secret-key-here
```

### Docker (Alternative Setup)

If you prefer using Docker, the entire application can be run in containers.

## 🏃‍♂️ Running the app

### Option 1: Running without Docker

#### Backend

```bash
cd backend
venv\Scripts\activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at: http://localhost:8000

#### Frontend

```bash
cd frontend
ng serve
```

The frontend will be available at: http://localhost:4200

### Option 2: Running with Docker

```bash
# Start all services
docker-compose up --build

# Or in detached mode
docker-compose up -d --build
```

## 📚 API Documentation

After running the backend, API documentation is available at:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Available endpoints

| Method | Endpoint      | Description           |
| ------ | ------------- | --------------------- |
| GET    | `/`           | Application status    |
| GET    | `/health`     | Health check          |
| GET    | `/todos`      | Get all tasks         |
| GET    | `/todos/{id}` | Get task by ID        |
| POST   | `/todos`      | Create new task       |
| PUT    | `/todos/{id}` | Update task           |
| DELETE | `/todos/{id}` | Delete task           |

### Example requests

```bash
# Get all tasks
curl http://localhost:8000/todos

# Create new task
curl -X POST http://localhost:8000/todos \
  -H "Content-Type: application/json" \
  -d '{"title": "My first task", "description": "Task description", "completed": false}'
```

---

## 🧪 Testing

### Backend - Tests (Pytest)

The application has a comprehensive suite of tests (currently **86**), including API tests for Todo, Auth, and Groups.

```bash
cd backend

# Run all tests
pytest

# Run a specific test file
pytest tests/test_groups.py -v

# With code coverage
pytest --cov=. --cov-report=html
```

> [!IMPORTANT]
> **Note:** Local tests use the same database as development. Running tests clears test data between cases, but treat the database as a working environment for your local experiments.

> [!NOTE]
> **Rate Limiting:** During tests, request throttling is disabled (`TESTING=1`), allowing for fast test execution.

### Frontend - Unit Tests

```bash
cd frontend

# Run tests
ng test

# With code coverage
ng test --code-coverage
```

## 🚀 Quick Start

### Prerequisites

- **Docker Desktop** installed and running

### Step 1: Clone the repository

```bash
git clone <repository-url>
cd todo-app
```

### Step 2: Start the application (Docker)

```bash
# Navigate to the docker directory
cd docker

# Start all services
docker-compose up --build
```

### Step 3: Access the app

Once started, open these in your browser:

- **📱 Frontend App**: http://localhost:4200
- **🔧 Backend API**: http://localhost:8000
- **📚 API Documentation**: http://localhost:8000/docs
- **🗄️ PgAdmin** (Database Manager): http://localhost:5050
  - Login: admin@example.com
  - Password: admin123

---

## 🐳 Docker - Detailed Documentation

### Application Architecture in Docker

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

### Launch Modes

#### Development Mode (with hot-reload)

```bash
# From the project root
make dev

# Or directly:
docker-compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml up -d
```

#### Production Mode

```bash
# From the project root
make prod

# Or directly:
docker-compose -f docker/docker-compose.yml up --build -d
```

### Useful Docker Commands

```bash
# List all available commands
make help

# Status of all containers
make status
# or: docker-compose ps

# Logs from all services
make logs
# or: docker-compose logs -f

# Logs from a single service
make logs-backend    # Backend logs
make logs-frontend   # Frontend logs
make logs-db         # Database logs
make logs-pgadmin    # PgAdmin logs

# Shell in a container
make shell-backend   # Terminal inside backend container
make shell-db        # Terminal inside database

# Restart all services
make restart

# Stop all services
make down

# Clean up (remove containers and volumes)
make clean          # Removes containers and images
make clean-volumes  # WARNING: Deletes database data!
```

### Using PgAdmin

PgAdmin is a web tool for managing PostgreSQL:

1. **Open**: http://localhost:5050
2. **Log in**:
   - Email: admin@example.com
   - Password: admin123

3. **Add Database Server**:
   - Click "Add New Server"
   - "General" tab: Name: "Todo Database"
   - "Connection" tab:
     - Host: db (or localhost if connecting from outside)
     - Port: 5432
     - Username: todo_user
     - Password: todo_password
     - Database: todo_db

4. **Browse data**:
   - Expand "Todo Database" → "Databases" → "todo_db" → "Schemas" → "public" → "Tables"
   - Right-click "todos" → "View/Edit Data" → "All Rows"

### Docker Configuration Files

#### Dockerfile.backend

- **Base**: Python 3.12 slim
- **Server**: Uvicorn with hot-reload
- **Security**: Non-root user
- **Health checks**: Socket connection test

#### Dockerfile.frontend

- **Base**: Node.js 22 Alpine (multi-stage)
- **Build**: Angular CLI production build
- **Server**: HTTP-Server for static files
- **Optimization**: Minification and compression

#### docker-compose.yml

- **Network**: Isolated todo-network
- **Volumes**: Persistent PostgreSQL data
- **Health checks**: Service dependencies
- **Ports**: Port mapping host:container

### Troubleshooting Docker

#### Problem: Port is already in use

```bash
# Check what process uses the port
netstat -ano | findstr :4200

# Change port in docker-compose.yml
ports:
  - "3000:4200"  # Use 3000 instead of 4200
```

#### Problem: Container keeps stopping

```bash
# Check logs
docker-compose logs frontend

# Check status
docker-compose ps

# Rebuild without cache
docker-compose build --no-cache frontend
```

#### Problem: Database isn't working

```bash
# Check connection
docker-compose exec db pg_isready -U todo_user -d todo_db

# Reset database
docker-compose down -v  # WARNING: Deletes all data!
docker-compose up --build db
```

#### Problem: Frontend not connecting to backend

```bash
# Check if backend works
curl http://localhost:8000/health

# Check Docker network
docker-compose exec frontend curl http://backend:8000/health
```

### Development workflow

1. **Code**: Edit files locally
2. **Build**: `docker-compose build` (only when modifying a Dockerfile)
3. **Run**: `docker-compose up` (automatically reloads code)
4. **Test**: Open http://localhost:4200 in the browser
5. **Debug**: `docker-compose logs -f` for real-time logs

### Production deployment

```bash
# Build for production
docker-compose -f docker/docker-compose.yml build

# Start in background
cd docker && docker-compose up -d

# Check status
docker-compose ps

# Monitoring
docker stats
```

### Database Backup and Restore

```bash
# Backup
docker-compose exec db pg_dump -U todo_user todo_db > backup.sql

# Restore
docker-compose exec -T db psql -U todo_user todo_db < backup.sql
```

## 🗄️ Database Management (Alembic)

The project uses **Alembic** for managing database migrations. This allows for versioning the database schema and making changes easily.

### Basic commands

All commands should be executed from the `backend/` directory.

```bash
# 1. Create a new migration (after modifying SQLAlchemy models)
alembic revision --autogenerate -m "change description"

# 2. Run pending migrations (update db)
alembic upgrade head

# 3. Rollback the last migration
alembic downgrade -1

# 4. Check current db version
alembic current
```

### Usage with Docker

If the app runs in containers, commands must be executed within the backend container:

```bash
docker-compose exec backend alembic upgrade head
```

---

## 📁 Project Structure

```
todo-app/
├── backend/                 # Python FastAPI backend
│   ├── config/
│   │   └── database.py      # Database configuration
│   ├── models/
│   │   ├── __init__.py
│   │   ├── todo.py          # Todo model
│   │   └── schemas.py       # Pydantic schemas
│   ├── routes/
│   │   └── todo.py          # API routes
│   ├── main.py              # Application entrypoint
│   ├── requirements.txt     # Python dependencies
│   └── .env                 # Environment variables
├── frontend/                # Angular frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/        # Core module
│   │   │   │   └── store/   # Signal-based stores (AuthStore)
│   │   │   ├── features/    # Feature modules
│   │   │   │   └── todos/
│   │   │   │       └── store/ # Feature stores (TodoStore)
│   │   │   ├── shared/      # Shared components
│   │   │   └── layout/      # Layout components
│   │   └── ...
│   ├── angular.json
│   ├── package.json
│   └── ...
├── docker/                  # Docker files
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   └── docker-compose.yml
├── README.md                # Polish README
├── README_en.md             # This file
└── .gitignore
```

## ✉️ API Message System

The application uses a centralized messaging structure between backend and frontend:

1.  **Backend (`api_messages.py`)**: All codes (e.g., `AUTH_LOGIN_SUCCESS`) are defined as an Enum.
    - When adding a new endpoint, append its code here.
    - Use `api_error()` for exceptions and `api_success()` for successes.
    - Always return appropriate HTTP status codes (200, 201, 400, 401, 403, 404).

2.  **Frontend (Toasts)**: `notificationInterceptor` automatically catches these codes and displays toasts.
3.  **Translations**: A map from codes to text content (PL/EN) sits in `frontend/src/assets/i18n/`.

## 🔧 Development

### Adding new features

1. **Backend**: Add a new endpoint in `routes/`, model in `models/`
2. **Frontend**: Create a new component in `components/`, service in `services/`
3. **Database**: Update SQLAlchemy model and generate a migration

### Best Practices

- **Backend**: Use Pydantic for validation, SQLAlchemy for queries
- **Frontend**: Rely on OnPush change detection, use trackBy functions
- **Git**: Commit often with descriptive messages
- **Tests**: Cover key business logic with tests

### Useful Commands

```bash
# Backend
uvicorn main:app --reload          # Development server
alembic revision --autogenerate    # Database migrations

# Frontend
ng generate component component-name  # Skeleton for a new component
ng generate service service-name      # Skeleton for a new service

# Docker
docker-compose logs -f service_name   # View container logs
docker-compose exec backend bash      # Shell into container
```

## 🤝 Contributing

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License. See the LICENSE file for details.

## 📞 Contact

Got questions? Feel free to reach out!

---

⭐ If you like this project, please consider giving it a star on GitHub!
