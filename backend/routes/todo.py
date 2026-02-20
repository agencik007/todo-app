"""
Todo routes - CRUD operations for todo items.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from config.auth import get_current_verified_user
from config.database import get_db
from config.api_messages import ApiMessages, api_error, api_success
from models.todo import Todo as TodoModel
from models.user import User
from models.group import Group as GroupModel
from models.schemas import Todo, TodoCreate, TodoUpdate

router = APIRouter(prefix="/todos", tags=["todos"])


def validate_group_ownership(db: Session, groupId: int | None, userId: int) -> None:
    """
    Validate that the group belongs to the user.

    Args:
        db: Database session.
        groupId: ID of the group to validate.
        userId: ID of the user who should own the group.

    Raises:
        HTTPException: If group not found or doesn't belong to user.
    """
    if groupId is None:
        return

    group = db.query(GroupModel).filter(GroupModel.id == groupId).first()
    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=api_error(ApiMessages.GROUP_NOT_FOUND),
        )
    if group.user_id != userId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=api_error(ApiMessages.GROUP_NO_ACCESS),
        )


@router.get("", response_model=List[Todo])
def get_todos(
    skip: int = 0,
    limit: int = 100,
    groupId: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
) -> List[Todo]:
    """
    Get all todos for current user (own todos + public todos).

    Args:
        skip: Number of records to skip (pagination).
        limit: Maximum number of records to return.
        db: Database session.
        current_user: Current authenticated user.

    Returns:
        List[Todo]: List of todo items.
    """
    query = (
        db.query(TodoModel, User.email)
        .join(User, TodoModel.user_id == User.id)
        .filter(or_(TodoModel.user_id == current_user.id, TodoModel.is_public))
    )

    # Filter by group_id if provided
    if groupId is not None:
        query = query.filter(TodoModel.group_id == groupId)

    results = query.order_by(TodoModel.index.asc()).offset(skip).limit(limit).all()

    todos = []
    for todo, email in results:
        todo.owner_email = email
        todos.append(todo)
    return todos


@router.get("/{todoId}", response_model=Todo)
def read_todo(
    todoId: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
) -> Todo:
    """
    Get a specific todo by ID.

    Args:
        todoId: ID of the todo to retrieve.
        db: Database session.
        current_user: Current authenticated user.

    Returns:
        Todo: The requested todo item.

    Raises:
        HTTPException: If todo not found or user doesn't have access.
    """
    result = (
        db.query(TodoModel, User.email)
        .join(User, TodoModel.user_id == User.id)
        .filter(TodoModel.id == todoId)
        .first()
    )

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=api_error(ApiMessages.TODO_NOT_FOUND),
        )

    todo, email = result
    todo.owner_email = email

    # Check if user has access (owner or public)
    if todo.user_id != current_user.id and not todo.is_public:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=api_error(ApiMessages.TODO_NO_ACCESS),
        )

    return todo


@router.post("", response_model=Todo, status_code=status.HTTP_201_CREATED)
def create_todo(
    todo: TodoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
) -> Todo:
    """
    Create a new todo.

    Args:
        todo: Todo data to create.
        db: Database session.
        current_user: Current authenticated user.

    Returns:
        Todo: The created todo item.
    """
    todo_data = todo.model_dump()
    todo_data["user_id"] = current_user.id

    # Validate group ownership if group_id provided
    validate_group_ownership(db, todo_data.get("groupId"), current_user.id)

    max_index = (
        db.query(func.max(TodoModel.index))
        .filter(TodoModel.user_id == current_user.id)
        .scalar()
    )
    max_index = max_index if max_index is not None else -1
    todo_data["index"] = max_index + 1

    db_todo = TodoModel(**todo_data)
    db.add(db_todo)
    db.commit()
    db.refresh(db_todo)

    db_todo.owner_email = current_user.email
    return db_todo


@router.put("/{todoId}", response_model=Todo)
def update_todo(
    todoId: int,
    todo_update: TodoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
) -> Todo:
    """
    Update an existing todo.

    Args:
        todoId: ID of the todo to update.
        todo_update: Updated todo data.
        db: Database session.
        current_user: Current authenticated user.

    Returns:
        Todo: The updated todo item.

    Raises:
        HTTPException: If todo not found or user is not the owner.
    """
    todo = db.query(TodoModel).filter(TodoModel.id == todoId).first()

    if todo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=api_error(ApiMessages.TODO_NOT_FOUND),
        )

    # Check if user is the owner
    if todo.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=api_error(ApiMessages.TODO_NO_UPDATE_PERMISSION),
        )

    # Update only provided fields
    update_data = todo_update.model_dump(exclude_unset=True)

    # Validate group ownership if group_id is being updated
    if "groupId" in update_data:
        validate_group_ownership(db, update_data.get("groupId"), current_user.id)

    for field, value in update_data.items():
        setattr(todo, field, value)

    db.commit()
    db.refresh(todo)
    todo.owner_email = current_user.email
    return todo


@router.delete("/{todoId}")
def delete_todo(
    todoId: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
) -> dict:
    """
    Delete a todo.

    Args:
        todoId: ID of the todo to delete.
        db: Database session.
        current_user: Current authenticated user.

    Returns:
        dict: Success message.

    Raises:
        HTTPException: If todo not found or user is not the owner.
    """
    todo = db.query(TodoModel).filter(TodoModel.id == todoId).first()

    if todo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=api_error(ApiMessages.TODO_NOT_FOUND),
        )

    # Check if user is the owner
    if todo.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=api_error(ApiMessages.TODO_NO_DELETE_PERMISSION),
        )

    db.delete(todo)
    db.commit()
    return api_success(ApiMessages.TODO_DELETED_SUCCESS)


@router.patch("/{todoId}/reorder", response_model=Todo)
def reorder_todo(
    todoId: int,
    reorder_data: TodoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
) -> Todo:
    """
    Update the index of a todo for drag-and-drop reordering.

    Args:
        todoId: ID of the todo to reorder.
        reorder_data: Contains the new index.
        db: Database session.
        current_user: Current authenticated user.

    Returns:
        Todo: The reordered todo item.

    Raises:
        HTTPException: If todo not found, user is not owner, or invalid index.
    """
    if reorder_data.index is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=api_error(ApiMessages.TODO_INVALID_INDEX),
        )

    todo = db.query(TodoModel).filter(TodoModel.id == todoId).first()

    if todo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=api_error(ApiMessages.TODO_NOT_FOUND),
        )

    # Check if user is the owner
    if todo.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=api_error(ApiMessages.TODO_NO_UPDATE_PERMISSION),
        )

    old_index = todo.index
    new_index = reorder_data.index

    if old_index != new_index:
        if old_index < new_index:
            # Moving down: shift items between old and new index up (decrement index)
            db.query(TodoModel).filter(
                TodoModel.user_id == current_user.id,
                TodoModel.index > old_index,
                TodoModel.index <= new_index,
            ).update({TodoModel.index: TodoModel.index - 1}, synchronize_session=False)
        else:
            # Moving up: shift items between new and old index down (increment index)
            db.query(TodoModel).filter(
                TodoModel.user_id == current_user.id,
                TodoModel.index >= new_index,
                TodoModel.index < old_index,
            ).update({TodoModel.index: TodoModel.index + 1}, synchronize_session=False)

        todo.index = new_index
        db.commit()

    db.refresh(todo)

    # We might want to re-fetch email if needed, but for simplicity:
    todo.owner_email = current_user.email
    return todo
