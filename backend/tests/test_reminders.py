"""Tests for task reminders: remind_at computation and the todo API."""

from datetime import UTC, date, datetime, time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from models.todo import Todo
from services.reminders import compute_remind_at

WARSAW = "Europe/Warsaw"


def utc(*args: int) -> datetime:
    return datetime(*args, tzinfo=UTC)


class TestComputeRemindAt:
    def test_at_due_time(self):
        assert compute_remind_at(date(2026, 11, 7), time(14, 0), 0, WARSAW) == utc(
            2026, 11, 7, 13, 0
        )

    def test_minutes_before(self):
        assert compute_remind_at(date(2026, 11, 7), time(14, 0), 15, WARSAW) == utc(
            2026, 11, 7, 12, 45
        )

    def test_day_before(self):
        assert compute_remind_at(date(2026, 11, 7), time(14, 0), 1440, WARSAW) == utc(
            2026, 11, 6, 13, 0
        )

    def test_date_only_on_the_day(self):
        assert compute_remind_at(date(2026, 11, 7), None, 0, WARSAW) == utc(
            2026, 11, 7, 8, 0
        )

    def test_date_only_day_before(self):
        assert compute_remind_at(date(2026, 11, 7), None, 1440, WARSAW) == utc(
            2026, 11, 6, 8, 0
        )

    def test_no_timezone(self):
        assert compute_remind_at(date(2026, 11, 7), time(14, 0), 0, None) is None

    def test_no_offset_or_date(self):
        assert compute_remind_at(date(2026, 11, 7), None, None, WARSAW) is None
        assert compute_remind_at(None, None, 0, WARSAW) is None

    def test_compute_remind_at_dst_gap(self):
        """02:30 does not exist on 2027-03-28; the instant after the gap is used."""
        assert compute_remind_at(date(2027, 3, 28), time(2, 30), 0, WARSAW) == utc(
            2027, 3, 28, 1, 30
        )

    @pytest.mark.parametrize(
        ("due", "expected"),
        [
            # Spring forward on 2027-03-28: the day before is still CET (UTC+1).
            (date(2027, 3, 28), utc(2027, 3, 27, 13, 0)),
            (date(2027, 3, 29), utc(2027, 3, 28, 12, 0)),
            # Fall back on 2026-10-25: the day before is still CEST (UTC+2).
            (date(2026, 10, 25), utc(2026, 10, 24, 12, 0)),
            (date(2026, 10, 26), utc(2026, 10, 25, 13, 0)),
        ],
    )
    def test_day_before_with_time_is_the_same_local_time(self, due, expected):
        """A calendar day, not 24 h: the local time stays 14:00 across DST."""
        assert compute_remind_at(due, time(14, 0), 1440, WARSAW) == expected

    def test_compute_remind_at_dst_fold(self):
        """02:30 happens twice on 2026-10-25; the first (CEST) one is used."""
        assert compute_remind_at(date(2026, 10, 25), time(2, 30), 0, WARSAW) == utc(
            2026, 10, 25, 0, 30
        )


@pytest.fixture
def warsaw_client(
    authenticated_client: TestClient, test_db: Session, test_user
) -> TestClient:
    response = authenticated_client.put("/users/me/timezone", json={"timezone": WARSAW})
    assert response.status_code == 200
    # The client's overridden auth returns this object, not a fresh row.
    test_db.refresh(test_user)
    return authenticated_client


def create(client: TestClient, **fields) -> dict:
    response = client.post("/todos", json={"title": "T", **fields})
    assert response.status_code == 201, response.text
    return response.json()


def create_timed(client: TestClient, offset: int = 0) -> dict:
    return create(
        client, dueDate="2026-11-07", dueTime="14:00", reminderOffsetMinutes=offset
    )


