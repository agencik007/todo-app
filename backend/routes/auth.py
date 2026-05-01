"""
Authentication routes - User registration, login, and password management.
"""

import os
import secrets
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from config.auth import get_current_active_user
from config.database import get_db
from config.api_messages import ApiMessages, api_error, api_success
from models.user import User
from models.schemas import (
    UserCreate,
    UserResponse,
    Token,
    PasswordResetRequest,
    PasswordReset,
)
from services.auth_service import (
    hash_password,
    hash_one_time_token,
    authenticate_user,
    create_access_token,
    create_refresh_token,
    verify_token,
)
from services.email_service import (
    send_verification_email,
    send_password_reset_email,
)

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)

# Use a no-op limiter in testing environment
IS_TESTING = os.getenv("TESTING", "0") == "1"
limiter = Limiter(key_func=get_remote_address, enabled=not IS_TESTING)

# Constants
PASSWORD_RESET_EXPIRY_HOURS = 1
REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_PATH = "/auth/refresh"
REFRESH_TOKEN_MAX_AGE = 86400  # 24h in seconds
# Set Secure=True in production (HTTPS). On dev HTTP localhost keep False.
SECURE_COOKIES = os.getenv("SECURE_COOKIES", "False").lower() == "true"


def _create_verification_token() -> str:
    """Create a cryptographically secure verification token."""
    return secrets.token_urlsafe(32)


def _create_access_token(user: User) -> str:
    """Create a JWT access token for the given user."""
    return create_access_token(data={"sub": user.id, "email": user.email})


def _create_refresh_token(user: User) -> str:
    """Create a JWT refresh token for the given user."""
    return create_refresh_token(data={"sub": user.id, "email": user.email})


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    """Set the HttpOnly refresh token cookie on the response."""
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=SECURE_COOKIES,
        samesite="strict",
        path=REFRESH_COOKIE_PATH,
        max_age=REFRESH_TOKEN_MAX_AGE,
    )


def _clear_refresh_cookie(response: Response) -> None:
    """Clear the refresh token cookie (logout / invalid token)."""
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=SECURE_COOKIES,
        samesite="strict",
    )


@router.post(
    "/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
@limiter.limit("5/minute")
def register(request: Request, user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user.

    Args:
        request: FastAPI request object (for rate limiting).
        user_data: User registration data.
        db: Database session.

    Returns:
        UserResponse: The created user.

    Raises:
        HTTPException: If email is already registered.
    """
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=api_error(ApiMessages.AUTH_EMAIL_ALREADY_REGISTERED),
        )

    # Create new user with verification token
    verification_token = _create_verification_token()
    new_user = User(
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        is_active=True,
        is_verified=False,
        email_verification_token=hash_one_time_token(verification_token),
        email_verification_expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Send verification email (non-blocking)
    try:
        send_verification_email(
            user_data.email, verification_token, language=new_user.language
        )
    except Exception:
        import logging

        logging.getLogger(__name__).exception("Failed to send verification email")

    new_user.message = ApiMessages.AUTH_REGISTER_SUCCESS.value
    return new_user


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
async def login(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Login endpoint - accepts both form data and JSON.

    Supports two formats:
    - **Form data**: `username` (email) and `password` fields (OAuth2 standard)
    - **JSON body**: `{"email": "...", "password": "..."}` (frontend-friendly)

    The refresh token is returned as an HttpOnly cookie; the access token is
    returned in the response body.

    Args:
        request: FastAPI request object.
        response: FastAPI response object (used to set the refresh cookie).
        db: Database session.

    Returns:
        Token: Access token (refresh token is in Set-Cookie header).

    Raises:
        HTTPException: If credentials are invalid or user is inactive.
    """
    content_type = request.headers.get("content-type", "")

    if "application/json" in content_type:
        # Parse JSON body
        try:
            body = await request.json()
            email = body.get("email", "")
            password = body.get("password", "")
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=api_error(ApiMessages.AUTH_INVALID_JSON_BODY),
            )
    else:
        # Parse form data
        try:
            form = await request.form()
            email = form.get("username", "")  # OAuth2 uses 'username' field
            password = form.get("password", "")
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=api_error(ApiMessages.AUTH_INVALID_FORM_DATA),
            )

    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=api_error(ApiMessages.AUTH_EMAIL_PASSWORD_REQUIRED),
        )

    user = authenticate_user(db, email, password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=api_error(ApiMessages.AUTH_INVALID_CREDENTIALS),
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=api_error(ApiMessages.AUTH_INACTIVE_USER),
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=api_error(ApiMessages.AUTH_EMAIL_NOT_VERIFIED),
        )

    _set_refresh_cookie(response, _create_refresh_token(user))
    return Token(
        access_token=_create_access_token(user),
        message=ApiMessages.AUTH_LOGIN_SUCCESS.value,
    )


