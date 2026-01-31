"""
Authentication routes - User registration, login, and password management.
"""

import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from config.auth import get_current_active_user
from config.database import get_db
from models.user import User
from models.schemas import (
    UserCreate,
    UserResponse,
    Token,
    PasswordResetRequest,
    PasswordReset,
    RefreshTokenRequest,
)
from services.auth_service import (
    hash_password,
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

# Use a no-op limiter in testing environment
IS_TESTING = os.getenv("TESTING", "0") == "1"
if IS_TESTING:
    # No rate limiting in tests
    limiter = Limiter(key_func=get_remote_address, default_limits=["10000/second"])
else:
    limiter = Limiter(key_func=get_remote_address)

# Constants
PASSWORD_RESET_EXPIRY_HOURS = 1


def _create_verification_token() -> str:
    """Create a cryptographically secure verification token."""
    return secrets.token_urlsafe(32)


def _create_tokens(user: User) -> dict:
    """
    Create access and refresh tokens for a user.
    
    Args:
        user: The user to create tokens for.
        
    Returns:
        dict: Token response with access_token, refresh_token, and token_type.
    """
    return {
        "access_token": create_access_token(data={"sub": user.id, "email": user.email}),
        "refresh_token": create_refresh_token(data={"sub": user.id, "email": user.email}),
        "token_type": "bearer",
    }


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
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
            detail="Email already registered"
        )

    # Create new user
    new_user = User(
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        is_active=True,
        is_verified=False,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Send verification email (non-blocking)
    try:
        verification_token = _create_verification_token()
        send_verification_email(user_data.email, verification_token)
    except Exception as e:
        print(f"Error sending verification email: {e}")

    return new_user


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
async def login(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Login endpoint - accepts both form data and JSON.
    
    Supports two formats:
    - **Form data**: `username` (email) and `password` fields (OAuth2 standard)
    - **JSON body**: `{"email": "...", "password": "..."}` (frontend-friendly)
    
    Args:
        request: FastAPI request object.
        db: Database session.
        
    Returns:
        Token: Access and refresh tokens.
        
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
                detail="Invalid JSON body"
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
                detail="Invalid form data"
            )
    
    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Email and password are required"
        )
    
    user = authenticate_user(db, email, password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Inactive user"
        )

    return _create_tokens(user)


@router.post("/refresh", response_model=Token)
def refresh_access_token(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    """
    Refresh access token using refresh token.
    
    Args:
        request: Refresh token request.
        db: Database session.
        
    Returns:
        Token: New access and refresh tokens.
        
    Raises:
        HTTPException: If refresh token is invalid or user not found.
    """
    payload = verify_token(request.refresh_token, token_type="refresh")
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid token payload"
        )

    # Verify user still exists and is active
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    return _create_tokens(user)


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
    request: Request, 
    reset_request: PasswordResetRequest, 
    db: Session = Depends(get_db)
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
        user.password_reset_token = secrets.token_urlsafe(32)
        user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(
            hours=PASSWORD_RESET_EXPIRY_HOURS
        )
        db.commit()

        # Send reset email
        try:
            send_password_reset_email(user.email, user.password_reset_token)
        except Exception as e:
            print(f"Error sending password reset email: {e}")

    return {"message": "If the email exists, a password reset link has been sent"}


@router.post("/reset-password")
@limiter.limit("5/hour")
def reset_password(
    request: Request, 
    reset_data: PasswordReset, 
    db: Session = Depends(get_db)
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
    # Find user with valid reset token
    user = (
        db.query(User)
        .filter(
            User.password_reset_token == reset_data.token,
            User.password_reset_expires_at > datetime.now(timezone.utc),
        )
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    # Update password and clear reset token
    user.hashed_password = hash_password(reset_data.new_password)
    user.password_reset_token = None
    user.password_reset_expires_at = None
    db.commit()

    return {"message": "Password has been reset successfully"}


@router.get("/verify-email/{token}")
def verify_email(token: str, db: Session = Depends(get_db)):
    """
    Verify email address with token (not fully implemented).
    
    Args:
        token: Email verification token.
        db: Database session.
        
    Raises:
        HTTPException: Feature not implemented.
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Email verification via token endpoint is not fully implemented.",
    )


@router.post("/verify-email")
def verify_email_post(token: str, db: Session = Depends(get_db)):
    """
    Verify email address (placeholder endpoint).
    
    Args:
        token: Email verification token.
        db: Database session.
        
    Returns:
        dict: Placeholder message.
    """
    return {"message": "Email verification endpoint - implement proper token storage"}


@router.post("/logout")
def logout(current_user: User = Depends(get_current_active_user)):
    """
    Logout endpoint.
    
    Note: With JWT tokens, logout is handled client-side by discarding tokens.
    
    Args:
        current_user: Current authenticated user.
        
    Returns:
        dict: Success message.
    """
    return {"message": "Logged out successfully"}
