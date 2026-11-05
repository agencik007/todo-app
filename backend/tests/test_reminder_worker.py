"""Tests for the reminder worker: claiming, channels and the stale cut-off."""

import os
import signal
import subprocess
import sys
import threading
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.exc import OperationalError, ProgrammingError

from models.push_subscription import PushSubscription
from models.todo import Todo
from models.user import User
from services import email_service, push_service, reminder_worker
from services.auth_service import hash_password
from services.reminder_worker import ReminderRunResult, claim_due, run_once
from tests.conftest import TestingSessionLocal, test_engine

NOW = datetime(2026, 11, 5, 12, 0, tzinfo=UTC)
ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc123"
NOTHING = ReminderRunResult(sent=0, skipped_stale=0, failed=0)


def open_transactions() -> int:
    """Other connections sitting idle inside a transaction right now."""
    with test_engine.connect() as connection:
        return connection.execute(
            text(
                "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()"
                " AND pid <> pg_backend_pid() AND state LIKE 'idle in transaction%'"
            )
        ).scalar_one()


@pytest.fixture
def at_send_time() -> list[int]:
    """Open transactions seen at each send; the fakes below record into it."""
    return []


@pytest.fixture
def pushed(monkeypatch, at_send_time) -> list[dict]:
    """VAPID keys configured and a fake push sender."""
    monkeypatch.setenv("VAPID_PUBLIC_KEY", "public-key")
    monkeypatch.setenv("VAPID_PRIVATE_KEY", "private-key")
    calls: list[dict] = []

    def fake_send(info, data):
        at_send_time.append(open_transactions())
        calls.append({"info": info, "data": data})

    monkeypatch.setattr(push_service, "webpush_send", fake_send)
    return calls


@pytest.fixture
def emails(monkeypatch, at_send_time) -> list[dict]:
    """Captures emails instead of sending them."""
    messages: list[dict] = []

    def fake_send(to_email, subject, html_content, text_content=None):
        at_send_time.append(open_transactions())
        messages.append({"to": to_email, "subject": subject, "text": text_content})
        return True

    monkeypatch.setattr(email_service, "send_email", fake_send)
    return messages


def make_user(db, *, email_reminders=False, subscribed=True, language="en") -> User:
    user = User(
        email="worker@example.com",
        hashed_password=hash_password("testpassword123"),
        is_active=True,
        is_verified=True,
        email_reminders=email_reminders,
        language=language,
    )
    db.add(user)
    db.commit()
    if subscribed:
        db.add(
            PushSubscription(
                user_id=user.id, endpoint=ENDPOINT, p256dh="p256dh", auth="auth"
            )
        )
        db.commit()
    return user


def make_todo(db, user, *, remind_at, title="Buy milk", **fields) -> Todo:
    todo = Todo(user_id=user.id, title=title, remind_at=remind_at, **fields)
    db.add(todo)
    db.commit()
    return todo


def sent_at(db, todo):
    db.expire_all()
    return db.get(Todo, todo.id).reminder_sent_at


def test_run_once_sends_due_reminder(test_db, pushed, emails):
    user = make_user(test_db)
    todo = make_todo(test_db, user, remind_at=NOW - timedelta(minutes=1))

    result = run_once(TestingSessionLocal, NOW)

    assert result == ReminderRunResult(sent=1, skipped_stale=0, failed=0)
    assert len(pushed) == 1
    assert emails == []
    assert sent_at(test_db, todo) == NOW


def test_run_once_ignores_future_and_completed(test_db, pushed, emails):
    user = make_user(test_db)
    future = make_todo(test_db, user, remind_at=NOW + timedelta(minutes=1))
    done = make_todo(
        test_db, user, remind_at=NOW - timedelta(minutes=1), completed=True
    )
    already = make_todo(
        test_db,
        user,
        remind_at=NOW - timedelta(minutes=5),
        reminder_sent_at=NOW - timedelta(minutes=4),
    )

    result = run_once(TestingSessionLocal, NOW)

    assert result == NOTHING
    assert pushed == []
    assert sent_at(test_db, future) is None
    assert sent_at(test_db, done) is None
    assert sent_at(test_db, already) == NOW - timedelta(minutes=4)


