"""
Todo API - Main application entry point.

A simple Todo application API built with FastAPI.
"""

import os
import re
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import inspect as sa_inspect, text

from config.database import engine, Base
from routes import auth_router, todo_router, users_router, groups_router

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()


def _split_env_list(var_name: str) -> list[str]:
    """
    Parse a comma-separated env var into a list of non-empty values.

    Raises:
        RuntimeError: If the variable is unset or contains no usable values
            (e.g. a trailing comma left it empty after stripping).
    """
    raw = os.getenv(var_name)
    if not raw:
        raise RuntimeError(f"{var_name} must be set (comma-separated list).")

    values = [v.strip() for v in raw.split(",") if v.strip()]
    if not values:
        raise RuntimeError(f"{var_name} must contain at least one value.")

    return values


# Constants
UPLOAD_DIR = "uploadedFiles"
ALLOWED_HOSTS = _split_env_list("ALLOWED_HOSTS")
CORS_ORIGINS = _split_env_list("CORS_ORIGINS")


def _ensure_alembic_stamped() -> None:
    """
    Stamp the database at the current Alembic head if it doesn't have
    version tracking yet (e.g. it was just bootstrapped by create_all()
    below, on a fresh install).

    Without this, `alembic upgrade head` would later try to re-run every
    migration from scratch - including CREATE TABLE statements for tables
    create_all() already made - and fail with "already exists" errors.

    Writes directly through the `engine` used by this app (not Alembic's
    own env.py, which resolves its own DATABASE_URL from the environment
    and could target a different database than `engine` does, e.g. in
    tests where `engine` is swapped for a dedicated test database).
    Alembic's ScriptDirectory is only used to read the head revision id
    from the migration files - it doesn't touch any database.
    """
    if "alembic_version" in sa_inspect(engine).get_table_names():
        return

    from alembic.config import Config as AlembicConfig
    from alembic.script import ScriptDirectory

    try:
        alembic_cfg = AlembicConfig(str(Path(__file__).parent / "alembic.ini"))
        head_revision = ScriptDirectory.from_config(alembic_cfg).get_current_head()
        if head_revision is None:
            return

        with engine.begin() as conn:
            conn.execute(
                text(
                    "CREATE TABLE alembic_version ("
                    "version_num VARCHAR(32) NOT NULL, "
                    "CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num))"
                )
            )
            conn.execute(
                text("INSERT INTO alembic_version (version_num) VALUES (:rev)"),
                {"rev": head_revision},
            )
    except Exception:
        logger.exception("Failed to stamp Alembic revision after create_all()")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler - runs on startup and shutdown."""
    # Startup: Create database tables
    Base.metadata.create_all(bind=engine)
    _ensure_alembic_stamped()
    yield
    # Shutdown: Cleanup if needed


# Only expose interactive API docs outside production.
DEBUG = os.getenv("DEBUG", "False").lower() == "true"

# Create FastAPI app
app = FastAPI(
    title="Todo API",
    description="A simple Todo application API built with FastAPI",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if DEBUG else None,
    redoc_url="/redoc" if DEBUG else None,
    openapi_url="/openapi.json" if DEBUG else None,
)

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address, enabled=os.getenv("TESTING") != "1")
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """Handle rate limit exceeded errors."""
    return _rate_limit_exceeded_handler(request, exc)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Override the default validation exception handler to return error codes
    compatible with the frontend's API message system.
    """
    errors = exc.errors()

    # Check if any error message contains an AUTH_, TODO_, USER_, or GROUP_ code
    for error in errors:
        msg = error.get("msg", "")
        # Regex to find our API message codes in the Pydantic error message
        # (e.g. "Value error, AUTH_PASSWORD_TOO_COMMON")
        match = re.search(r"(AUTH_|TODO_|USER_|GROUP_)\w+", msg)
        if match:
            message_code = match.group(0)
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content={"detail": {"messageCode": message_code}},
            )

    # Fallback to default behavior
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": errors},
    )


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security headers to all responses."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = (
        "max-age=31536000; includeSubDomains"
    )
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "img-src 'self' data: https://fastapi.tiangolo.com; "
        "connect-src 'self' https://cdn.jsdelivr.net;"
    )
    return response


# Trusted Host Middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=ALLOWED_HOSTS,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploaded files directory
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Include routers
app.include_router(auth_router)
app.include_router(todo_router)
app.include_router(users_router)
app.include_router(groups_router)


@app.get("/", tags=["health"])
async def root():
    """Root endpoint - API status check."""
    return {"message": "Todo API is running!"}


@app.get("/health", tags=["health"])
async def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "healthy"}
