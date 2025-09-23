from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
from routes.todo import router as todo_router
from config.database import engine, Base

# Load environment variables
load_dotenv()

# Create database tables
Base.metadata.create_all(bind=engine)

# Create FastAPI app
app = FastAPI(
    title="Todo API",
    description="A simple Todo application API built with FastAPI",
    version="1.0.0"
)

# CORS middleware for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",        # Local development
        "http://127.0.0.1:4200",       # Local development (alternative)
        "http://130.61.130.231:4200",  # Oracle Cloud frontend
        "http://localhost:3000",        # Alternative local port
        "http://localhost:8080",        # Alternative local port
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(todo_router)

@app.get("/")
async def root():
    return {"message": "Todo API is running!"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}