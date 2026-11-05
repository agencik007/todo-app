"""
Reminder worker - sends the task reminders that have come due.

Runs as its own process (`python -m services.reminder_worker`, the
`reminder-worker` compose service). Each pass claims the due rows first - sets
reminder_sent_at and commits - and only then sends, so a crash or a second
worker can never send a reminder twice. The price is at-most-once delivery: a
failed send is not retried.

Never log subscription endpoints or keys, addresses or task titles: counts only.
"""

import logging
import os
import signal
import threading
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session, sessionmaker

from models.todo import Todo
from services.email_service import send_reminder_email
from services.push_service import (
    push_enabled,
    reminder_body,
    reminder_payload,
    send_to_user,
)
from services.reminders import (
    REMINDER_GRACE,
    WORKER_BATCH_SIZE,
    WORKER_INTERVAL_SECONDS,
)

logger = logging.getLogger(__name__)

# Touched after every pass; the compose healthcheck wants it younger than 120 s.
HEARTBEAT_PATH = Path("/tmp/reminder-worker.heartbeat")


@dataclass(frozen=True)
class ReminderRunResult:
    """What one pass did, in rows. `sent` = handled with no channel failing."""

    sent: int
    skipped_stale: int
    failed: int


def claim_due(db: Session, now: datetime, batch_size: int) -> list[Todo]:
    """
    Lock the next due reminders and mark them handled (the caller commits).

    FOR UPDATE SKIP LOCKED makes a second worker pass over rows another one
    holds, so concurrent workers never claim the same row.
    """
    todos = (
        db.query(Todo)
        .filter(
            Todo.remind_at <= now,
            Todo.reminder_sent_at.is_(None),
            Todo.completed.is_(False),
        )
        .order_by(Todo.remind_at)
        .limit(batch_size)
        .with_for_update(skip_locked=True)
        .all()
    )
    for todo in todos:
        todo.reminder_sent_at = now
    db.flush()
    return todos


def _deliver(db: Session, todo: Todo) -> bool:
    """Send one reminder on every enabled channel; False if a channel failed."""
    user = todo.owner
    ok = True
    if push_enabled():
        try:
            send_to_user(db, user, reminder_payload(todo, user))
        except Exception as error:  # noqa: BLE001 - the email channel must still run
            logger.warning("Push channel failed (%s)", type(error).__name__)
            ok = False
    if user.email_reminders:
        try:
            ok &= send_reminder_email(
                user.email,
                todo.title,
                reminder_body(todo, user.language),
                user.language,
            )
        except Exception as error:  # noqa: BLE001 - one bad row must not stop the batch
            logger.warning("Email channel failed (%s)", type(error).__name__)
            ok = False
    return ok


def run_once(
    session_factory: sessionmaker,
    now: datetime,
    *,
    batch_size: int = WORKER_BATCH_SIZE,
) -> ReminderRunResult:
    """
    One pass: claim the due reminders, commit the claim, then send them.

    Args:
        session_factory: Opens the pass's own session.
        now: The instant to compare reminders against (aware).
        batch_size: Most rows handled in this pass.

    Returns:
        ReminderRunResult: Rows sent, skipped as stale (overdue by more than
        REMINDER_GRACE) and rows with a failed channel.
    """
    db = session_factory()
    # The rows are used after the claim's commit: keep them loaded.
    db.expire_on_commit = False
    sent = skipped_stale = failed = 0
    try:
        todos = claim_due(db, now, batch_size)
        for todo in todos:  # load owners while the claim is still open
            todo.owner  # noqa: B018
        db.commit()
        for todo in todos:
            if now - todo.remind_at > REMINDER_GRACE:
                skipped_stale += 1
            elif _deliver(db, todo):
                sent += 1
            else:
                failed += 1
    finally:
        db.close()
    return ReminderRunResult(sent=sent, skipped_stale=skipped_stale, failed=failed)


class StopSignal:
    """Set by SIGTERM / SIGINT; `wait` sleeps until then or the timeout."""

    def __init__(self) -> None:
        self._event = threading.Event()

    def set(self, *_args) -> None:
        self._event.set()

    def is_set(self) -> bool:
        return self._event.is_set()

    def wait(self, seconds: float) -> None:
        self._event.wait(seconds)


def _touch_heartbeat() -> None:
    try:
        HEARTBEAT_PATH.touch()
    except OSError:
        logger.warning("Cannot write the heartbeat file")


def loop(stop: StopSignal) -> None:
    """Run passes every WORKER_INTERVAL_SECONDS until `stop` is set."""
    from config import database

    while not stop.is_set():
        try:
            result = run_once(database.SessionLocal, datetime.now(UTC))
            logger.info(
                "Reminder run: sent=%d skipped_stale=%d failed=%d",
                result.sent,
                result.skipped_stale,
                result.failed,
            )
        except (ProgrammingError, OperationalError) as error:
            # No database yet, or a schema without the reminder columns (the
            # database was rolled back to an older release): wait, don't crash.
            logger.warning(
                "Reminder run skipped, database not ready (%s)", type(error).__name__
            )
        except Exception as error:  # noqa: BLE001 - keep the worker alive
            logger.error("Reminder run failed (%s)", type(error).__name__)
        _touch_heartbeat()
        stop.wait(WORKER_INTERVAL_SECONDS)


def worker_enabled() -> bool:
    """REMINDER_WORKER_ENABLED, default true."""
    value = os.getenv("REMINDER_WORKER_ENABLED", "true")
    return value.strip().lower() not in ("false", "0", "no", "off")


def main() -> None:
    """Entry point: loop until SIGTERM / SIGINT (finishing the current pass)."""
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
    )
    if not worker_enabled():
        logger.info("REMINDER_WORKER_ENABLED is false, exiting")
        return
    stop = StopSignal()
    signal.signal(signal.SIGTERM, stop.set)
    signal.signal(signal.SIGINT, stop.set)
    logger.info("Reminder worker started (every %ds)", WORKER_INTERVAL_SECONDS)
    loop(stop)
    logger.info("Reminder worker stopped")


if __name__ == "__main__":
    main()
