"""
Group routes - CRUD operations for todo groups.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from config.api_messages import ApiMessages, api_error, api_success
from config.auth import get_current_verified_user
from config.database import get_db
from config.group_catalog import GROUP_CATALOG
from models.group import Group as GroupModel
from models.group import GroupColor
from models.schemas import Group, GroupCatalogItem, GroupCreate, GroupUpdate
from models.user import User
from services.embedder import Embedder, embed_one, get_embedder

router = APIRouter(prefix="/groups", tags=["groups"])

# Maximum number of groups per user
MAX_GROUPS_PER_USER = 50


def create_groups_for_user(
    db: Session,
    user: User,
    entries: list[tuple[str, GroupColor]],
    embedder: Embedder | None = None,
) -> list[GroupModel]:
    """
    Create groups for a user from (name, color) pairs.

    Skips names the user already has (case-insensitive) and stops at
    MAX_GROUPS_PER_USER. Does not commit; the caller owns the transaction.

    Args:
        db: Database session.
        user: Owner of the new groups.
        entries: (name, color) pairs to create, in order.
        embedder: Text embedder; groups get no embedding when it is None.

    Returns:
        list[GroupModel]: The groups that were actually created.
    """
    existing = {
        name.lower()
        for (name,) in db.query(GroupModel.name).filter(GroupModel.user_id == user.id)
    }
    created: list[GroupModel] = []

    for name, color in entries:
        if len(existing) >= MAX_GROUPS_PER_USER:
            break
        if name.lower() in existing:
            continue
        group = GroupModel(
            name=name,
            color=color,
            user_id=user.id,
            embedding=embed_one(embedder, name),
        )
        db.add(group)
        created.append(group)
        existing.add(name.lower())

    db.flush()
    return created


@router.get("", response_model=list[Group])
def get_groups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
) -> list[Group]:
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


@router.get("/catalog", response_model=list[GroupCatalogItem])
def get_group_catalog(
    current_user: User = Depends(get_current_verified_user),
) -> list[GroupCatalogItem]:
    """
    Get the starter group catalogue, with names in the user's language.

    Args:
        current_user: Current authenticated user.

    Returns:
        List[GroupCatalogItem]: Catalogue entries in display order.
    """
    return [
        GroupCatalogItem(
            key=entry.key,
            icon=entry.icon,
            color=entry.color,
            name=entry.name(current_user.language),
            preselected=entry.preselected,
        )
        for entry in GROUP_CATALOG
    ]


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
    embedder: Embedder | None = Depends(get_embedder),
) -> Group:
    """
    Create a new group.

    Args:
        group: Group data to create.
        db: Database session.
        current_user: Current authenticated user.
        embedder: Text embedder, or None when AI suggestions are unavailable.

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
    group_data["embedding"] = embed_one(embedder, group.name)

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
    embedder: Embedder | None = Depends(get_embedder),
) -> Group:
    """
    Update an existing group.

    Args:
        groupId: ID of the group to update.
        group_update: Updated group data.
        db: Database session.
        current_user: Current authenticated user.
        embedder: Text embedder, or None when AI suggestions are unavailable.

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

    if "name" in update_data:
        group.embedding = embed_one(embedder, group.name)

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