@router.post("/refresh", response_model=Token)
def refresh_access_token(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Refresh access token using the HttpOnly refresh token cookie.

    Reads the refresh token from the cookie (never from the body).
    On success, issues a new access token in the body and rotates
    the refresh token cookie.

    Args:
        request: FastAPI request object (cookie is read from here).
        response: FastAPI response object (used to set the new refresh cookie).
        db: Database session.

    Returns:
        Token: New access token (new refresh token is in Set-Cookie header).

    Raises:
        HTTPException: If refresh token cookie is missing, invalid, or user not found.
    """
    raw_refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)

    if not raw_refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=api_error(ApiMessages.AUTH_INVALID_REFRESH_TOKEN),
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = verify_token(raw_refresh_token, token_type="refresh")

    if payload is None:
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=api_error(ApiMessages.AUTH_INVALID_REFRESH_TOKEN),
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if user_id is None:
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=api_error(ApiMessages.AUTH_INVALID_TOKEN_PAYLOAD),
        )

    # Verify user still exists and is active
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=api_error(ApiMessages.AUTH_USER_NOT_FOUND_OR_INACTIVE),
        )

    # Rotate refresh token
    _set_refresh_cookie(response, _create_refresh_token(user))
    return Token(access_token=_create_access_token(user))


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """
    Get current user information.

    Args:
        current_user: Current authenticated user.

    Returns:
        UserResponse: Current user's profile information.
    """
    return current_user


@router.post("/forgot-password")
@limiter.limit("3/hour")
def forgot_password(
    request: Request, reset_request: PasswordResetRequest, db: Session = Depends(get_db)
):
    """
    Request password reset.

    Always returns success to prevent email enumeration attacks.

    Args:
        request: FastAPI request object (for rate limiting).
        reset_request: Password reset request with email.
        db: Database session.

    Returns:
        dict: Generic success message.
    """
    user = db.query(User).filter(User.email == reset_request.email).first()

    if user:
        # Generate reset token with expiration
        raw_reset_token = secrets.token_urlsafe(32)
        user.password_reset_token = hash_one_time_token(raw_reset_token)
        user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(
            hours=PASSWORD_RESET_EXPIRY_HOURS
        )
        db.commit()

        # Send reset email
        try:
            send_password_reset_email(
                user.email, raw_reset_token, language=user.language
            )
        except Exception:
            logger.exception("Error sending password reset email")

    return api_success(ApiMessages.AUTH_PASSWORD_RESET_SENT)


@router.post("/reset-password")
@limiter.limit("5/hour")
def reset_password(
    request: Request, reset_data: PasswordReset, db: Session = Depends(get_db)
):
    """
    Reset password with token.

    Args:
        request: FastAPI request object (for rate limiting).
        reset_data: Reset data with token and new password.
        db: Database session.

    Returns:
        dict: Success message.

    Raises:
        HTTPException: If token is invalid or expired.
    """
    token_hash = hash_one_time_token(reset_data.token)

    # Find user with valid reset token
    user = (
        db.query(User)
        .filter(
            User.password_reset_token == token_hash,
            User.password_reset_expires_at > datetime.now(timezone.utc),
        )
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=api_error(ApiMessages.AUTH_INVALID_RESET_TOKEN),
        )

    # Update password and clear reset token
    user.hashed_password = hash_password(reset_data.new_password)
    user.password_reset_token = None
    user.password_reset_expires_at = None
    db.commit()

    return api_success(ApiMessages.AUTH_PASSWORD_RESET_SUCCESS)


@router.get("/verify-email/{token}", response_model=dict)
def verify_email(token: str, db: Session = Depends(get_db)):
    """
    Verify email with token.
    """
    token_hash = hash_one_time_token(token)

    user = (
        db.query(User)
        .filter(
            User.email_verification_token == token_hash,
            User.email_verification_expires_at > datetime.now(timezone.utc),
        )
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=api_error(ApiMessages.AUTH_INVALID_VERIFICATION_TOKEN),
        )

    user.is_verified = True
    user.email_verification_token = None
    user.email_verification_expires_at = None
    db.commit()

    return api_success(ApiMessages.AUTH_EMAIL_VERIFIED_SUCCESS)


@router.post("/resend-verification")
@limiter.limit("3/hour")
def resend_verification(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Resend verification email to current user.

    Args:
        request: FastAPI request object (for rate limiting).
        current_user: Current authenticated user.
        db: Database session.

    Returns:
        dict: Success message.
    """
    if current_user.is_verified:
        return api_success(ApiMessages.AUTH_EMAIL_ALREADY_VERIFIED)

    token = _create_verification_token()
    current_user.email_verification_token = hash_one_time_token(token)
    current_user.email_verification_expires_at = datetime.now(timezone.utc) + timedelta(
        hours=24
    )
    db.commit()

    try:
        send_verification_email(
            current_user.email, token, language=current_user.language
        )
    except Exception:
        import logging

        logging.getLogger(__name__).exception("Failed to send verification email")

    return api_success(ApiMessages.AUTH_VERIFICATION_EMAIL_SENT)


@router.post("/logout")
def logout(
    response: Response,
    current_user: User = Depends(get_current_active_user),
):
    """
    Logout endpoint.

    Clears the HttpOnly refresh token cookie. The client is responsible
    for discarding the in-memory access token.

    Args:
        response: FastAPI response object (used to clear the refresh cookie).
        current_user: Current authenticated user.

    Returns:
        dict: Success message.
    """
    _clear_refresh_cookie(response)
    return api_success(ApiMessages.AUTH_LOGOUT_SUCCESS)
