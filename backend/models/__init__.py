"""
Models package - SQLAlchemy models and Pydantic schemas.
"""

from models.group import Group, GroupColor
from models.refresh_token import RefreshToken
from models.schemas import (
    Group as GroupSchema,
)
from models.schemas import (
    # Group schemas
    GroupBase,
    GroupCreate,
    GroupUpdate,
    LoginRequest,
    PasswordReset,
    PasswordResetRequest,
    # Todo schemas
    TodoBase,
    TodoCreate,
    TodoUpdate,
    # Auth schemas
    Token,
    TokenData,
    # User schemas
    UserBase,
    UserCreate,
    UserLanguageUpdate,
    UserResponse,
)
from models.schemas import (
    Todo as TodoSchema,
)
from models.todo import Todo
from models.user import User

__all__ = [
    # SQLAlchemy models
    "User",
    "Todo",
    "Group",
    "GroupColor",
    "RefreshToken",
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
]
