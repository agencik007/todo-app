"""Tests for the reminder worker: claiming, channels and the stale cut-off."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.exc import ProgrammingError

from models.push_subscription import PushSubscription
from models.todo import Todo
from models.user import User
from services import email_service, push_service, reminder_worker
from services.auth_service import hash_password
from services.reminder_worker import ReminderRunResult, claim_due, run_once
from tests.conftest import TestingSessionLocal

NOW = datetime(2026, 11, 5, 12, 0, tzinfo=UTC)
ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc123"
NOTHING = ReminderRunResult(sent=0, skipped_stale=0, failed=0)


@pytest.fixture
def pushed(monkeypatch) -> list[dict]:
    """VAPID keys configured and a fake push sender."""
    monkeypatch.setenv("VAPID_PUBLIC_KEY", "public-key")
    monkeypatch.setenv("VAPID_PRIVATE_KEY", "private-key")
    calls: list[dict] = []
    monkeypatch.setattr(
        push_service,
        "webpush_send",
        lambda info, data: calls.append({"info": info, "data": data}),
    )
    return calls


@pytest.fixture
def emails(monkeypatch) -> list[dict]:
    """Captures emails instead of sending them."""
    messages: list[dict] = []

    def fake_send(to_email, subject, html_content, text_content=None):
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


def test_run_once_push_and_email_both_fire(test_db, pushed, emails):
    user = make_user(test_db, email_reminders=True)
    make_todo(test_db, user, remind_at=NOW - timedelta(minutes=1))

    run_once(TestingSessionLocal, NOW)

    assert len(pushed) == 1 and len(emails) == 1


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


def test_main_exits_at_once_when_disabled(monkeypatch):
    monkeypatch.setenv("REMINDER_WORKER_ENABLED", "false")
    monkeypatch.setattr(
        reminder_worker,
        "run_once",
        lambda *a, **k: pytest.fail("run_once must not run when disabled"),
    )

    reminder_worker.main()


def test_loop_survives_missing_columns(monkeypatch, tmp_path):
    """An older schema (rolled-back database) must not crash-loop the worker."""
    calls = []

    def failing_run(*args, **kwargs):
        calls.append(1)
        raise ProgrammingError("SELECT", {}, Exception("column does not exist"))

    monkeypatch.setattr(reminder_worker, "run_once", failing_run)
    monkeypatch.setattr(reminder_worker, "HEARTBEAT_PATH", tmp_path / "heartbeat")
    waits = []
    stop = reminder_worker.StopSignal()
    stop.wait = lambda seconds: (waits.append(seconds), stop.set())

    reminder_worker.loop(stop)

    assert calls == [1]
    assert waits == [reminder_worker.WORKER_INTERVAL_SECONDS]
    # Still alive, so the healthcheck stays green while it waits for a schema.
    assert (tmp_path / "heartbeat").exists()
