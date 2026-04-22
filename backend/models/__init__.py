"""
Models package - SQLAlchemy models and Pydantic schemas.
"""

from models.user import User
from models.todo import Todo
from models.group import Group, GroupColor
from models.schemas import (
    # Group schemas
    GroupBase,
    GroupCreate,
    GroupUpdate,
    Group as GroupSchema,
    # Todo schemas
    TodoBase,
    TodoCreate,
    TodoUpdate,
    Todo as TodoSchema,
    # User schemas
    UserBase,
    UserCreate,
    UserResponse,
    UserLanguageUpdate,
    # Auth schemas
    Token,
    TokenData,
    LoginRequest,
    PasswordResetRequest,
    PasswordReset,
    RefreshTokenRequest,
)

__all__ = [
    # SQLAlchemy models
    "User",
    "Todo",
    "Group",
    "GroupColor",
    # Group schemas
    "GroupBase",
    "GroupCreate",
    "GroupUpdate",
    "GroupSchema",
    # Todo schemas
    "TodoBase",
    "TodoCreate",
    "TodoUpdate",
    "TodoSchema",
    # User schemas
    "UserBase",
    "UserCreate",
    "UserResponse",
    "UserLanguageUpdate",
    # Auth schemas
    "Token",
    "TokenData",
    "LoginRequest",
    "PasswordResetRequest",
    "PasswordReset",
    "RefreshTokenRequest",
]
