"""
Todo routes - CRUD operations for todo items.
"""

import os
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from config.api_messages import ApiMessages, api_error, api_success
from config.auth import get_current_verified_user
from config.database import get_db
from models.group import Group as GroupModel
from models.schemas import (
    GroupSuggestion,
    GroupSuggestionRequest,
    Todo,
    TodoCreate,
    TodoUpdate,
)
from models.todo import Todo as TodoModel
from models.user import User
from services.auth_service import verify_token
from services.embedder import Embedder, embed_one, get_embedder, todo_embedding_text
from services.suggestion_service import SuggestionsUnavailableError, suggest_group

router = APIRouter(prefix="/todos", tags=["todos"])


def suggestion_rate_limit_key(request: Request) -> str:
    """Rate-limit per user (id from the Bearer access token), else per IP."""
    scheme, _, token = request.headers.get("authorization", "").partition(" ")
    if scheme.lower() == "bearer" and token:
        payload = verify_token(token, token_type="access")
        if payload and payload.get("sub"):
            return f"user:{payload['sub']}"
    return get_remote_address(request)


limiter = Limiter(
    key_func=suggestion_rate_limit_key, enabled=os.getenv("TESTING") != "1"
)


def validate_group_ownership(db: Session, group_id: int | None, user_id: int) -> None:
    """
    Validate that the group belongs to the user.

    Args:
        db: Database session.
        group_id: ID of the group to validate.
        user_id: ID of the user who should own the group.

    Raises:
        HTTPException: If group not found or doesn't belong to user.
    """
    if group_id is None:
        return

    group = db.query(GroupModel).filter(GroupModel.id == group_id).first()
    # Both "doesn't exist" and "belongs to someone else" return 404, so the
    # response can't be used to enumerate other users' group IDs.
    if group is None or group.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=api_error(ApiMessages.GROUP_NOT_FOUND),
        )


def find_todo_by_client_id(
    db: Session, user_id: int, client_id: UUID
) -> TodoModel | None:
    """Return the user's todo created with the given client_id, if any."""
    return (
        db.query(TodoModel)
        .filter(TodoModel.user_id == user_id, TodoModel.client_id == str(client_id))
        .first()
    )


@router.get("", response_model=list[Todo])
def get_todos(
    skip: int = 0,
    limit: int = 100,
    groupId: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
) -> list[Todo]:
    """
    Get all todos for current user.

    Args:
        skip: Number of records to skip (pagination).
        limit: Maximum number of records to return.
        db: Database session.
        current_user: Current authenticated user.

    Returns:
        List[Todo]: List of todo items.
    """
    # Filtered by the current user's own id, so the owner is always
    # current_user - no need to join User just to look up its own email.
    query = (
        db.query(TodoModel)
        .options(selectinload(TodoModel.group))
        .filter(TodoModel.user_id == current_user.id)
    )

    # Filter by group_id if provided
    if groupId is not None:
        query = query.filter(TodoModel.group_id == groupId)

    todos = query.order_by(TodoModel.index.asc()).offset(skip).limit(limit).all()

    for todo in todos:
        todo.owner_email = current_user.email

    return todos


@router.post("/suggest-group", response_model=GroupSuggestion)
@limiter.limit("60/minute")
def suggest_group_for_todo(
    request: Request,
    suggestion_request: GroupSuggestionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
    embedder: Embedder | None = Depends(get_embedder),
) -> GroupSuggestion:
    """
    Suggest a group for a todo being written, using the local embedding model.

    A sync route on purpose: inference runs in the threadpool, off the event
    loop.

    Args:
        request: FastAPI request object (for rate limiting).
        suggestion_request: Title and description typed so far.
        db: Database session.
        current_user: Current authenticated user.
        embedder: Text embedder, or None when AI suggestions are unavailable.

    Returns:
        GroupSuggestion: One of the user's groups, a catalogue group to
        create, or no suggestion.

    Raises:
        HTTPException: 503 if suggestions are disabled or the model fails.
    """
    unavailable = HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=api_error(ApiMessages.SUGGESTIONS_UNAVAILABLE),
    )
    if embedder is None:
        raise unavailable
    try:
        return suggest_group(
            db,
            current_user,
            embedder,
            suggestion_request.title,
            suggestion_request.description,
        )
    except SuggestionsUnavailableError:
        raise unavailable from None


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
    todo = (
        db.query(TodoModel)
        .options(selectinload(TodoModel.group))
        .filter(TodoModel.id == todoId)
        .first()
    )

    if todo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=api_error(ApiMessages.TODO_NOT_FOUND),
        )

    # Both "doesn't exist" and "belongs to someone else" return 404, so the
    # response can't be used to enumerate other users' todo IDs.
    if todo.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=api_error(ApiMessages.TODO_NOT_FOUND),
        )

    todo.owner_email = current_user.email
    return todo


