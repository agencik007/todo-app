from fastapi import status
from models.todo import Todo


def test_create_todo_assigns_sequential_index(authenticated_client, test_db, test_user):
    """Test that new todos are assigned sequential indices."""
    # Create first todo
    response1 = authenticated_client.post(
        "/todos", json={"title": "First Todo", "description": "Index 0"}
    )
    assert response1.status_code == status.HTTP_201_CREATED
    data1 = response1.json()
    assert data1["index"] == 0

    # Create second todo
    response2 = authenticated_client.post(
        "/todos", json={"title": "Second Todo", "description": "Index 1"}
    )
    assert response2.status_code == status.HTTP_201_CREATED
    data2 = response2.json()
    assert data2["index"] == 1


def test_get_todos_ordered_by_index(authenticated_client, test_db, test_user):
    """Test that todos are returned ordered by their index."""
    # Create todos in non-sequential order manually if needed,
    # but the API now handles it. Let's create them and then reorder.
    authenticated_client.post("/todos", json={"title": "Todo 1"})  # index 0
    authenticated_client.post("/todos", json={"title": "Todo 2"})  # index 1

    # Get them
    response = authenticated_client.get("/todos")
    todos = response.json()
    assert todos[0]["title"] == "Todo 1"
    assert todos[1]["title"] == "Todo 2"


def test_reorder_todo_success(authenticated_client, test_db, test_user):
    """Test updating a todo's index (reordering)."""
    # Create two todos
    resp1 = authenticated_client.post("/todos", json={"title": "A"})  # index 0
    resp2 = authenticated_client.post("/todos", json={"title": "B"})  # index 1

    id1 = resp1.json()["id"]

    print(resp1.json())
    print(resp2.json())

    # Reorder A to be index 2
    reorder_resp = authenticated_client.patch(
        f"/todos/{id1}/reorder", json={"index": 2}
    )
    assert reorder_resp.status_code == status.HTTP_200_OK
    assert reorder_resp.json()["index"] == 2

    # Verify order in list
    list_resp = authenticated_client.get("/todos")
    todos = list_resp.json()
    assert todos[0]["title"] == "B"  # index 1
    assert todos[1]["title"] == "A"  # index 2


def test_reorder_todo_no_permission(authenticated_client, test_db, test_user):
    """Test that users cannot reorder other users' todos."""
    from models.user import User
    from services.auth_service import hash_password

    # Create another user's todo
    other_user = User(
        email="other@example.com",
        hashed_password=hash_password("password"),
        is_active=True,
        is_verified=True,
    )
    test_db.add(other_user)
    test_db.commit()

    other_todo = Todo(
        title="Other's Todo",
        user_id=other_user.id,
        index=0,
        is_public=True,  # Make it public so we can see it but not edit
    )
    test_db.add(other_todo)
    test_db.commit()

    # Try to reorder as test_user
    response = authenticated_client.patch(
        f"/todos/{other_todo.id}/reorder", json={"index": 5}
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN
