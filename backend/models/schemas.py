"""
Pydantic schemas - Request/Response models for API validation.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, EmailStr, ConfigDict
from pydantic.alias_generators import to_camel

from models.group import GroupColor


class CamelBaseModel(BaseModel):
    """Base model with camelCase serialization."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


# =============================================================================
# Group Schemas
# =============================================================================


class GroupBase(CamelBaseModel):
    """Base schema for groups."""

    name: str = Field(..., min_length=1, max_length=50, description="Group name")
    color: GroupColor = GroupColor.BLUE


class GroupCreate(GroupBase):
    """Schema for creating a new group."""

    pass


class GroupUpdate(CamelBaseModel):
    """Schema for updating a group."""

    name: Optional[str] = Field(None, min_length=1, max_length=50)
    color: Optional[GroupColor] = None


class Group(GroupBase):
    """Schema for group API responses."""

    # model_config = ConfigDict(from_attributes=True)  # Inherited from CamelBaseModel

    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime


# =============================================================================
# Todo Schemas
# =============================================================================


class TodoBase(CamelBaseModel):
    """Base schema for todo items."""

    title: str = Field(..., min_length=1, description="Title must not be empty")
    description: Optional[str] = None
    completed: bool = False
    index: int = 0
    group_id: Optional[int] = None


class TodoCreate(TodoBase):
    """Schema for creating a new todo."""

    pass


class TodoUpdate(CamelBaseModel):
    """Schema for updating an existing todo (all fields optional)."""

    title: Optional[str] = None
    description: Optional[str] = None
    completed: Optional[bool] = None
    index: Optional[int] = None
    group_id: Optional[int] = None


class Todo(TodoBase):
    """Schema for todo API responses (includes id and timestamps)."""

    # model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    owner_email: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    group: Optional[Group] = None


# =============================================================================
# User Schemas
# =============================================================================


class UserBase(CamelBaseModel):
    """Base schema for users."""

    email: EmailStr


class UserCreate(UserBase):
    """Schema for user registration."""

    password: str = Field(
        ..., min_length=8, description="Password must be at least 8 characters"
    )


class UserResponse(UserBase):
    """Schema for user API responses."""

    # model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    is_verified: bool
    avatar_url: Optional[str] = None
    language: str
    message: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class UserLanguageUpdate(CamelBaseModel):
    """Schema for updating user language."""

    language: str = Field(..., pattern="^(en|pl)$")


# =============================================================================
# Authentication Schemas
# =============================================================================


class Token(CamelBaseModel):
    """Schema for JWT token response."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    message: Optional[str] = None


class TokenData(CamelBaseModel):
    """Schema for decoded token data."""

    user_id: Optional[int] = None
    email: Optional[str] = None


class LoginRequest(CamelBaseModel):
    """Schema for JSON login request."""

    email: EmailStr
    password: str


class RefreshTokenRequest(CamelBaseModel):
    """Schema for token refresh request."""

    refresh_token: str


# =============================================================================
# Password Reset Schemas
# =============================================================================


class PasswordResetRequest(CamelBaseModel):
    """Schema for password reset request (forgot password)."""

    email: EmailStr


class PasswordReset(CamelBaseModel):
    """Schema for password reset with token."""

    token: str
    new_password: str = Field(
        ..., min_length=8, description="Password must be at least 8 characters"
    )