@router.post("", response_model=Todo, status_code=status.HTTP_201_CREATED)
def create_todo(
    todo: TodoCreate,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
    embedder: Embedder | None = Depends(get_embedder),
) -> Todo:
    """
    Create a new todo.

    Idempotent per client_id: the client retries a create it made offline
    until it gets an answer, so a repeated client_id returns the todo created
    the first time (200) instead of a duplicate (201).

    Args:
        todo: Todo data to create.
        response: Used to answer a repeated create with 200.
        db: Database session.
        current_user: Current authenticated user.
        embedder: Text embedder, or None when AI suggestions are unavailable.

    Returns:
        Todo: The created (or previously created) todo item.
    """
    if todo.client_id is not None:
        existing = find_todo_by_client_id(db, current_user.id, todo.client_id)
        if existing is not None:
            response.status_code = status.HTTP_200_OK
            existing.owner_email = current_user.email
            return existing

    todo_data = todo.model_dump()
    todo_data["user_id"] = current_user.id
    if todo.client_id is not None:
        todo_data["client_id"] = str(todo.client_id)

    # Validate group ownership if group_id provided
    validate_group_ownership(db, todo_data.get("group_id"), current_user.id)

    max_index = (
        db.query(func.max(TodoModel.index))
        .filter(TodoModel.user_id == current_user.id)
        .scalar()
    )
    max_index = max_index if max_index is not None else -1
    todo_data["index"] = max_index + 1
    todo_data["embedding"] = embed_one(
        embedder, todo_embedding_text(todo.title, todo.description)
    )

    db_todo = TodoModel(**todo_data)
    db.add(db_todo)
    try:
        db.commit()
    except IntegrityError:
        # The same client_id arrived twice at once and the other request won.
        db.rollback()
        if todo.client_id is None:
            raise
        existing = find_todo_by_client_id(db, current_user.id, todo.client_id)
        if existing is None:
            raise
        response.status_code = status.HTTP_200_OK
        existing.owner_email = current_user.email
        return existing
    db.refresh(db_todo)

    db_todo.owner_email = current_user.email
    return db_todo


@router.put("/{todoId}", response_model=Todo)
def update_todo(
    todoId: int,
    todo_update: TodoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
    embedder: Embedder | None = Depends(get_embedder),
) -> Todo:
    """
    Update an existing todo.

    Args:
        todoId: ID of the todo to update.
        todo_update: Updated todo data.
        db: Database session.
        current_user: Current authenticated user.
        embedder: Text embedder, or None when AI suggestions are unavailable.

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

    # Both "doesn't exist" and "belongs to someone else" return 404, so the
    # response can't be used to enumerate other users' todo IDs.
    if todo.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=api_error(ApiMessages.TODO_NOT_FOUND),
        )

    # Update only provided fields
    update_data = todo_update.model_dump(exclude_unset=True)

    # Validate group ownership if group_id is being updated
    if "group_id" in update_data:
        validate_group_ownership(db, update_data.get("group_id"), current_user.id)

    for field, value in update_data.items():
        setattr(todo, field, value)

    if "title" in update_data or "description" in update_data:
        todo.embedding = embed_one(
            embedder, todo_embedding_text(todo.title, todo.description)
        )

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

    # Both "doesn't exist" and "belongs to someone else" return 404, so the
    # response can't be used to enumerate other users' todo IDs.
    if todo.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=api_error(ApiMessages.TODO_NOT_FOUND),
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

    # Both "doesn't exist" and "belongs to someone else" return 404, so the
    # response can't be used to enumerate other users' todo IDs.
    if todo.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=api_error(ApiMessages.TODO_NOT_FOUND),
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