class TestReminderApi:
    def test_create_with_reminder(self, warsaw_client: TestClient):
        data = create_timed(warsaw_client, 15)
        assert data["reminderOffsetMinutes"] == 15
        assert data["remindAt"].startswith("2026-11-07T12:45:00")
        assert "reminderSentAt" not in data

    def test_create_without_timezone(self, authenticated_client: TestClient):
        data = create_timed(authenticated_client, 15)
        assert data["reminderOffsetMinutes"] == 15
        assert data["remindAt"] is None

    def test_reminder_without_date(self, warsaw_client: TestClient):
        response = warsaw_client.post(
            "/todos", json={"title": "T", "reminderOffsetMinutes": 0}
        )
        assert response.status_code == 422
        assert response.json()["detail"]["messageCode"] == "REMINDER_WITHOUT_DATE"

    def test_invalid_offset(self, warsaw_client: TestClient):
        response = warsaw_client.post(
            "/todos",
            json={
                "title": "T",
                "dueDate": "2026-11-07",
                "dueTime": "14:00",
                "reminderOffsetMinutes": 30,
            },
        )
        assert response.status_code == 422
        assert response.json()["detail"]["messageCode"] == "REMINDER_INVALID_OFFSET"

    def test_date_only_offset_coerced_on_create(self, warsaw_client: TestClient):
        data = create(warsaw_client, dueDate="2026-11-07", reminderOffsetMinutes=60)
        assert data["reminderOffsetMinutes"] == 0
        assert data["remindAt"].startswith("2026-11-07T08:00:00")

    def test_clearing_time_coerces_offset(self, warsaw_client: TestClient):
        todo = create_timed(warsaw_client, 60)
        response = warsaw_client.put(f"/todos/{todo['id']}", json={"dueTime": None})
        assert response.status_code == 200
        data = response.json()
        assert data["reminderOffsetMinutes"] == 0
        assert data["remindAt"].startswith("2026-11-07T08:00:00")

    def test_clearing_date_clears_reminder(self, warsaw_client: TestClient):
        todo = create_timed(warsaw_client, 0)
        response = warsaw_client.put(f"/todos/{todo['id']}", json={"dueDate": None})
        assert response.status_code == 200
        data = response.json()
        assert data["dueTime"] is None
        assert data["reminderOffsetMinutes"] is None
        assert data["remindAt"] is None

    def test_unrelated_update_keeps_reminder(self, warsaw_client: TestClient):
        todo = create_timed(warsaw_client, 15)
        response = warsaw_client.put(f"/todos/{todo['id']}", json={"title": "x"})
        data = response.json()
        assert data["reminderOffsetMinutes"] == 15
        assert data["remindAt"] == todo["remindAt"]

    def test_invalid_update_leaves_todo_untouched(
        self, warsaw_client: TestClient, test_db: Session
    ):
        todo = create_timed(warsaw_client, 15)
        response = warsaw_client.put(
            f"/todos/{todo['id']}", json={"title": "new", "reminderOffsetMinutes": 30}
        )
        assert response.status_code == 422
        test_db.expire_all()
        row = test_db.get(Todo, todo["id"])
        assert row.title == "T"
        assert row.reminder_offset_minutes == 15

    def test_moving_due_time_resets_sent(
        self, warsaw_client: TestClient, test_db: Session
    ):
        todo = create_timed(warsaw_client, 0)
        row = test_db.get(Todo, todo["id"])
        row.reminder_sent_at = utc(2026, 11, 7, 13, 0)
        test_db.commit()

        response = warsaw_client.put(f"/todos/{todo['id']}", json={"dueTime": "16:00"})
        assert response.status_code == 200
        test_db.expire_all()
        assert test_db.get(Todo, todo["id"]).reminder_sent_at is None

    def test_unchanged_remind_at_keeps_sent(
        self, warsaw_client: TestClient, test_db: Session
    ):
        todo = create_timed(warsaw_client, 0)
        row = test_db.get(Todo, todo["id"])
        row.reminder_sent_at = utc(2026, 11, 7, 13, 0)
        test_db.commit()

        warsaw_client.put(f"/todos/{todo['id']}", json={"title": "x"})
        test_db.expire_all()
        assert test_db.get(Todo, todo["id"]).reminder_sent_at is not None

    def test_timezone_change_recomputes(
        self, warsaw_client: TestClient, test_db: Session
    ):
        todo = create_timed(warsaw_client, 0)
        response = warsaw_client.put(
            "/users/me/timezone", json={"timezone": "America/New_York"}
        )
        assert response.status_code == 200
        test_db.expire_all()
        assert test_db.get(Todo, todo["id"]).remind_at == utc(2026, 11, 7, 19, 0)

    def test_first_timezone_fills_remind_at(
        self, authenticated_client: TestClient, test_db: Session
    ):
        todo = create_timed(authenticated_client, 0)
        authenticated_client.put("/users/me/timezone", json={"timezone": WARSAW})
        test_db.expire_all()
        assert test_db.get(Todo, todo["id"]).remind_at == utc(2026, 11, 7, 13, 0)

    def test_timezone_change_recomputes_sent_without_resending(
        self, warsaw_client: TestClient, test_db: Session
    ):
        """remind_at follows the timezone, but reminder_sent_at stays."""
        todo = create_timed(warsaw_client, 0)
        row = test_db.get(Todo, todo["id"])
        row.reminder_sent_at = utc(2026, 11, 7, 13, 0)
        test_db.commit()
        warsaw_client.put("/users/me/timezone", json={"timezone": "America/New_York"})
        test_db.expire_all()
        row = test_db.get(Todo, todo["id"])
        assert row.remind_at == utc(2026, 11, 7, 19, 0)
        assert row.reminder_sent_at == utc(2026, 11, 7, 13, 0)

        # An unrelated save sees an unchanged remind_at and does not re-arm it.
        warsaw_client.put(f"/todos/{todo['id']}", json={"title": "x"})
        test_db.expire_all()
        assert test_db.get(Todo, todo["id"]).reminder_sent_at == utc(2026, 11, 7, 13, 0)

    def test_timezone_change_is_one_transaction(
        self, warsaw_client: TestClient, test_db: Session, test_user, monkeypatch
    ):
        """If the recompute fails, the timezone change is not persisted."""
        from routes import users

        def failing_hook(db, user):
            raise RuntimeError("recompute failed")

        monkeypatch.setattr(users, "on_user_timezone_changed", failing_hook)
        client = TestClient(warsaw_client.app, raise_server_exceptions=False)

        response = client.put("/users/me/timezone", json={"timezone": "Asia/Tokyo"})

        assert response.status_code == 500
        test_db.expire_all()
        assert test_db.get(type(test_user), test_user.id).timezone == WARSAW
