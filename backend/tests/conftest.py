# Set testing environment variable BEFORE any imports
# This disables rate limiting in routes/auth.py
import os

os.environ["TESTING"] = "1"
os.environ["ALLOWED_HOSTS"] = "localhost,127.0.0.1,testserver"

import pytest  # noqa: E402
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from config.database import Base, get_db
from models.todo import Todo
from models.user import User
from models.group import Group
from services.auth_service import hash_password


def cleanup_db(db):
    """Utility function to clear all data from database."""
    try:
        # Delete items in reverse dependency order
        db.query(Todo).delete()
        db.query(Group).delete()
        db.query(User).delete()
        db.commit()
    except Exception:
        db.rollback()


# Test database URL
# Isolation: Use DATABASE_TEST_URL (todo_db_test) if available,
# otherwise fallback to DATABASE_URL but append _test for safety if it looks like a dev URL
TEST_DATABASE_URL = os.getenv("DATABASE_TEST_URL")
if not TEST_DATABASE_URL:
    original_url = os.getenv("DATABASE_URL")
    if original_url and "todo_db" in original_url and "test" not in original_url:
        TEST_DATABASE_URL = original_url.replace("todo_db", "todo_db_test")
    else:
        TEST_DATABASE_URL = original_url

# Create test engine
test_engine = create_engine(TEST_DATABASE_URL)

# Create test session
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# Create tables at module level
Base.metadata.create_all(bind=test_engine)

# Mock database configuration for tests
import config.database  # noqa: E402

config.database.engine = test_engine
config.database.SessionLocal = TestingSessionLocal


@pytest.fixture(scope="function", autouse=True)
def db_cleanup():
    """
    Clean up database before each test.
    This is an autouse fixture so it runs for every test.
    """
    db = TestingSessionLocal()
    try:
        cleanup_db(db)
        yield
    finally:
        db.close()


@pytest.fixture(scope="function")
def test_db():
    """
    Create a fresh database session for each test function.
    """
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        # Final rollback/close for safety
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

    # Reset rate limiter storage to prevent rate limit issues between tests
    if hasattr(app.state, "limiter") and app.state.limiter:
        try:
            app.state.limiter.reset()
        except Exception:
            # Some limiter implementations don't have reset()
            # In that case, try to clear the storage directly
            if hasattr(app.state.limiter, "_storage"):
                app.state.limiter._storage = {}

    # Dependency override
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
    from config.auth import (
        get_current_user,
        get_current_active_user,
        get_current_verified_user,
    )

    # Override get_db to use test database
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    # Overrides for current user
    async def override_get_current_user():
        return test_user

    async def override_get_current_active_user():
        if not test_user.is_active:
            from fastapi import HTTPException, status

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user"
            )
        return test_user

    async def override_get_current_verified_user():
        if not test_user.is_verified:
            from fastapi import HTTPException, status

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Email not verified"
            )
        return test_user

    # Apply all overrides
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_current_active_user] = override_get_current_active_user
    app.dependency_overrides[get_current_verified_user] = (
        override_get_current_verified_user
    )

    # Create client with all overrides applied
    with TestClient(app) as client:
        yield client

    # Clean up all overrides after test
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_current_active_user, None)
    app.dependency_overrides.pop(get_current_verified_user, None)


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


@pytest.fixture(scope="function")
def sample_group(test_db, test_user):
    """
    Create a sample group for testing.
    """
    group = Group(name="Test Group", color="blue", user_id=test_user.id)
    test_db.add(group)
    test_db.commit()
    test_db.refresh(group)
    return group


@pytest.fixture(scope="function")
def second_user(test_db):
    """
    Create a second test user for isolation testing.
    """
    # Check if user already exists
    existing_user = (
        test_db.query(User).filter(User.email == "second@example.com").first()
    )
    if existing_user:
        test_db.delete(existing_user)
        test_db.commit()

    user = User(
        email="second@example.com",
        hashed_password=hash_password("testpassword123"),
        is_active=True,
        is_verified=True,
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture(scope="function")
def second_authenticated_client(second_user):
    """
    Create an authenticated client for the second test user.
    """
    from fastapi.testclient import TestClient
    from main import app
    from config.auth import (
        get_current_user,
        get_current_active_user,
        get_current_verified_user,
    )

    # Override get_db to use test database
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    # Overrides for second_user
    async def override_get_current_user():
        return second_user

    async def override_get_current_active_user():
        return second_user

    async def override_get_current_verified_user():
        return second_user

    # Apply all overrides
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_current_active_user] = override_get_current_active_user
    app.dependency_overrides[get_current_verified_user] = (
        override_get_current_verified_user
    )

    # Create client
    with TestClient(app) as client:
        yield client

    # Clean up
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_current_active_user, None)
    app.dependency_overrides.pop(get_current_verified_user, None)
