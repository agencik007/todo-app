"""
Pydantic schemas - Request/Response models for API validation.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
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


class GroupUpdate(CamelBaseModel):
    """Schema for updating a group."""

    name: str | None = Field(None, min_length=1, max_length=50)
    color: GroupColor | None = None


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
    description: str | None = None
    completed: bool = False
    index: int = 0
    group_id: int | None = None


class TodoCreate(TodoBase):
    """Schema for creating a new todo."""

    client_id: UUID | None = Field(
        default=None,
        description=(
            "Client-generated id. Repeating a create with the same client_id "
            "returns the existing todo instead of creating a duplicate "
            "(offline changes are retried until they get through)."
        ),
    )


class TodoUpdate(CamelBaseModel):
    """Schema for updating an existing todo (all fields optional)."""

    title: str | None = None
    description: str | None = None
    completed: bool | None = None
    index: int | None = None
    group_id: int | None = None


class Todo(TodoBase):
    """Schema for todo API responses (includes id and timestamps)."""

    # model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    client_id: UUID | None = None
    owner_email: str | None = None
    created_at: datetime
    updated_at: datetime
    group: Group | None = None


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
    language: str = Field(
        "en",
        pattern="^(en|pl)$",
        description="Interface language at sign-up; used for the account's emails",
    )

    @field_validator("password")
    @classmethod
    def check_password_strength(cls, v: str) -> str:
        from config.password_validator import validate_password_strength

        return validate_password_strength(v)


class UserResponse(UserBase):
    """Schema for user API responses."""

    # model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    is_verified: bool
    avatar_url: str | None = None
    language: str
    message: str | None = None
    created_at: datetime
    updated_at: datetime


class UserLanguageUpdate(CamelBaseModel):
    """Schema for updating user language."""

    language: str = Field(..., pattern="^(en|pl)$")


class UserDeleteConfirm(CamelBaseModel):
    """Schema for confirming account deletion with the current password."""

    password: str = Field(..., min_length=1)


# =============================================================================
# Authentication Schemas
# =============================================================================


class Token(CamelBaseModel):
    """Schema for JWT token response."""

    access_token: str
    token_type: str = "bearer"
    message: str | None = None


class TokenData(CamelBaseModel):
    """Schema for decoded token data."""

    user_id: int | None = None
    email: str | None = None


class LoginRequest(CamelBaseModel):
    """Schema for JSON login request."""

    email: EmailStr
    password: str


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

    @field_validator("new_password")
    @classmethod
    def check_password_strength(cls, v: str) -> str:
        from config.password_validator import validate_password_strength

        return validate_password_strength(v)
