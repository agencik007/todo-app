"""Tests for push subscriptions and web push sending."""

from datetime import date, time
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from pywebpush import WebPushException
from sqlalchemy.orm import Session

from models.push_subscription import PushSubscription
from models.todo import Todo
from services import push_service

ENDPOINT = "https://push.example.com/send/abc123"
OTHER_ENDPOINT = "https://push.example.com/send/other"
BODY = {"endpoint": ENDPOINT, "keys": {"p256dh": "key-p256dh", "auth": "key-auth"}}


@pytest.fixture
def sent(monkeypatch) -> list[dict]:
    """VAPID keys configured and a fake sender that records what it is given."""
    monkeypatch.setenv("VAPID_PUBLIC_KEY", "public-key")
    monkeypatch.setenv("VAPID_PRIVATE_KEY", "private-key")
    calls: list[dict] = []

    def fake_send(subscription_info: dict, data: str) -> None:
        calls.append({"subscription_info": subscription_info, "data": data})

    monkeypatch.setattr(push_service, "webpush_send", fake_send)
    return calls


@pytest.fixture
def no_keys(monkeypatch) -> None:
    monkeypatch.delenv("VAPID_PUBLIC_KEY", raising=False)
    monkeypatch.delenv("VAPID_PRIVATE_KEY", raising=False)


def add_subscription(db: Session, user, endpoint: str = ENDPOINT) -> PushSubscription:
    sub = PushSubscription(
        user_id=user.id, endpoint=endpoint, p256dh="p", auth="a", user_agent="UA"
    )
    db.add(sub)
    db.commit()
    return sub


def rows(db: Session) -> list[PushSubscription]:
    db.expire_all()
    return db.query(PushSubscription).all()


class TestConfig:
    def test_config_disabled_without_keys(
        self, authenticated_client: TestClient, no_keys
    ):
        response = authenticated_client.get("/push/config")
        assert response.status_code == 200
        assert response.json() == {"enabled": False, "publicKey": None}

    def test_config_enabled(self, authenticated_client: TestClient, sent):
        response = authenticated_client.get("/push/config")
        assert response.json() == {"enabled": True, "publicKey": "public-key"}

    def test_subscribe_unavailable_without_keys(
        self, authenticated_client: TestClient, no_keys
    ):
        response = authenticated_client.post("/push/subscriptions", json=BODY)
        assert response.status_code == 503
        assert response.json()["detail"]["messageCode"] == "PUSH_UNAVAILABLE"

    def test_test_push_unavailable_without_keys(
        self, authenticated_client: TestClient, no_keys
    ):
        response = authenticated_client.post("/push/test")
        assert response.status_code == 503
        assert response.json()["detail"]["messageCode"] == "PUSH_UNAVAILABLE"

    def test_subject_defaults_to_email_from(self, monkeypatch):
        monkeypatch.delenv("VAPID_SUBJECT", raising=False)
        monkeypatch.setenv("EMAIL_FROM", "me@example.com")
        assert push_service.vapid_subject() == "mailto:me@example.com"
        monkeypatch.setenv("VAPID_SUBJECT", "mailto:ops@example.com")
        assert push_service.vapid_subject() == "mailto:ops@example.com"


class TestSubscribe:
    def test_subscribe_creates(
        self, authenticated_client: TestClient, test_db: Session, test_user, sent
    ):
        response = authenticated_client.post(
            "/push/subscriptions", json={**BODY, "userAgent": "Firefox"}
        )
        assert response.status_code == 201
        assert response.json()["message"] == "PUSH_SUBSCRIBED"
        [sub] = rows(test_db)
        assert sub.user_id == test_user.id
        assert sub.endpoint == ENDPOINT
        assert (sub.p256dh, sub.auth, sub.user_agent) == (
            "key-p256dh",
            "key-auth",
            "Firefox",
        )

    def test_subscribe_same_endpoint_twice_is_one_row(
        self, authenticated_client: TestClient, test_db: Session, sent
    ):
        first = authenticated_client.post("/push/subscriptions", json=BODY)
        new_keys = {"p256dh": "new-p", "auth": "new-a"}
        second = authenticated_client.post(
            "/push/subscriptions", json={**BODY, "keys": new_keys}
        )
        assert (first.status_code, second.status_code) == (201, 200)
        [sub] = rows(test_db)
        assert (sub.p256dh, sub.auth) == ("new-p", "new-a")

    def test_subscribe_moves_endpoint_to_current_user(
        self,
        authenticated_client: TestClient,
        test_db: Session,
        test_user,
        second_user,
        sent,
    ):
        add_subscription(test_db, second_user)
        response = authenticated_client.post("/push/subscriptions", json=BODY)
        assert response.status_code == 200
        [sub] = rows(test_db)
        assert sub.user_id == test_user.id

    def test_subscribe_rejects_http_endpoint(
        self, authenticated_client: TestClient, test_db: Session, sent
    ):
        response = authenticated_client.post(
            "/push/subscriptions",
            json={**BODY, "endpoint": "http://push.example.com/x"},
        )
        assert response.status_code == 422
        assert rows(test_db) == []

    def test_subscribe_truncates_user_agent(
        self, authenticated_client: TestClient, test_db: Session, sent
    ):
        response = authenticated_client.post(
            "/push/subscriptions", json={**BODY, "userAgent": "x" * 1000}
        )
        assert response.status_code == 201
        assert len(rows(test_db)[0].user_agent) == 255


