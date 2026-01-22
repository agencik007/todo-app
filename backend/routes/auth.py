from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import secrets
from typing import Optional

from config.database import get_db
from config.auth import get_current_active_user, get_current_user
from models.user import User
from models.password_reset_token import PasswordResetToken
from models.schemas import (
    UserCreate, UserResponse, Token, LoginRequest,
    PasswordResetRequest, PasswordReset, RefreshTokenRequest
)
from services.auth_service import (
    hash_password, authenticate_user, create_access_token,
    create_refresh_token, verify_token
)
from services.email_service import (
    send_verification_email, send_password_reset_email,
    send_welcome_email
)

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


def create_verification_token() -> str:
    """Create a verification token for email verification"""
    return secrets.token_urlsafe(32)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(request: Request, user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    hashed_password = hash_password(user_data.password)
    verification_token = create_verification_token()
    
    new_user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        is_active=True,
        is_verified=False
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Send verification email
    try:
        send_verification_email(user_data.email, verification_token)
    except Exception as e:
        print(f"Error sending verification email: {e}")
        # Don't fail registration if email fails
    
    return new_user


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Login and get access/refresh tokens"""
    user = authenticate_user(db, form_data.username, form_data.password)
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
    
    # Create tokens
    access_token = create_access_token(data={"sub": user.id, "email": user.email})
    refresh_token = create_refresh_token(data={"sub": user.id, "email": user.email})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.post("/login/json", response_model=Token)
@limiter.limit("5/minute")
def login_json(request: Request, login_data: LoginRequest, db: Session = Depends(get_db)):
    """Login endpoint that accepts JSON (alternative to OAuth2 form)"""
    user = authenticate_user(db, login_data.email, login_data.password)
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
    
    # Create tokens
    access_token = create_access_token(data={"sub": user.id, "email": user.email})
    refresh_token = create_refresh_token(data={"sub": user.id, "email": user.email})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.post("/refresh", response_model=Token)
def refresh_access_token(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    """Refresh access token using refresh token"""
    payload = verify_token(request.refresh_token, token_type="refresh")
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    email = payload.get("email")
    
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
            detail="User not found or inactive"
        )
    
    # Create new tokens
    new_access_token = create_access_token(data={"sub": user.id, "email": user.email})
    new_refresh_token = create_refresh_token(data={"sub": user.id, "email": user.email})
    
    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """Get current user information"""
    return current_user


@router.post("/forgot-password")
def forgot_password(request: PasswordResetRequest, db: Session = Depends(get_db)):
    """Request password reset"""
    user = db.query(User).filter(User.email == request.email).first()
    
    # Always return success to prevent email enumeration
    if user:
        # Generate reset token
        reset_token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        
        # Invalidate old tokens
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used == False
        ).update({"used": True})
        
        # Create new reset token
        reset_token_obj = PasswordResetToken(
            token=reset_token,
            user_id=user.id,
            expires_at=expires_at,
            used=False
        )
        
        db.add(reset_token_obj)
        db.commit()
        
        # Send reset email
        try:
            send_password_reset_email(user.email, reset_token)
        except Exception as e:
            print(f"Error sending password reset email: {e}")
    
    return {"message": "If the email exists, a password reset link has been sent"}


@router.post("/reset-password")
def reset_password(reset_data: PasswordReset, db: Session = Depends(get_db)):
    """Reset password with token"""
    # Find valid reset token
    reset_token_obj = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == reset_data.token,
        PasswordResetToken.used == False,
        PasswordResetToken.expires_at > datetime.now(timezone.utc)
    ).first()
    
    if not reset_token_obj:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    # Get user
    user = db.query(User).filter(User.id == reset_token_obj.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update password
    user.hashed_password = hash_password(reset_data.new_password)
    
    # Mark token as used
    reset_token_obj.used = True
    
    db.commit()
    
    return {"message": "Password has been reset successfully"}


@router.get("/verify-email/{token}")
def verify_email(token: str, db: Session = Depends(get_db)):
    """
    Verify email address with token
    Note: For simplicity, we're using a token in the URL. 
    In production, you might want to store verification tokens in the database
    similar to password reset tokens.
    """
    # For now, we'll skip token verification and just mark all users as verified
    # In a real application, you'd want to store verification tokens in the database
    # and verify them here
    
    # This is a simplified version - in production, you'd want to:
    # 1. Create a VerificationToken model similar to PasswordResetToken
    # 2. Store the token when sending verification email
    # 3. Verify it here
    
    # For now, we'll accept any token and verify the first unverified user
    # This is NOT secure for production!
    
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Email verification via token endpoint is not fully implemented. Please use the /auth/verify-email endpoint with proper token storage."
    )


@router.post("/verify-email")
def verify_email_post(token: str, db: Session = Depends(get_db)):
    """
    Verify email address - simplified version
    In production, store verification tokens in database
    """
    # For demo purposes, we'll just verify any user with the matching email
    # In production, implement proper token storage and verification
    
    # Placeholder - this should be properly implemented with token storage
    return {"message": "Email verification endpoint - implement proper token storage"}


@router.post("/logout")
def logout(current_user: User = Depends(get_current_active_user)):
    """
    Logout endpoint
    Note: With JWT, logout is typically handled client-side by removing tokens.
    For server-side logout, you'd need to maintain a token blacklist.
    """
    return {"message": "Logged out successfully"}

