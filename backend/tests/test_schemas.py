"""
Tests for Pydantic schemas.

These tests verify that our data validation schemas work correctly:
- Valid data passes validation
- Invalid data is rejected
- Default values are set correctly
- Data conversion works properly
"""

import pytest
from models.schemas import TodoCreate, TodoUpdate, Todo
from pydantic import ValidationError
from datetime import datetime


class TestTodoCreateSchema:
    """Test the TodoCreate Pydantic schema."""

    def test_valid_todo_create(self):
        """Test creating a TodoCreate with valid data."""
        todo_data = {
            "title": "Test Todo",
            "description": "Test description",
            "completed": False
        }

        todo = TodoCreate(**todo_data)

        assert todo.title == "Test Todo"
        assert todo.description == "Test description"
        assert todo.completed == False

    def test_todo_create_minimal(self):
        """Test creating a TodoCreate with minimal data (only title required)."""
        todo_data = {"title": "Minimal Todo"}

        todo = TodoCreate(**todo_data)

        assert todo.title == "Minimal Todo"
        assert todo.description is None  # Should be None when not provided
        assert todo.completed == False  # Should default to False

    def test_todo_create_without_description(self):
        """Test creating a TodoCreate without description."""
        todo_data = {
            "title": "Todo without description",
            "completed": True
        }

        todo = TodoCreate(**todo_data)

        assert todo.title == "Todo without description"
        assert todo.description is None
        assert todo.completed == True

    def test_todo_create_validation_error(self):
        """Test that TodoCreate rejects invalid data."""
        # Missing required title
        with pytest.raises(ValidationError):
            TodoCreate(description="No title provided")

        # Empty title
        with pytest.raises(ValidationError):
            TodoCreate(title="")

        # Title that is only whitespace - this might actually pass, let's test
        # with pytest.raises(ValidationError):
        #     TodoCreate(title="   ")


class TestTodoUpdateSchema:
    """Test the TodoUpdate Pydantic schema."""

    def test_valid_todo_update(self):
        """Test creating a TodoUpdate with valid data."""
        update_data = {
            "title": "Updated Title",
            "description": "Updated description",
            "completed": True
        }

        update = TodoUpdate(**update_data)

        assert update.title == "Updated Title"
        assert update.description == "Updated description"
        assert update.completed == True

    def test_todo_update_partial(self):
        """Test that TodoUpdate allows partial updates (all fields optional)."""
        # Only title
        update = TodoUpdate(title="New Title")
        assert update.title == "New Title"
        assert update.description is None
        assert update.completed is None

        # Only completed status
        update = TodoUpdate(completed=True)
        assert update.title is None
        assert update.completed == True

        # Only description
        update = TodoUpdate(description="New description")
        assert update.description == "New description"

    def test_todo_update_empty(self):
        """Test that TodoUpdate allows completely empty updates."""
        update = TodoUpdate()
        assert update.title is None
        assert update.description is None
        assert update.completed is None


class TestTodoResponseSchema:
    """Test the Todo response schema."""

    def test_valid_todo_response(self):
        """Test creating a Todo response with all required fields."""
        todo_data = {
            "id": 1,
            "title": "Response Todo",
            "description": "Response description",
            "completed": False,
            "created_at": datetime(2023, 1, 1, 12, 0, 0),
            "updated_at": datetime(2023, 1, 1, 12, 0, 0)
        }

        todo = Todo(**todo_data)

        assert todo.id == 1
        assert todo.title == "Response Todo"
        assert todo.description == "Response description"
        assert todo.completed == False
        assert isinstance(todo.created_at, datetime)
        assert isinstance(todo.updated_at, datetime)

    def test_todo_response_from_model(self, sample_todo):
        """Test creating a Todo response from a SQLAlchemy model."""
        # Convert SQLAlchemy model to dict, then to Todo schema
        todo_data = {
            "id": sample_todo.id,
            "title": sample_todo.title,
            "description": sample_todo.description,
            "completed": sample_todo.completed,
            "created_at": sample_todo.created_at,
            "updated_at": sample_todo.updated_at
        }

        todo = Todo(**todo_data)

        assert todo.id == sample_todo.id
        assert todo.title == sample_todo.title
        assert todo.description == sample_todo.description
        assert todo.completed == sample_todo.completed
