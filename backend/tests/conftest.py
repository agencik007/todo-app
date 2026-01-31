# Set testing environment variable BEFORE any imports
# This disables rate limiting in routes/auth.py
import os
os.environ["TESTING"] = "1"

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from config.database import Base, get_db
from models.todo import Todo
from models.user import User
from services.auth_service import hash_password

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
        # Delete all data (order matters due to foreign keys)
        # Use delete() for each object to ensure proper cascade
        db.query(Todo).delete()
        db.query(User).delete()
        db.commit()
    except Exception:
        db.rollback()
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
    
    # Reset rate limiter storage to prevent rate limit issues between tests
    if hasattr(app.state, 'limiter') and app.state.limiter:
        try:
            app.state.limiter.reset()
        except Exception:
            # Some limiter implementations don't have reset()
            # In that case, try to clear the storage directly
            if hasattr(app.state.limiter, '_storage'):
                app.state.limiter._storage = {}

    with TestClient(app) as client:
        yield client

    # Clean up - only remove get_db override, not all overrides
    # This allows authenticated_client to keep its override
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture(scope="function")
def test_user(test_db):
    """
    Create a test user for testing.

    Returns a User object that can be used in tests.
    """
    # Check if user already exists and delete it first
    existing_user = test_db.query(User).filter(User.email == "test@example.com").first()
    if existing_user:
        test_db.delete(existing_user)
        test_db.commit()

    # Create new user
    user = User(
        email="test@example.com",
        hashed_password=hash_password("testpassword123"),
        is_active=True,
        is_verified=True,
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture(scope="function")
def authenticated_client(test_user):
    """
    Create an authenticated client for testing.

    Creates its own TestClient with all necessary dependency overrides.
    This bypasses OAuth2PasswordBearer token extraction completely.
    """
    from fastapi.testclient import TestClient
    from main import app
    from config.auth import get_current_user, get_current_active_user

    # Override get_db to use test database
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    # Override get_current_user to return test_user directly
    # This bypasses token verification completely
    async def override_get_current_user():
        return test_user

    async def override_get_current_active_user():
        if not test_user.is_active:
            from fastapi import HTTPException, status

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user"
            )
        return test_user

    # Apply all overrides
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_current_active_user] = override_get_current_active_user

    # Create client with all overrides applied
    with TestClient(app) as client:
        yield client

    # Clean up all overrides after test
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_current_active_user, None)


@pytest.fixture(scope="function")
def sample_todo(test_db, test_user):
    """
    Create a sample todo for testing.

    Returns a Todo object that can be used in tests.
    """
    todo = Todo(
        title="Test Todo",
        description="This is a test todo item",
        completed=False,
        user_id=test_user.id,
        is_public=False,
    )
    test_db.add(todo)
    test_db.commit()
    test_db.refresh(todo)
    return todo
