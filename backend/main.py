"""
Todo API - Main application entry point.

A simple Todo application API built with FastAPI.
"""

import os
import re
from contextlib import asynccontextmanager

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

from config.database import engine, Base
from routes import auth_router, todo_router, users_router, groups_router

# Load environment variables
load_dotenv()

# Constants
UPLOAD_DIR = "uploadedFiles"
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS").split(",")
CORS_ORIGINS = os.getenv("CORS_ORIGINS").split(",")

print("ALLOWED_HOSTS", ALLOWED_HOSTS)
print("CORS_ORIGINS", CORS_ORIGINS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler - runs on startup and shutdown."""
    # Startup: Create database tables
    Base.metadata.create_all(bind=engine)
    yield
    # Shutdown: Cleanup if needed


# Create FastAPI app
app = FastAPI(
    title="Todo API",
    description="A simple Todo application API built with FastAPI",
    version="1.0.0",
    lifespan=lifespan,
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
