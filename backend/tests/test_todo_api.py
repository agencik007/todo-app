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

    def test_get_empty_todos(self, authenticated_client: TestClient):
        """Test GET /todos returns empty list when no todos exist."""
        response = authenticated_client.get("/todos")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    def test_create_todo(self, authenticated_client: TestClient):
        """Test POST /todos creates a new todo."""
        todo_data = {
            "title": "Test Todo",
            "description": "This is a test todo",
            "completed": False
        }

        response = authenticated_client.post("/todos", json=todo_data)

        assert response.status_code == 201  # Created
        data = response.json()

        # Verify response contains all expected fields
        assert data["id"] is not None
        assert data["title"] == "Test Todo"
        assert data["description"] == "This is a test todo"
        assert data["completed"] == False
        assert "created_at" in data
        assert "updated_at" in data
        assert "user_id" in data  # Should have user_id

    def test_create_todo_minimal(self, authenticated_client: TestClient):
        """Test POST /todos with minimal data (only title)."""
        todo_data = {"title": "Minimal Todo"}

        response = authenticated_client.post("/todos", json=todo_data)

        assert response.status_code == 201  # Created
        data = response.json()

        assert data["title"] == "Minimal Todo"
        assert data["description"] is None
        assert data["completed"] == False

    def test_create_todo_validation_error(self, authenticated_client: TestClient):
        """Test POST /todos rejects invalid data."""
        # Missing title
        response = authenticated_client.post("/todos", json={"description": "No title"})
        assert response.status_code == 422  # Validation error

        # Empty title
        response = authenticated_client.post("/todos", json={"title": ""})
        assert response.status_code == 422

    def test_get_todos_after_create(self, authenticated_client: TestClient):
        """Test GET /todos returns created todos."""
        # Create a todo first
        todo_data = {"title": "List Test Todo"}
        authenticated_client.post("/todos", json=todo_data)

        # Get all todos
        response = authenticated_client.get("/todos")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == "List Test Todo"

    def test_get_single_todo(self, authenticated_client: TestClient):
        """Test GET /todos/{id} returns specific todo."""
        # Create a todo first
        todo_data = {"title": "Single Todo"}
        create_response = authenticated_client.post("/todos", json=todo_data)
        todo_id = create_response.json()["id"]

        # Get the specific todo
        response = authenticated_client.get(f"/todos/{todo_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == todo_id
        assert data["title"] == "Single Todo"

    def test_get_nonexistent_todo(self, authenticated_client: TestClient):
        """Test GET /todos/{id} returns 404 for non-existent todo."""
        response = authenticated_client.get("/todos/999")

        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()

    def test_update_todo(self, authenticated_client: TestClient):
        """Test PUT /todos/{id} updates existing todo."""
        # Create a todo first
        todo_data = {"title": "Original Title", "completed": False}
        create_response = authenticated_client.post("/todos", json=todo_data)
        todo_id = create_response.json()["id"]

        # Update the todo
        update_data = {
            "title": "Updated Title",
            "description": "Updated description",
            "completed": True
        }
        response = authenticated_client.put(f"/todos/{todo_id}", json=update_data)

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == todo_id
        assert data["title"] == "Updated Title"
        assert data["description"] == "Updated description"
        assert data["completed"] == True

    def test_partial_update_todo(self, authenticated_client: TestClient):
        """Test PUT /todos/{id} allows partial updates."""
        # Create a todo first
        todo_data = {"title": "Original", "description": "Original desc", "completed": False}
        create_response = authenticated_client.post("/todos", json=todo_data)
        todo_id = create_response.json()["id"]

        # Update only the title
        update_data = {"title": "Only Title Changed"}
        response = authenticated_client.put(f"/todos/{todo_id}", json=update_data)

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Only Title Changed"
        assert data["description"] == "Original desc"  # Should remain unchanged
        assert data["completed"] == False  # Should remain unchanged

    def test_update_nonexistent_todo(self, authenticated_client: TestClient):
        """Test PUT /todos/{id} returns 404 for non-existent todo."""
        update_data = {"title": "Updated Title"}
        response = authenticated_client.put("/todos/999", json=update_data)

        assert response.status_code == 404

    def test_delete_todo(self, authenticated_client: TestClient):
        """Test DELETE /todos/{id} deletes existing todo."""
        # Create a todo first
        todo_data = {"title": "Todo to Delete"}
        create_response = authenticated_client.post("/todos", json=todo_data)
        todo_id = create_response.json()["id"]

        # Delete the todo
        response = authenticated_client.delete(f"/todos/{todo_id}")

        assert response.status_code == 200

        # Verify it's gone
        get_response = authenticated_client.get(f"/todos/{todo_id}")
        assert get_response.status_code == 404

        # Verify it's not in the list
        list_response = authenticated_client.get("/todos")
        data = list_response.json()
        assert len(data) == 0

    def test_delete_nonexistent_todo(self, authenticated_client: TestClient):
        """Test DELETE /todos/{id} returns 404 for non-existent todo."""
        response = authenticated_client.delete("/todos/999")

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

    def test_pagination_skip_limit(self, authenticated_client: TestClient):
        """Test GET /todos with skip and limit parameters."""
        # Create multiple todos
        for i in range(5):
            authenticated_client.post("/todos", json={"title": f"Todo {i}"})

        # Get first 2 todos
        response = authenticated_client.get("/todos?skip=0&limit=2")
        data = response.json()
        assert len(data) == 2

        # Get next 2 todos
        response = authenticated_client.get("/todos?skip=2&limit=2")
        data = response.json()
        assert len(data) == 2

        # Skip beyond available data
        response = authenticated_client.get("/todos?skip=10&limit=2")
        data = response.json()
        assert len(data) == 0

    def test_get_todos_requires_auth(self, client: TestClient):
        """Test GET /todos requires authentication."""
        response = client.get("/todos")
        assert response.status_code == 401

    def test_create_todo_requires_auth(self, client: TestClient):
        """Test POST /todos requires authentication."""
        todo_data = {"title": "Test Todo"}
        response = client.post("/todos", json=todo_data)
        assert response.status_code == 401