class TestUnsubscribe:
    def test_unsubscribe_removes_own(
        self, authenticated_client: TestClient, test_db: Session, test_user, sent
    ):
        add_subscription(test_db, test_user)
        response = authenticated_client.request(
            "DELETE", "/push/subscriptions", json={"endpoint": ENDPOINT}
        )
        assert response.status_code == 200
        assert response.json()["message"] == "PUSH_UNSUBSCRIBED"
        assert rows(test_db) == []

    def test_unsubscribe_only_own(
        self, authenticated_client: TestClient, test_db: Session, second_user, sent
    ):
        add_subscription(test_db, second_user)
        response = authenticated_client.request(
            "DELETE", "/push/subscriptions", json={"endpoint": ENDPOINT}
        )
        assert response.status_code == 200
        assert len(rows(test_db)) == 1

    def test_unsubscribe_unknown_is_ok(self, authenticated_client: TestClient, sent):
        response = authenticated_client.request(
            "DELETE", "/push/subscriptions", json={"endpoint": ENDPOINT}
        )
        assert response.status_code == 200
        assert response.json()["message"] == "PUSH_UNSUBSCRIBED"


class TestSending:
    def test_test_push_sends_to_all_subscriptions(
        self, authenticated_client: TestClient, test_db: Session, test_user, sent
    ):
        add_subscription(test_db, test_user)
        add_subscription(test_db, test_user, OTHER_ENDPOINT)
        response = authenticated_client.post("/push/test")
        assert response.status_code == 200
        assert response.json() == {"message": "PUSH_TEST_SENT", "sent": 2}
        assert {c["subscription_info"]["endpoint"] for c in sent} == {
            ENDPOINT,
            OTHER_ENDPOINT,
        }
        assert sent[0]["subscription_info"]["keys"] == {"p256dh": "p", "auth": "a"}
        assert all(r.last_used_at is not None for r in rows(test_db))

    def test_send_deletes_gone_subscription(
        self, test_db: Session, test_user, monkeypatch
    ):
        add_subscription(test_db, test_user)
        add_subscription(test_db, test_user, OTHER_ENDPOINT)

        def fake_send(subscription_info: dict, data: str) -> None:
            if subscription_info["endpoint"] == ENDPOINT:
                raise WebPushException(
                    "gone", response=SimpleNamespace(status_code=410)
                )

        monkeypatch.setattr(push_service, "webpush_send", fake_send)
        delivered = push_service.send_to_user(test_db, test_user, {"notification": {}})
        assert delivered == 1
        [left] = rows(test_db)
        assert left.endpoint == OTHER_ENDPOINT

    def test_send_keeps_subscription_on_other_failure(
        self, test_db: Session, test_user, monkeypatch
    ):
        add_subscription(test_db, test_user)

        def fake_send(subscription_info: dict, data: str) -> None:
            raise WebPushException("boom", response=SimpleNamespace(status_code=500))

        monkeypatch.setattr(push_service, "webpush_send", fake_send)
        assert push_service.send_to_user(test_db, test_user, {}) == 0
        assert len(rows(test_db)) == 1


class TestPayload:
    def make_todo(self, **fields) -> Todo:
        return Todo(id=7, title="Buy milk", user_id=1, **fields)

    def test_reminder_payload_shape_and_language(self, test_user):
        test_user.language = "pl"
        todo = self.make_todo(due_date=date(2026, 11, 6), due_time=time(14, 0))
        payload = push_service.reminder_payload(todo, test_user)
        notification = payload["notification"]
        assert notification["title"] == "Buy milk"
        assert notification["body"] == "Termin: 14:00"
        assert notification["tag"] == "todo-7"
        assert notification["icon"] == "/icons/icon-192.png"
        assert notification["badge"] == "/icons/icon-192.png"
        assert notification["data"]["onActionClick"]["default"] == {
            "operation": "navigateLastFocusedOrOpen",
            "url": "/todos",
        }

    def test_bodies_in_english(self, test_user):
        test_user.language = "en"

        def body(**fields) -> str:
            todo = self.make_todo(**fields)
            return push_service.reminder_payload(todo, test_user)["notification"][
                "body"
            ]

        assert (
            body(
                due_date=date(2026, 11, 6),
                due_time=time(9, 5),
                reminder_offset_minutes=15,
            )
            == "Due at 09:05"
        )
        assert (
            body(due_date=date(2026, 11, 6), reminder_offset_minutes=0) == "Due today"
        )
        assert (
            body(due_date=date(2026, 11, 6), reminder_offset_minutes=1440)
            == "Due tomorrow"
        )

    def test_title_is_cut_to_100_chars(self, test_user):
        todo = Todo(id=1, title="t" * 300, user_id=1, due_date=date(2026, 11, 6))
        payload = push_service.reminder_payload(todo, test_user)
        assert len(payload["notification"]["title"]) == 100


def test_account_deletion_removes_subscriptions(
    client: TestClient, test_db: Session, test_user
):
    add_subscription(test_db, test_user)
    login = client.post(
        "/auth/login",
        data={"username": test_user.email, "password": "testpassword123"},
    )
    token = login.json()["accessToken"]
    response = client.request(
        "DELETE",
        "/users/me",
        json={"password": "testpassword123"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert rows(test_db) == []
