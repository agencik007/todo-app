"""
Group routes - CRUD operations for todo groups.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from config.auth import get_current_verified_user
from config.database import get_db
from config.api_messages import ApiMessages, api_error, api_success
from models.group import Group as GroupModel
from models.user import User
from models.schemas import Group, GroupCreate, GroupUpdate

router = APIRouter(prefix="/groups", tags=["groups"])

# Maximum number of groups per user
MAX_GROUPS_PER_USER = 50


@router.get("", response_model=List[Group])
def get_groups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
) -> List[Group]:
    """
    Get all groups for the current user.

    Args:
        db: Database session.
        current_user: Current authenticated user.

    Returns:
        List[Group]: List of groups owned by the user.
    """
    groups = (
        db.query(GroupModel)
        .filter(GroupModel.user_id == current_user.id)
        .order_by(GroupModel.created_at.desc())
        .all()
    )
    return groups


@router.get("/{groupId}", response_model=Group)
def read_group(
    groupId: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
) -> Group:
    """
    Get a specific group by ID.

    Args:
        groupId: ID of the group to retrieve.
        db: Database session.
        current_user: Current authenticated user.

    Returns:
        Group: The requested group.

    Raises:
        HTTPException: If group not found or user doesn't have access.
    """
    group = db.query(GroupModel).filter(GroupModel.id == groupId).first()

    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=api_error(ApiMessages.GROUP_NOT_FOUND),
        )

    # Both "doesn't exist" and "belongs to someone else" return 404, so the
    # response can't be used to enumerate other users' group IDs.
    if group.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=api_error(ApiMessages.GROUP_NOT_FOUND),
        )

    return group


@router.post("", response_model=Group, status_code=status.HTTP_201_CREATED)
def create_group(
    group: GroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
) -> Group:
    """
    Create a new group.

    Args:
        group: Group data to create.
        db: Database session.
        current_user: Current authenticated user.

    Returns:
        Group: The created group.

    Raises:
        HTTPException: If user has reached the maximum number of groups.
    """
    # Check if user has reached the limit
    group_count = (
        db.query(func.count(GroupModel.id))
        .filter(GroupModel.user_id == current_user.id)
        .scalar()
    )

    if group_count >= MAX_GROUPS_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=api_error(ApiMessages.GROUP_LIMIT_REACHED),
        )

    # Create new group
    group_data = group.model_dump()
    group_data["user_id"] = current_user.id

    db_group = GroupModel(**group_data)
    db.add(db_group)
    db.commit()
    db.refresh(db_group)

    return db_group


@router.put("/{groupId}", response_model=Group)
def update_group(
    groupId: int,
    group_update: GroupUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
) -> Group:
    """
    Update an existing group.

    Args:
        groupId: ID of the group to update.
        group_update: Updated group data.
        db: Database session.
        current_user: Current authenticated user.

    Returns:
        Group: The updated group.

    Raises:
        HTTPException: If group not found or user is not the owner.
    """
    group = db.query(GroupModel).filter(GroupModel.id == groupId).first()

    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=api_error(ApiMessages.GROUP_NOT_FOUND),
        )

    # Both "doesn't exist" and "belongs to someone else" return 404, so the
    # response can't be used to enumerate other users' group IDs.
    if group.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=api_error(ApiMessages.GROUP_NOT_FOUND),
        )

    # Update only provided fields
    update_data = group_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(group, field, value)

    db.commit()
    db.refresh(group)
    return group


@router.delete("/{groupId}")
def delete_group(
    groupId: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
) -> dict:
    """
    Delete a group.

    Note: Todos associated with this group will have their group_id set to NULL.

    Args:
        groupId: ID of the group to delete.
        db: Database session.
        current_user: Current authenticated user.

    Returns:
        dict: Success message.

    Raises:
        HTTPException: If group not found or user is not the owner.
    """
    group = db.query(GroupModel).filter(GroupModel.id == groupId).first()

    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=api_error(ApiMessages.GROUP_NOT_FOUND),
        )

    # Both "doesn't exist" and "belongs to someone else" return 404, so the
    # response can't be used to enumerate other users' group IDs.
    if group.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=api_error(ApiMessages.GROUP_NOT_FOUND),
        )

    db.delete(group)
    db.commit()
    return api_success(ApiMessages.GROUP_DELETED_SUCCESS)
