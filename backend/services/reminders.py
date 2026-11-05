"""
Reminder scheduling - hooks that keep todo reminders in step with user settings.
"""

from sqlalchemy.orm import Session

from models.user import User


def on_user_timezone_changed(db: Session, user: User) -> None:
    """
    Called after a user's timezone change has been committed.

    A no-op for now; reminder scheduling will recompute the user's pending
    reminders here.

    Args:
        db: Database session.
        user: The user whose timezone changed.
    """
