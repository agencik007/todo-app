"""
Pydantic schemas - Request/Response models for API validation.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, EmailStr, ConfigDict


# =============================================================================
# Todo Schemas
# =============================================================================


class TodoBase(BaseModel):
    """Base schema for todo items."""

    title: str = Field(..., min_length=1, description="Title must not be empty")
    description: Optional[str] = None
    completed: bool = False
    is_public: bool = False
    index: int = 0


class TodoCreate(TodoBase):
    """Schema for creating a new todo."""

    pass


class TodoUpdate(BaseModel):
    """Schema for updating an existing todo (all fields optional)."""

    title: Optional[str] = None
    description: Optional[str] = None
    completed: Optional[bool] = None
    is_public: Optional[bool] = None
    index: Optional[int] = None


class Todo(TodoBase):
    """Schema for todo API responses (includes id and timestamps)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    owner_email: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# =============================================================================
# User Schemas
# =============================================================================


class UserBase(BaseModel):
    """Base schema for users."""

    email: EmailStr


class UserCreate(UserBase):
    """Schema for user registration."""

    password: str = Field(
        ..., min_length=8, description="Password must be at least 8 characters"
    )


class UserResponse(UserBase):
    """Schema for user API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    is_verified: bool
    avatar_url: Optional[str] = None
    language: str
    message: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class UserLanguageUpdate(BaseModel):
    """Schema for updating user language."""

    language: str = Field(..., pattern="^(en|pl)$")


# =============================================================================
# Authentication Schemas
# =============================================================================


class Token(BaseModel):
    """Schema for JWT token response."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    message: Optional[str] = None


class TokenData(BaseModel):
    """Schema for decoded token data."""

    user_id: Optional[int] = None
    email: Optional[str] = None


class LoginRequest(BaseModel):
    """Schema for JSON login request."""

    email: EmailStr
    password: str


class RefreshTokenRequest(BaseModel):
    """Schema for token refresh request."""

    refresh_token: str


# =============================================================================
# Password Reset Schemas
# =============================================================================


class PasswordResetRequest(BaseModel):
    """Schema for password reset request (forgot password)."""

    email: EmailStr


class PasswordReset(BaseModel):
    """Schema for password reset with token."""

    token: str
    new_password: str = Field(
        ..., min_length=8, description="Password must be at least 8 characters"
    )