def test_run_once_skips_stale(test_db, pushed, emails):
    user = make_user(test_db, email_reminders=True)
    stale = make_todo(test_db, user, remind_at=NOW - timedelta(hours=1, minutes=1))
    edge = make_todo(test_db, user, remind_at=NOW - timedelta(hours=1), title="Edge")

    result = run_once(TestingSessionLocal, NOW)

    assert result == ReminderRunResult(sent=1, skipped_stale=1, failed=0)
    assert len(pushed) == 1 and len(emails) == 1
    # Handled either way, so the stale one is not retried on the next run.
    assert sent_at(test_db, stale) == NOW
    assert sent_at(test_db, edge) == NOW
    assert run_once(TestingSessionLocal, NOW) == NOTHING


def test_run_once_claims_each_reminder_once(test_db, pushed, emails):
    user = make_user(test_db)
    make_todo(test_db, user, remind_at=NOW - timedelta(minutes=1))

    # A first worker has claimed the row but not committed yet: the second
    # one skips the locked row instead of waiting for it and sending again.
    first = TestingSessionLocal()
    try:
        claimed = claim_due(first, NOW, 100)
        assert len(claimed) == 1
        assert run_once(TestingSessionLocal, NOW) == NOTHING
        assert pushed == []
        first.commit()
    finally:
        first.close()

    # The claim is committed, so a later run does not send it again either.
    assert run_once(TestingSessionLocal, NOW) == NOTHING
    assert pushed == []


def test_run_once_email_only_when_enabled(test_db, pushed, emails):
    user = make_user(test_db, email_reminders=True, subscribed=False, language="pl")
    make_todo(test_db, user, remind_at=NOW - timedelta(minutes=1), title="Kup mleko")

    result = run_once(TestingSessionLocal, NOW)

    assert result.sent == 1
    assert pushed == []
    assert len(emails) == 1
    assert emails[0]["to"] == "worker@example.com"
    assert "Kup mleko" in emails[0]["text"]
    assert "Przypomnienie" in emails[0]["subject"]


def test_run_once_push_and_email_both_fire(test_db, pushed, emails, at_send_time):
    user = make_user(test_db, email_reminders=True)
    make_todo(test_db, user, remind_at=NOW - timedelta(minutes=1))
    make_todo(test_db, user, remind_at=NOW - timedelta(minutes=2), title="Second")

    run_once(TestingSessionLocal, NOW)

    assert len(pushed) == 2 and len(emails) == 2
    # No transaction (and so no lock) is held while the network is waited on.
    assert at_send_time == [0, 0, 0, 0]
    assert open_transactions() == 0


def test_run_once_without_channels_marks_handled(test_db, pushed, emails):
    user = make_user(test_db, subscribed=False)
    todo = make_todo(test_db, user, remind_at=NOW - timedelta(minutes=1))

    result = run_once(TestingSessionLocal, NOW)

    assert result.failed == 0
    assert pushed == [] and emails == []
    assert sent_at(test_db, todo) == NOW


def test_run_once_send_failure_does_not_unclaim(test_db, monkeypatch, emails):
    user = make_user(test_db, email_reminders=True)
    todo = make_todo(test_db, user, remind_at=NOW - timedelta(minutes=1))

    def boom(*args, **kwargs):
        raise RuntimeError("push service down")

    monkeypatch.setattr(reminder_worker, "send_to_user", boom)
    monkeypatch.setenv("VAPID_PUBLIC_KEY", "public-key")
    monkeypatch.setenv("VAPID_PRIVATE_KEY", "private-key")

    result = run_once(TestingSessionLocal, NOW)

    assert result.failed == 1
    assert sent_at(test_db, todo) == NOW
    # The email channel still ran after the push one failed.
    assert len(emails) == 1
    assert run_once(TestingSessionLocal, NOW) == NOTHING


def test_run_once_batch_size_limits_a_run(test_db, pushed, emails):
    user = make_user(test_db)
    for minutes in (3, 2, 1):
        make_todo(test_db, user, remind_at=NOW - timedelta(minutes=minutes))

    first = run_once(TestingSessionLocal, NOW, batch_size=2)
    second = run_once(TestingSessionLocal, NOW, batch_size=2)

    assert (first.sent, second.sent) == (2, 1)


