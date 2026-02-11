"""
Routes package - API endpoints.
"""

from routes.auth import router as auth_router
from routes.todo import router as todo_router
from routes.users import router as users_router
from routes.groups import router as groups_router

__all__ = [
    "auth_router",
    "todo_router",
    "users_router",
    "groups_router",
]
