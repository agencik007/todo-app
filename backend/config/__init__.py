"""
Config package - Application configuration, database, and authentication.
"""

from config.database import engine, Base, SessionLocal, get_db, get_db_context
from config.auth import (
    oauth2_scheme,
    get_current_user,
    get_current_active_user,
    get_current_verified_user,
)

__all__ = [
    # Database
    "engine",
    "Base",
    "SessionLocal",
    "get_db",
    "get_db_context",
    # Auth
    "oauth2_scheme",
    "get_current_user",
    "get_current_active_user",
    "get_current_verified_user",
]
