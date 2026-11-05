"""
Reminder scheduling - works out when a todo's reminder is due and keeps it in
step with the todo and the user's settings.
"""

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.orm import Session

from config.api_messages import ApiMessages
from models.todo import Todo as TodoModel
from models.user import User

# Minutes before the due time a reminder may fire, for a todo with a time...
ALLOWED_OFFSETS_TIMED = (0, 15, 60, 1440)
# ...and for a date-only todo: on the day (0) or the day before (1440).
ALLOWED_OFFSETS_DATE_ONLY = (0, 1440)
# Wall-clock time (in the user's timezone) a date-only reminder fires at.
DATE_ONLY_REMINDER_TIME = time(9, 0)
# A reminder overdue by more than this is skipped rather than sent late.
REMINDER_GRACE = timedelta(hours=1)
# Reminder worker: pause between scans and rows handled per scan.
WORKER_INTERVAL_SECONDS = 30
WORKER_BATCH_SIZE = 100

MINUTES_PER_DAY = 1440


class ReminderError(Exception):
    """A reminder that cannot be stored; carries the API message to answer with."""

    def __init__(self, message: ApiMessages) -> None:
        super().__init__(message.value)
        self.message = message


def compute_remind_at(
    due_date: date | None,
    due_time: time | None,
    offset: int | None,
    tz_name: str | None,
) -> datetime | None:
    """
    Work out the instant a reminder fires.

    The due date and time are wall-clock values in the user's timezone. A
    local time skipped by a DST change moves forward by the gap and an
    ambiguous one takes its first occurrence (fold=0, Python's default).

    Args:
        due_date: Due date of the todo.
        due_time: Due time, or None for a date-only todo.
        offset: Minutes before the due time (a date-only todo: 0 = on the day,
            1440 = the day before, both at DATE_ONLY_REMINDER_TIME).
        tz_name: IANA timezone of the user, if known.

    Returns:
        datetime | None: The reminder instant (UTC, aware), or None when there
        is no reminder, no date or no usable timezone.
    """
    if due_date is None or offset is None or not tz_name:
        return None
    try:
        tz = ZoneInfo(tz_name)
    except (ZoneInfoNotFoundError, ValueError, OSError):
        return None

    if due_time is None:
        day = due_date - timedelta(days=offset // MINUTES_PER_DAY)
        local = datetime.combine(day, DATE_ONLY_REMINDER_TIME, tzinfo=tz)
        return local.astimezone(UTC)

    due = datetime.combine(due_date, due_time, tzinfo=tz).astimezone(UTC)
    return due - timedelta(minutes=offset)


def resolve_reminder(
    due_date: date | None, due_time: time | None, offset: int | None
) -> int | None:
    """
    Validate a reminder offset against the final due pair and normalize it.

    An offset of 15 or 60 on a date-only todo (an older client cleared the
    time but left the reminder) is coerced to 0 instead of failing.

    Args:
        due_date: Final due date of the todo.
        due_time: Final due time of the todo.
        offset: Requested reminder offset, if any.

    Returns:
        int | None: The offset to store.

    Raises:
        ReminderError: If the reminder has no due date or the offset is not
            one of the allowed choices.
    """
    if offset is None:
        return None
    if due_date is None:
        raise ReminderError(ApiMessages.REMINDER_WITHOUT_DATE)
    if due_time is None:
        if offset in (15, 60):
            return 0
        allowed = ALLOWED_OFFSETS_DATE_ONLY
    else:
        allowed = ALLOWED_OFFSETS_TIMED
    if offset not in allowed:
        raise ReminderError(ApiMessages.REMINDER_INVALID_OFFSET)
    return offset


def apply_reminder(todo: TodoModel, tz_name: str | None) -> None:
    """
    Recompute a todo's remind_at; a changed value makes the reminder due again.

    Args:
        todo: The todo, with its due pair and reminder offset already set.
        tz_name: IANA timezone of the todo's owner, if known.
    """
    remind_at = compute_remind_at(
        todo.due_date, todo.due_time, todo.reminder_offset_minutes, tz_name
    )
    if remind_at != todo.remind_at:
        todo.remind_at = remind_at
        todo.reminder_sent_at = None


def on_user_timezone_changed(db: Session, user: User) -> None:
    """
    Called after a user's timezone change has been committed.

    Recomputes remind_at of every todo of the user that has a reminder still
    to be sent.

    Args:
        db: Database session.
        user: The user whose timezone changed.
    """
    todos = (
        db.query(TodoModel)
        .filter(
            TodoModel.user_id == user.id,
            TodoModel.reminder_offset_minutes.is_not(None),
            TodoModel.reminder_sent_at.is_(None),
        )
        .all()
    )
    for todo in todos:
        apply_reminder(todo, user.timezone)
    db.commit()
