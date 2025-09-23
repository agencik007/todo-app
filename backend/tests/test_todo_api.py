"""
Tests for Todo API endpoints.

These tests verify that our REST API works correctly:
- GET /todos - retrieve all todos
- GET /todos/{id} - retrieve single todo
- POST /todos - create new todo
- PUT /todos/{id} - update existing todo
- DELETE /todos/{id} - delete todo
"""

import pytest
from fastapi.testclient import TestClient


class TestTodoAPI:
    """Test the Todo REST API endpoints."""

    def test_get_empty_todos(self, client: TestClient):
        """Test GET /todos returns empty list when no todos exist."""
        response = client.get("/todos")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    def test_create_todo(self, client: TestClient):
        """Test POST /todos creates a new todo."""
        todo_data = {
            "title": "Test Todo",
            "description": "This is a test todo",
            "completed": False
        }

        response = client.post("/todos", json=todo_data)

        assert response.status_code == 200
        data = response.json()

        # Verify response contains all expected fields
        assert data["id"] is not None
        assert data["title"] == "Test Todo"
        assert data["description"] == "This is a test todo"
        assert data["completed"] == False
        assert "created_at" in data
        assert "updated_at" in data

    def test_create_todo_minimal(self, client: TestClient):
        """Test POST /todos with minimal data (only title)."""
        todo_data = {"title": "Minimal Todo"}

        response = client.post("/todos", json=todo_data)

        assert response.status_code == 200
        data = response.json()

        assert data["title"] == "Minimal Todo"
        assert data["description"] is None
        assert data["completed"] == False

    def test_create_todo_validation_error(self, client: TestClient):
        """Test POST /todos rejects invalid data."""
        # Missing title
        response = client.post("/todos", json={"description": "No title"})
        assert response.status_code == 422  # Validation error

        # Empty title
        response = client.post("/todos", json={"title": ""})
        assert response.status_code == 422

    def test_get_todos_after_create(self, client: TestClient):
        """Test GET /todos returns created todos."""
        # Create a todo first
        todo_data = {"title": "List Test Todo"}
        client.post("/todos", json=todo_data)

        # Get all todos
        response = client.get("/todos")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == "List Test Todo"

    def test_get_single_todo(self, client: TestClient):
        """Test GET /todos/{id} returns specific todo."""
        # Create a todo first
        todo_data = {"title": "Single Todo"}
        create_response = client.post("/todos", json=todo_data)
        todo_id = create_response.json()["id"]

        # Get the specific todo
        response = client.get(f"/todos/{todo_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == todo_id
        assert data["title"] == "Single Todo"

    def test_get_nonexistent_todo(self, client: TestClient):
        """Test GET /todos/{id} returns 404 for non-existent todo."""
        response = client.get("/todos/999")

        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()

    def test_update_todo(self, client: TestClient):
        """Test PUT /todos/{id} updates existing todo."""
        # Create a todo first
        todo_data = {"title": "Original Title", "completed": False}
        create_response = client.post("/todos", json=todo_data)
        todo_id = create_response.json()["id"]

        # Update the todo
        update_data = {
            "title": "Updated Title",
            "description": "Updated description",
            "completed": True
        }
        response = client.put(f"/todos/{todo_id}", json=update_data)

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == todo_id
        assert data["title"] == "Updated Title"
        assert data["description"] == "Updated description"
        assert data["completed"] == True

    def test_partial_update_todo(self, client: TestClient):
        """Test PUT /todos/{id} allows partial updates."""
        # Create a todo first
        todo_data = {"title": "Original", "description": "Original desc", "completed": False}
        create_response = client.post("/todos", json=todo_data)
        todo_id = create_response.json()["id"]

        # Update only the title
        update_data = {"title": "Only Title Changed"}
        response = client.put(f"/todos/{todo_id}", json=update_data)

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Only Title Changed"
        assert data["description"] == "Original desc"  # Should remain unchanged
        assert data["completed"] == False  # Should remain unchanged

    def test_update_nonexistent_todo(self, client: TestClient):
        """Test PUT /todos/{id} returns 404 for non-existent todo."""
        update_data = {"title": "Updated Title"}
        response = client.put("/todos/999", json=update_data)

        assert response.status_code == 404

    def test_delete_todo(self, client: TestClient):
        """Test DELETE /todos/{id} deletes existing todo."""
        # Create a todo first
        todo_data = {"title": "Todo to Delete"}
        create_response = client.post("/todos", json=todo_data)
        todo_id = create_response.json()["id"]

        # Delete the todo
        response = client.delete(f"/todos/{todo_id}")

        assert response.status_code == 200

        # Verify it's gone
        get_response = client.get(f"/todos/{todo_id}")
        assert get_response.status_code == 404

        # Verify it's not in the list
        list_response = client.get("/todos")
        data = list_response.json()
        assert len(data) == 0

    def test_delete_nonexistent_todo(self, client: TestClient):
        """Test DELETE /todos/{id} returns 404 for non-existent todo."""
        response = client.delete("/todos/999")

        assert response.status_code == 404

    def test_health_endpoint(self, client: TestClient):
        """Test GET /health endpoint."""
        response = client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"

    def test_root_endpoint(self, client: TestClient):
        """Test GET / root endpoint."""
        response = client.get("/")

        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "Todo API" in data["message"]

    def test_pagination_skip_limit(self, client: TestClient):
        """Test GET /todos with skip and limit parameters."""
        # Create multiple todos
        for i in range(5):
            client.post("/todos", json={"title": f"Todo {i}"})

        # Get first 2 todos
        response = client.get("/todos?skip=0&limit=2")
        data = response.json()
        assert len(data) == 2

        # Get next 2 todos
        response = client.get("/todos?skip=2&limit=2")
        data = response.json()
        assert len(data) == 2

        # Skip beyond available data
        response = client.get("/todos?skip=10&limit=2")
        data = response.json()
        assert len(data) == 0
