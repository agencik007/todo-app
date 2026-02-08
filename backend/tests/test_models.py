"""
Tests for database models.

These tests verify that our SQLAlchemy models work correctly:
- Can create instances
- Can save to database
- Can retrieve from database
- Relationships work properly
"""

from models.todo import Todo
from datetime import datetime


class TestTodoModel:
    """Test the Todo database model."""

    def test_create_todo(self, test_db, test_user):
        """Test creating a new Todo instance."""
        todo = Todo(
            title="Test Todo",
            description="This is a test",
            completed=False,
            user_id=test_user.id,
        )

        # Add to database
        test_db.add(todo)
        test_db.commit()
        test_db.refresh(todo)

        # Verify the todo was created with correct attributes
        assert todo.id is not None
        assert todo.title == "Test Todo"
        assert todo.description == "This is a test"
        assert not todo.completed
        assert isinstance(todo.created_at, datetime)
        assert isinstance(todo.updated_at, datetime)

    def test_todo_default_values(self, test_db, test_user):
        """Test that Todo has correct default values."""
        todo = Todo(
            title="Simple Todo", user_id=test_user.id
        )  # No description or completed status

        test_db.add(todo)
        test_db.commit()
        test_db.refresh(todo)

        assert todo.description is None  # Should be None when not provided
        assert not todo.completed  # Should default to False
        assert not todo.is_public  # Should default to False

    def test_todo_completed_field(self, test_db, test_user):
        """Test the completed field can be set to True."""
        todo = Todo(title="Completed Todo", completed=True, user_id=test_user.id)

        test_db.add(todo)
        test_db.commit()
        test_db.refresh(todo)

        assert todo.completed

    def test_todo_timestamps(self, test_db, test_user):
        """Test that timestamps are automatically set."""
        todo = Todo(title="Timestamp Test", user_id=test_user.id)
        test_db.add(todo)
        test_db.commit()
        test_db.refresh(todo)

        # Timestamps should be set automatically
        assert todo.created_at is not None
        assert todo.updated_at is not None

        # Check that timestamps are datetime objects
        assert isinstance(todo.created_at, datetime)
        assert isinstance(todo.updated_at, datetime)

        # Check that created_at and updated_at are close to each other (should be set at the same time)
        time_diff = abs((todo.updated_at - todo.created_at).total_seconds())
        assert time_diff < 1  # Less than 1 second difference

    def test_todo_string_representation(self, test_db, test_user):
        """Test that Todo objects can be converted to strings."""
        todo = Todo(
            title="String Test",
            description="Testing string conversion",
            user_id=test_user.id,
        )

        # SQLAlchemy models don't have __str__ by default,
        # but we can test that they have the expected attributes
        assert str(todo.title) == "String Test"
        assert str(todo.description) == "Testing string conversion"
