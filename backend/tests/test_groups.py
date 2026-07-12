"""
Tests for Group API endpoints.
"""

from fastapi.testclient import TestClient
from models.todo import Todo
from models.group import Group


class TestGroupAPI:
    """Test the Group REST API endpoints."""

    # =============================================================================
    # GET /groups
    # =============================================================================

    def test_get_empty_groups(self, authenticated_client: TestClient):
        """Test GET /groups returns empty list when no groups exist."""
        response = authenticated_client.get("/groups")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    def test_get_groups_after_create(
        self, authenticated_client: TestClient, sample_group
    ):
        """Test GET /groups returns created groups."""
        response = authenticated_client.get("/groups")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == sample_group.name
        assert data[0]["id"] == sample_group.id

    def test_get_groups_requires_auth(self, client: TestClient):
        """Test GET /groups requires authentication."""
        response = client.get("/groups")
        assert response.status_code == 401

    def test_get_groups_isolation_owner(
        self, authenticated_client: TestClient, sample_group
    ):
        """Test that owner can see their own group."""
        response = authenticated_client.get("/groups")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == sample_group.id

    def test_get_groups_isolation_other_user(
        self, second_authenticated_client: TestClient, sample_group
    ):
        """Test that another user cannot see the group."""
        response = second_authenticated_client.get("/groups")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 0

    # =============================================================================
    # GET /groups/{id}
    # =============================================================================

    def test_get_single_group(self, authenticated_client: TestClient, sample_group):
        """Test GET /groups/{id} returns specific group."""
        response = authenticated_client.get(f"/groups/{sample_group.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_group.id
        assert data["name"] == sample_group.name

    def test_get_nonexistent_group(self, authenticated_client: TestClient):
        """Test GET /groups/{id} returns 404 for non-existent group."""
        response = authenticated_client.get("/groups/999")
        assert response.status_code == 404
        assert response.json()["detail"]["messageCode"] == "GROUP_NOT_FOUND"

    def test_get_group_no_access(
        self, second_authenticated_client: TestClient, sample_group
    ):
        """Test GET /groups/{id} returns 404 for someone else's group."""
        # Returns 404, not 403 - same as a non-existent group, so the
        # response can't be used to enumerate other users' group IDs.
        response = second_authenticated_client.get(f"/groups/{sample_group.id}")
        assert response.status_code == 404
        assert response.json()["detail"]["messageCode"] == "GROUP_NOT_FOUND"

    # =============================================================================
    # POST /groups
    # =============================================================================

    def test_create_group(self, authenticated_client: TestClient):
        """Test POST /groups creates a new group."""
        group_data = {"name": "Work", "color": "red"}
        response = authenticated_client.post("/groups", json=group_data)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Work"
        assert data["color"] == "red"
        assert "id" in data

    def test_create_group_default_color(self, authenticated_client: TestClient):
        """Test POST /groups uses default color if not specified."""
        group_data = {"name": "Default Color"}
        response = authenticated_client.post("/groups", json=group_data)
        assert response.status_code == 201
        data = response.json()
        assert data["color"] == "blue"  # Default in model/schema

    def test_create_group_validation_error(self, authenticated_client: TestClient):
        """Test POST /groups rejects invalid data."""
        # Missing name
        response = authenticated_client.post("/groups", json={})
        assert response.status_code == 422

        # Empty name
        response = authenticated_client.post("/groups", json={"name": ""})
        assert response.status_code == 422

    def test_create_group_invalid_color(self, authenticated_client: TestClient):
        """Test POST /groups rejects invalid color."""
        response = authenticated_client.post(
            "/groups", json={"name": "Test", "color": "invalid"}
        )
        assert response.status_code == 422

    def test_create_group_name_too_long(self, authenticated_client: TestClient):
        """Test POST /groups rejects name longer than 50 chars."""
        response = authenticated_client.post("/groups", json={"name": "a" * 51})
        assert response.status_code == 422

    def test_create_group_limit(
        self, authenticated_client: TestClient, test_db, test_user
    ):
        """Test POST /groups enforces the limit of 50 groups."""
        # Pre-fill 50 groups
        for i in range(50):
            g = Group(name=f"Group {i}", user_id=test_user.id)
            test_db.add(g)
        test_db.commit()

        # Try to create 51st group
        response = authenticated_client.post("/groups", json={"name": "Over Limit"})
        assert response.status_code == 400
        assert response.json()["detail"]["messageCode"] == "GROUP_LIMIT_REACHED"

    def test_create_group_requires_auth(self, client: TestClient):
        """Test POST /groups requires authentication."""
        response = client.post("/groups", json={"name": "No Auth"})
        assert response.status_code == 401

    # =============================================================================
    # PUT /groups/{id}
    # =============================================================================

    def test_update_group(self, authenticated_client: TestClient, sample_group):
        """Test PUT /groups/{id} updates existing group."""
        update_data = {"name": "Updated Name", "color": "green"}
        response = authenticated_client.put(
            f"/groups/{sample_group.id}", json=update_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["color"] == "green"

    def test_partial_update_group_name(
        self, authenticated_client: TestClient, sample_group
    ):
        """Test PUT /groups/{id} allows partial update of name."""
        update_data = {"name": "Name Only"}
        response = authenticated_client.put(
            f"/groups/{sample_group.id}", json=update_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Name Only"
        assert data["color"] == sample_group.color.value

    def test_partial_update_group_color(
        self, authenticated_client: TestClient, sample_group
    ):
        """Test PUT /groups/{id} allows partial update of color."""
        update_data = {"color": "pink"}
        response = authenticated_client.put(
            f"/groups/{sample_group.id}", json=update_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data["color"] == "pink"
        assert data["name"] == sample_group.name

    def test_update_nonexistent_group(self, authenticated_client: TestClient):
        """Test PUT /groups/{id} returns 404 for non-existent group."""
        response = authenticated_client.put("/groups/999", json={"name": "Ghost"})
        assert response.status_code == 404

    def test_update_group_no_permission(
        self, second_authenticated_client: TestClient, sample_group
    ):
        """Test PUT /groups/{id} returns 404 for someone else's group."""
        # Returns 404, not 403 - same as a non-existent group, so the
        # response can't be used to enumerate other users' group IDs.
        response = second_authenticated_client.put(
            f"/groups/{sample_group.id}", json={"name": "Steal"}
        )
        assert response.status_code == 404
        assert response.json()["detail"]["messageCode"] == "GROUP_NOT_FOUND"

    # =============================================================================
    # DELETE /groups/{id}
    # =============================================================================

    def test_delete_group(self, authenticated_client: TestClient, sample_group):
        """Test DELETE /groups/{id} deletes existing group."""
        response = authenticated_client.delete(f"/groups/{sample_group.id}")
        assert response.status_code == 200
        assert response.json()["message"] == "GROUP_DELETED_SUCCESS"

        # Verify it's gone
        get_response = authenticated_client.get(f"/groups/{sample_group.id}")
        assert get_response.status_code == 404

    def test_delete_nonexistent_group(self, authenticated_client: TestClient):
        """Test DELETE /groups/{id} returns 404 for non-existent group."""
        response = authenticated_client.delete("/groups/999")
        assert response.status_code == 404

    def test_delete_group_no_permission(
        self, second_authenticated_client: TestClient, sample_group
    ):
        """Test DELETE /groups/{id} returns 404 for someone else's group."""
        # Returns 404, not 403 - same as a non-existent group, so the
        # response can't be used to enumerate other users' group IDs.
        response = second_authenticated_client.delete(f"/groups/{sample_group.id}")
        assert response.status_code == 404
        assert response.json()["detail"]["messageCode"] == "GROUP_NOT_FOUND"

    def test_delete_group_unlinks_todos(
        self, authenticated_client: TestClient, test_db, test_user, sample_group
    ):
        """Test that deleting a group sets group_id to null in its todos."""
        # Create a todo in this group
        todo = Todo(
            title="Grouped Todo", user_id=test_user.id, group_id=sample_group.id
        )
        test_db.add(todo)
        test_db.commit()

        # Delete the group
        authenticated_client.delete(f"/groups/{sample_group.id}")

        # Verify todo still exists but group_id is None
        test_db.refresh(todo)
        assert todo.group_id is None
