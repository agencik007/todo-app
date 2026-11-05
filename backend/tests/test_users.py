"""
Tests for Users API endpoints.

- DELETE /users/me - delete the current user's account
"""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from models.group import Group
from models.refresh_token import RefreshToken
from models.todo import Todo
from models.user import User

# Cookie name must match the constant in routes/auth.py
REFRESH_COOKIE_NAME = "refresh_token"


def _login(client: TestClient, email: str) -> tuple[str, str]:
    """Log in through the API and return (access token, refresh cookie)."""
    response = client.post(
        "/auth/login", data={"username": email, "password": "testpassword123"}
    )
    assert response.status_code == 200
    return response.json()["accessToken"], response.cookies[REFRESH_COOKIE_NAME]


class TestDeleteAccount:
    """Test DELETE /users/me."""

    def test_delete_account_removes_user_and_data(
        self, client: TestClient, test_user, test_db: Session
    ):
        """Deleting the account removes the user, todos, groups and refresh tokens."""
        user_id = test_user.id
        access_token, refresh_token = _login(client, test_user.email)
        headers = {"Authorization": f"Bearer {access_token}"}

        group = client.post("/groups", json={"name": "Work"}, headers=headers).json()
        client.post(
            "/todos", json={"title": "Task", "groupId": group["id"]}, headers=headers
        )

        response = client.request(
            "DELETE",
            "/users/me",
            json={"password": "testpassword123"},
            headers=headers,
        )

        assert response.status_code == 200
        assert response.json()["message"] == "USER_ACCOUNT_DELETED"
        assert 'refresh_token=""' in response.headers["set-cookie"]

        test_db.expire_all()
        assert test_db.get(User, user_id) is None
        assert test_db.query(Todo).filter(Todo.user_id == user_id).count() == 0
        assert test_db.query(Group).filter(Group.user_id == user_id).count() == 0
        assert (
            test_db.query(RefreshToken).filter(RefreshToken.user_id == user_id).count()
            == 0
        )

        # The old refresh token can no longer be used.
        response = client.post(
            "/auth/refresh", cookies={REFRESH_COOKIE_NAME: refresh_token}
        )
        assert response.status_code == 401

    def test_delete_account_wrong_password(
        self, client: TestClient, test_user, test_db: Session
    ):
        """A wrong password is rejected and the account stays."""
        access_token, _ = _login(client, test_user.email)

        response = client.request(
            "DELETE",
            "/users/me",
            json={"password": "wrongpassword"},
            headers={"Authorization": f"Bearer {access_token}"},
        )

        assert response.status_code == 403
        assert response.json()["detail"]["messageCode"] == "USER_INVALID_PASSWORD"
        test_db.expire_all()
        assert test_db.get(User, test_user.id) is not None

    def test_delete_account_requires_password(self, client: TestClient, test_user):
        """The password field is required."""
        access_token, _ = _login(client, test_user.email)

        response = client.request(
            "DELETE",
            "/users/me",
            json={},
            headers={"Authorization": f"Bearer {access_token}"},
        )

        assert response.status_code == 422

    def test_delete_account_unauthorized(self, client: TestClient):
        """Deleting an account requires authentication."""
        response = client.request(
            "DELETE", "/users/me", json={"password": "testpassword123"}
        )

        assert response.status_code == 401


class TestUserTimezone:
    """Test PUT /users/me/timezone and PUT /users/me/email-reminders."""

    def test_timezone_defaults_to_null(self, authenticated_client: TestClient):
        """A new user has no timezone and email reminders are off."""
        response = authenticated_client.post(
            "/users/me/onboarding", json={"groupKeys": []}
        )

        assert response.status_code == 200
        assert response.json()["timezone"] is None
        assert response.json()["emailReminders"] is False

    def test_set_timezone(self, authenticated_client: TestClient, test_db: Session):
        """A valid IANA timezone is stored and returned."""
        response = authenticated_client.put(
            "/users/me/timezone", json={"timezone": "Europe/Warsaw"}
        )

        assert response.status_code == 200
        assert response.json()["timezone"] == "Europe/Warsaw"
        test_db.expire_all()
        assert test_db.query(User).one().timezone == "Europe/Warsaw"

    def test_set_invalid_timezone(self, authenticated_client: TestClient):
        """An unknown timezone is rejected with INVALID_TIMEZONE."""
        response = authenticated_client.put(
            "/users/me/timezone", json={"timezone": "Mars/Base"}
        )

        assert response.status_code == 422
        assert response.json()["detail"]["messageCode"] == "INVALID_TIMEZONE"

    def test_toggle_email_reminders(
        self, authenticated_client: TestClient, test_db: Session
    ):
        """Email reminders default to off; enabling them is returned and stored."""
        response = authenticated_client.put(
            "/users/me/email-reminders", json={"enabled": True}
        )

        assert response.status_code == 200
        assert response.json()["emailReminders"] is True
        test_db.expire_all()
        assert test_db.query(User).one().email_reminders is True
