import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from config.database import Base, get_db
from models.todo import Todo
import os

# Test database URL - use SQLite for testing
TEST_DATABASE_URL = "sqlite:///./test.db"

# Create test engine
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

# Create test session
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# Create tables at module level
Base.metadata.create_all(bind=test_engine)

# Mock database configuration for tests
import config.database
config.database.engine = test_engine
config.database.SessionLocal = TestingSessionLocal

@pytest.fixture(scope="function")
def test_db():
    """
    Create a fresh database session for each test function.

    This fixture:
    1. Provides a database session for the test
    2. Cleans up data after each test (but keeps tables)
    """
    # Create a new session for the test
    db = TestingSessionLocal()

    try:
        yield db
    finally:
        # Clean up data but keep tables
        db.rollback()
        db.close()

@pytest.fixture(scope="function")
def client():
    """
    Test client fixture for FastAPI.

    This creates a test client that can make requests to our API
    without actually starting a server.
    """
    from fastapi.testclient import TestClient
    from main import app

    # Clear all data before each test
    db = TestingSessionLocal()
    try:
        # Delete all todos
        db.query(Todo).delete()
        db.commit()
    finally:
        db.close()

    # Override the database dependency to use our test database
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as client:
        yield client

    # Clean up
    app.dependency_overrides.clear()

@pytest.fixture(scope="function")
def sample_todo(test_db):
    """
    Create a sample todo for testing.

    Returns a Todo object that can be used in tests.
    """
    todo = Todo(
        title="Test Todo",
        description="This is a test todo item",
        completed=False
    )
    test_db.add(todo)
    test_db.commit()
    test_db.refresh(todo)
    return todo
