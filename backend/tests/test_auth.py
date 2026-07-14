"""
Tests for Authentication API endpoints.

These tests verify that our authentication system works correctly:
- POST /auth/register - register new user
- POST /auth/login - login user
- POST /auth/refresh - refresh access token
- POST /auth/forgot-password - request password reset
- POST /auth/reset-password - reset password
- GET /auth/me - get current user info
"""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from models.user import User
from services.auth_service import (
    hash_password,
    hash_one_time_token,
)
from datetime import datetime, timedelta, timezone

# Cookie name must match the constant in routes/auth.py
REFRESH_COOKIE_NAME = "refresh_token"


class TestAuthAPI:
    """Test the Authentication REST API endpoints."""

    def test_register_user(self, client: TestClient):
        """Test POST /auth/register creates a new user."""
        user_data = {"email": "newuser@example.com", "password": "securepass123"}

        response = client.post("/auth/register", json=user_data)

        assert response.status_code == 201
        data = response.json()

        assert data["email"] == "newuser@example.com"
        assert data["id"] is not None
        assert data["isActive"]
        assert not data["isVerified"]
        assert "hashed_password" not in data  # Password should not be in response

    def test_register_duplicate_email(self, client: TestClient, test_user):
        """Test POST /auth/register rejects duplicate email."""
        user_data = {"email": test_user.email, "password": "anotherpassword123"}

        response = client.post("/auth/register", json=user_data)

        assert response.status_code == 400
        data = response.json()
        assert data["detail"]["messageCode"] == "AUTH_EMAIL_ALREADY_REGISTERED"

    def test_register_invalid_password(self, client: TestClient):
        """Test POST /auth/register rejects short password."""
        user_data = {
            "email": "user@example.com",
            "password": "short",  # Less than 8 characters
        }

        response = client.post("/auth/register", json=user_data)

        assert response.status_code == 422  # Validation error

    def test_register_invalid_email(self, client: TestClient):
        """Test POST /auth/register rejects invalid email."""
        user_data = {"email": "notanemail", "password": "validpass123"}

        response = client.post("/auth/register", json=user_data)

        assert response.status_code == 422  # Validation error

    def test_login_success(self, client: TestClient, test_user):
        """Test POST /auth/login with correct credentials."""
        login_data = {
            "username": test_user.email,  # OAuth2 uses username field
            "password": "testpassword123",
        }

        response = client.post("/auth/login", data=login_data)

        assert response.status_code == 200
        data = response.json()

        # Access token is in the body; refresh token is now an HttpOnly cookie.
        assert "accessToken" in data
        assert "refreshToken" not in data
        assert data["tokenType"] == "bearer"
        assert len(data["accessToken"]) > 0
        assert REFRESH_COOKIE_NAME in response.cookies

    def test_login_json_endpoint(self, client: TestClient, test_user):
        """Test POST /auth/login with JSON payload (instead of form data)."""
        login_data = {"email": test_user.email, "password": "testpassword123"}

        response = client.post("/auth/login", json=login_data)

        assert response.status_code == 200
        data = response.json()

        assert "accessToken" in data
        assert "refreshToken" not in data
        assert data["tokenType"] == "bearer"
        assert REFRESH_COOKIE_NAME in response.cookies

    def test_login_wrong_password(self, client: TestClient, test_user):
        """Test POST /auth/login with wrong password."""
        login_data = {"username": test_user.email, "password": "wrongpassword"}

        response = client.post("/auth/login", data=login_data)

        assert response.status_code == 401
        data = response.json()
        assert data["detail"]["messageCode"] == "AUTH_INVALID_CREDENTIALS"

    def test_login_nonexistent_user(self, client: TestClient):
        """Test POST /auth/login with non-existent user."""
        login_data = {
            "username": "nonexistent@example.com",
            "password": "somepassword123",
        }

        response = client.post("/auth/login", data=login_data)

        assert response.status_code == 401

    def test_login_inactive_user(self, client: TestClient, test_db: Session):
        """Test POST /auth/login with inactive user."""
        # Create inactive user
        inactive_user = User(
            email="inactive@example.com",
            hashed_password=hash_password("password123"),
            is_active=False,
            is_verified=True,
        )
        test_db.add(inactive_user)
        test_db.commit()

        login_data = {"username": inactive_user.email, "password": "password123"}

        response = client.post("/auth/login", data=login_data)

        assert response.status_code == 403
        data = response.json()
        assert data["detail"]["messageCode"] == "AUTH_INACTIVE_USER"

    def test_get_current_user(self, authenticated_client: TestClient):
        """Test GET /auth/me returns current user info."""
        response = authenticated_client.get("/auth/me")

        assert response.status_code == 200
        data = response.json()

        assert "email" in data
        assert "id" in data
        assert "isActive" in data
        assert "isVerified" in data
        assert "hashed_password" not in data

    def test_get_current_user_unauthorized(self, client: TestClient):
        """Test GET /auth/me without token returns 401."""
        response = client.get("/auth/me")

        assert response.status_code == 401

    def test_refresh_token(self, client: TestClient, test_user):
        """Test POST /auth/refresh with valid refresh token cookie."""
        login_response = client.post(
            "/auth/login",
            data={"username": test_user.email, "password": "testpassword123"},
        )
        assert login_response.status_code == 200

        response = client.post("/auth/refresh")

        assert response.status_code == 200
        data = response.json()

        # New access token in body, rotated refresh token in cookie
        assert "accessToken" in data
        assert "refreshToken" not in data
        assert data["tokenType"] == "bearer"
        assert REFRESH_COOKIE_NAME in response.cookies
        # Rotation issues a new token, distinct from the one used to log in.
        assert (
            response.cookies[REFRESH_COOKIE_NAME]
            != login_response.cookies[REFRESH_COOKIE_NAME]
        )

    def test_refresh_token_missing_cookie(self, client: TestClient):
        """Test POST /auth/refresh with no cookie returns 401."""
        response = client.post("/auth/refresh")

        assert response.status_code == 401
        data = response.json()
        assert data["detail"]["messageCode"] == "AUTH_INVALID_REFRESH_TOKEN"

    def test_refresh_token_invalid(self, client: TestClient):
        """Test POST /auth/refresh with invalid token cookie."""
        response = client.post(
            "/auth/refresh", cookies={REFRESH_COOKIE_NAME: "invalid_token"}
        )

        assert response.status_code == 401
        data = response.json()
        assert data["detail"]["messageCode"] == "AUTH_INVALID_REFRESH_TOKEN"

    def test_refresh_token_reuse_revokes_whole_family(
        self, client: TestClient, test_user
    ):
        """
        Test that reusing a rotated-away refresh token revokes the entire
        session, not just the reused token - the new (still unused) token
        from the same rotation must stop working too.
        """
        login_response = client.post(
            "/auth/login",
            data={"username": test_user.email, "password": "testpassword123"},
        )
        old_token = login_response.cookies[REFRESH_COOKIE_NAME]

        rotate_response = client.post(
            "/auth/refresh", cookies={REFRESH_COOKIE_NAME: old_token}
        )
        assert rotate_response.status_code == 200
        new_token = rotate_response.cookies[REFRESH_COOKIE_NAME]

        # Replaying the old (already-rotated-away) token is rejected.
        reuse_response = client.post(
            "/auth/refresh", cookies={REFRESH_COOKIE_NAME: old_token}
        )
        assert reuse_response.status_code == 401

        # The legitimate, never-yet-used token is now revoked too.
        followup_response = client.post(
            "/auth/refresh", cookies={REFRESH_COOKIE_NAME: new_token}
        )
        assert followup_response.status_code == 401

    def test_logout_revokes_refresh_token_server_side(
        self, client: TestClient, test_user
    ):
        """Test that /auth/logout revokes the refresh token, not just the cookie."""
        login_response = client.post(
            "/auth/login",
            data={"username": test_user.email, "password": "testpassword123"},
        )
        refresh_token = login_response.cookies[REFRESH_COOKIE_NAME]
        access_token = login_response.json()["accessToken"]

        logout_response = client.post(
            "/auth/logout",
            headers={"Authorization": f"Bearer {access_token}"},
            cookies={REFRESH_COOKIE_NAME: refresh_token},
        )
        assert logout_response.status_code == 200

        # The refresh token is now revoked server-side - replaying the raw
        # cookie value (as a thief with a copy of it would) must fail.
        response = client.post(
            "/auth/refresh", cookies={REFRESH_COOKIE_NAME: refresh_token}
        )
        assert response.status_code == 401

    def test_forgot_password(self, client: TestClient, test_user):
        """Test POST /auth/forgot-password sends reset email."""
        reset_request = {"email": test_user.email}

        response = client.post("/auth/forgot-password", json=reset_request)

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "AUTH_PASSWORD_RESET_SENT"

    def test_forgot_password_nonexistent_user(self, client: TestClient):
        """Test POST /auth/forgot-password with non-existent user (should still return success)."""
        reset_request = {"email": "nonexistent@example.com"}

        response = client.post("/auth/forgot-password", json=reset_request)

        # Should still return 200 to prevent email enumeration
        assert response.status_code == 200

    def test_reset_password(self, client: TestClient, test_user, test_db: Session):
        """Test POST /auth/reset-password with valid token."""
        from services.auth_service import verify_password

        # Create reset token directly on user
        reset_token = "test_reset_token_123"
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

        user = test_db.query(User).filter(User.id == test_user.id).first()
        user.password_reset_token = hash_one_time_token(reset_token)
        user.password_reset_expires_at = expires_at
        test_db.commit()

        reset_data = {"token": reset_token, "new_password": "newpassword123"}

        response = client.post("/auth/reset-password", json=reset_data)

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "AUTH_PASSWORD_RESET_SUCCESS"

        # Verify token was cleared
        test_db.refresh(user)
        assert user.password_reset_token is None
        assert user.password_reset_expires_at is None

        # Verify password was changed by checking hash directly (avoids rate limiting)
        assert verify_password("newpassword123", user.hashed_password)

    def test_reset_password_invalid_token(self, client: TestClient):
        """Test POST /auth/reset-password with invalid token."""
        reset_data = {"token": "invalid_token", "new_password": "newpassword123"}

        response = client.post("/auth/reset-password", json=reset_data)

        assert response.status_code == 400
        data = response.json()
        assert data["detail"]["messageCode"] == "AUTH_INVALID_RESET_TOKEN"

    def test_reset_password_expired_token(
        self, client: TestClient, test_user, test_db: Session
    ):
        """Test POST /auth/reset-password with expired token."""
        # Create expired reset token
        reset_token = "expired_token_123"
        expires_at = datetime.now(timezone.utc) - timedelta(hours=1)  # Expired

        user = test_db.query(User).filter(User.id == test_user.id).first()
        user.password_reset_token = hash_one_time_token(reset_token)
        user.password_reset_expires_at = expires_at
        test_db.commit()

        reset_data = {"token": reset_token, "new_password": "newpassword123"}

        response = client.post("/auth/reset-password", json=reset_data)

        assert response.status_code == 400
        data = response.json()
        assert data["detail"]["messageCode"] == "AUTH_INVALID_RESET_TOKEN"

    def test_logout(self, authenticated_client: TestClient):
        """Test POST /auth/logout clears the refresh cookie."""
        response = authenticated_client.post("/auth/logout")

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "AUTH_LOGOUT_SUCCESS"
        # FastAPI sets Max-Age=0 which causes the cookie value to be empty string
        # after deletion; verify the Set-Cookie header clears it.
        set_cookie_header = response.headers.get("set-cookie", "")
        assert REFRESH_COOKIE_NAME in set_cookie_header
        assert "max-age=0" in set_cookie_header.lower()

    def test_register_saves_verification_token(
        self, client: TestClient, test_db: Session
    ):
        """Test POST /auth/register saves verification token to database."""
        user_data = {"email": "verify@example.com", "password": "securepass123"}
        response = client.post("/auth/register", json=user_data)

        assert response.status_code == 201
        user = test_db.query(User).filter(User.email == "verify@example.com").first()
        assert user.email_verification_token is not None
        assert user.email_verification_expires_at is not None

    def test_verify_email_success(self, client: TestClient, test_db: Session):
        """Test GET /auth/verify-email/{token} verifies user."""
        # Create user with token
        user = User(
            email="unverified@example.com",
            hashed_password=hash_password("password123"),
            is_verified=False,
            email_verification_token=hash_one_time_token("test_token_123"),
            email_verification_expires_at=datetime.now(timezone.utc)
            + timedelta(hours=1),
        )
        test_db.add(user)
        test_db.commit()

        response = client.get("/auth/verify-email/test_token_123")

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "AUTH_EMAIL_VERIFIED_SUCCESS"
        test_db.refresh(user)
        assert user.is_verified
        assert user.email_verification_token is None

    def test_verify_email_expired_token(self, client: TestClient, test_db: Session):
        """Test GET /auth/verify-email with expired token fails."""
        user = User(
            email="expired@example.com",
            hashed_password=hash_password("password123"),
            is_verified=False,
            email_verification_token=hash_one_time_token("expired_token"),
            email_verification_expires_at=datetime.now(timezone.utc)
            - timedelta(hours=1),
        )
        test_db.add(user)
        test_db.commit()

        response = client.get("/auth/verify-email/expired_token")

        assert response.status_code == 400
        data = response.json()
        assert data["detail"]["messageCode"] == "AUTH_INVALID_VERIFICATION_TOKEN"

    def test_verify_email_invalid_token(self, client: TestClient):
        """Test GET /auth/verify-email with invalid token fails."""
        response = client.get("/auth/verify-email/nonexistent_token")
        assert response.status_code == 400
        data = response.json()
        assert data["detail"]["messageCode"] == "AUTH_INVALID_VERIFICATION_TOKEN"

    def test_login_unverified_user_fails(self, client: TestClient, test_db: Session):
        """Test POST /auth/login fails for unverified user."""
        # Create unverified user
        email = "unverified_login@example.com"
        password = "password123"
        user = User(
            email=email,
            hashed_password=hash_password(password),
            is_active=True,
            is_verified=False,
        )
        test_db.add(user)
        test_db.commit()

        login_data = {"email": email, "password": password}
        response = client.post("/auth/login", json=login_data)

        assert response.status_code == 403
        data = response.json()
        assert data["detail"]["messageCode"] == "AUTH_EMAIL_NOT_VERIFIED"