def test_main_idles_when_disabled(monkeypatch):
    """Exiting would restart-loop the container and fail `up --wait`."""
    monkeypatch.setenv("REMINDER_WORKER_ENABLED", "false")
    calls = []
    monkeypatch.setattr(
        reminder_worker, "loop", lambda stop, enabled: calls.append(enabled)
    )

    reminder_worker.main()

    assert calls == [False]


def test_loop_disabled_only_keeps_the_heartbeat(monkeypatch, tmp_path):
    monkeypatch.setattr(
        reminder_worker,
        "run_once",
        lambda *a, **k: pytest.fail("run_once must not run when disabled"),
    )
    monkeypatch.setattr(reminder_worker, "HEARTBEAT_PATH", tmp_path / "heartbeat")
    stop = reminder_worker.StopSignal()
    stop.wait = lambda seconds: stop.set()

    reminder_worker.loop(stop, enabled=False)

    assert (tmp_path / "heartbeat").exists()


def _run_loop(monkeypatch, tmp_path, error):
    """One loop pass whose run_once raises `error`; returns the heartbeat path."""
    heartbeat = tmp_path / "heartbeat"

    def failing_run(*args, **kwargs):
        raise error

    monkeypatch.setattr(reminder_worker, "run_once", failing_run)
    monkeypatch.setattr(reminder_worker, "HEARTBEAT_PATH", heartbeat)
    stop = reminder_worker.StopSignal()
    stop.wait = lambda seconds: stop.set()
    reminder_worker.loop(stop)
    return heartbeat


def _programming_error(pgcode):
    orig = Exception("boom")
    orig.pgcode = pgcode
    return ProgrammingError("SELECT", {}, orig)


@pytest.mark.parametrize("pgcode", ["42703", "42P01"])
def test_loop_waits_when_the_schema_is_missing_columns(monkeypatch, tmp_path, pgcode):
    """An older schema (rolled-back database) must not crash-loop the worker."""
    heartbeat = _run_loop(monkeypatch, tmp_path, _programming_error(pgcode))

    # Alive and waiting for a schema, so the healthcheck stays green.
    assert heartbeat.exists()


@pytest.mark.parametrize(
    "error",
    [
        _programming_error("42601"),  # a syntax error is a bug, not a schema gap
        OperationalError("SELECT", {}, Exception("connection refused")),
        RuntimeError("unexpected"),
    ],
)
def test_loop_goes_unhealthy_on_other_errors(monkeypatch, tmp_path, error):
    heartbeat = _run_loop(monkeypatch, tmp_path, error)

    assert not heartbeat.exists()


def test_run_once_touches_the_heartbeat_per_row(test_db, pushed, emails, monkeypatch):
    user = make_user(test_db)
    for minutes in (3, 2, 1):
        make_todo(test_db, user, remind_at=NOW - timedelta(minutes=minutes))
    touches = []
    monkeypatch.setattr(reminder_worker, "_touch_heartbeat", lambda: touches.append(1))

    run_once(TestingSessionLocal, NOW)

    assert len(touches) == 3


def test_worker_module_starts_as_a_script():
    """`python -m services.reminder_worker` imports `services` before `config`."""
    process = subprocess.Popen(
        [sys.executable, "-m", "services.reminder_worker"],
        env={**os.environ, "REMINDER_WORKER_ENABLED": "false"},
        cwd=Path(__file__).resolve().parent.parent,
        stderr=subprocess.PIPE,
        text=True,
    )
    first_line: list[str] = []
    reader = threading.Thread(
        target=lambda: first_line.append(process.stderr.readline()), daemon=True
    )
    reader.start()
    try:
        reader.join(timeout=30)  # the first log line, or a traceback
        process.send_signal(signal.SIGTERM)
        process.wait(timeout=30)
    finally:
        process.kill()
        process.stderr.close()

    started = "".join(first_line)
    assert "no reminders will be sent" in started, started
    assert process.returncode == 0
