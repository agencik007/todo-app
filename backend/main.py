from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import os
from fastapi.staticfiles import StaticFiles
from routes.todo import router as todo_router
from routes.auth import router as auth_router
from routes.users import router as users_router
from config.database import engine, Base

# Load environment variables
load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create database tables on startup
    Base.metadata.create_all(bind=engine)
    yield
    # Cleanup if needed (optional)


# Create FastAPI app
app = FastAPI(
    title="Todo API",
    description="A simple Todo application API built with FastAPI",
    version="1.0.0",
    lifespan=lifespan,
)

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = (
        "max-age=31536000; includeSubDomains"
    )
    return response


# Trusted Host Middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "130.61.130.231", "testserver"],
)

# CORS middleware for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",  # Local development
        "http://127.0.0.1:4200",  # Local development (alternative)
        "http://130.61.130.231:4200",  # Oracle Cloud frontend
        "http://localhost:3000",  # Alternative local port
        "http://localhost:8080",  # Alternative local port
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploaded files directory
# Ensure directory exists
os.makedirs("uploadedFiles", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploadedFiles"), name="uploads")

# Include routers
app.include_router(auth_router)
app.include_router(todo_router)
app.include_router(users_router)  # Added users router


@app.get("/")
async def root():
    return {"message": "Todo API is running!"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
