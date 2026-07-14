"""
Authentication service - Password hashing and JWT token management.
"""

import os
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from models.user import User
from models.refresh_token import RefreshToken

# Password hashing configuration
BCRYPT_ROUNDS = 12

# JWT Configuration
MIN_SECRET_KEY_LENGTH = 32
INSECURE_SECRET_KEYS = {
    "your-secret-key-here-change-in-production",
    "your-secret-key-here",
    "your-super-secret-key-change-in-production",
    "your_secret_key",
    "changeme",
    "change_me_generate_with_openssl_rand_hex_32",
}

SECRET_KEY = os.getenv("SECRET_KEY")
if (
    not SECRET_KEY
    or SECRET_KEY.strip().lower() in INSECURE_SECRET_KEYS
    or len(SECRET_KEY) < MIN_SECRET_KEY_LENGTH
):
    raise ValueError(
        "No secure SECRET_KEY set for application. "
        f"Please set a SECRET_KEY of at least {MIN_SECRET_KEY_LENGTH} random "
        "characters in environment variables (e.g. `openssl rand -hex 32`)."
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_HOURS = 24


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.

    Args:
        plain_password: The plain text password to verify.
        hashed_password: The bcrypt hashed password.

    Returns:
        bool: True if password matches, False otherwise.
    """
    try:
        if isinstance(plain_password, str):
            plain_password = plain_password.encode("utf-8")
        if isinstance(hashed_password, str):
            hashed_password = hashed_password.encode("utf-8")

        return bcrypt.checkpw(plain_password, hashed_password)
    except Exception:
        return False


def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt.

    Args:
        password: The plain text password to hash.

    Returns:
        str: The bcrypt hashed password.
    """
    if isinstance(password, str):
        password = password.encode("utf-8")

    salt = bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
    hashed = bcrypt.hashpw(password, salt)

    return hashed.decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.

    Args:
        data: Dictionary containing token payload (must include 'sub').
        expires_delta: Optional custom expiration time.

    Returns:
        str: Encoded JWT token.
    """
    to_encode = data.copy()

    # Ensure 'sub' is a string (JWT spec requirement)
    if "sub" in to_encode and not isinstance(to_encode["sub"], str):
        to_encode["sub"] = str(to_encode["sub"])

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update({"exp": int(expire.timestamp()), "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def issue_refresh_token(
    db: Session, user_id: int, family_id: Optional[str] = None
) -> str:
    """
    Issue a new server-side refresh token and return its raw value.

    Only the raw token's hash is stored; the raw value is sent to the client
    as an HttpOnly cookie and never persisted in plain text. If family_id is
    given, the new token continues that rotation chain (used when rotating
    on refresh); otherwise a new chain is started (e.g. on login).

    Args:
        db: Database session.
        user_id: ID of the user the token belongs to.
        family_id: Rotation family to continue, or None to start a new one.

    Returns:
        str: The raw refresh token.
    """
    raw_token = secrets.token_urlsafe(32)
    record = RefreshToken(
        user_id=user_id,
        token_hash=hash_one_time_token(raw_token),
        family_id=family_id or secrets.token_urlsafe(16),
        expires_at=datetime.now(timezone.utc)
        + timedelta(hours=REFRESH_TOKEN_EXPIRE_HOURS),
    )
    db.add(record)
    db.commit()
    return raw_token


def rotate_refresh_token(db: Session, raw_token: str) -> Optional[tuple[str, User]]:
    """
    Validate a raw refresh token against the database and rotate it.

    On success, the presented token is revoked and a replacement is issued
    in the same rotation family. If a token that was already rotated away
    is presented again, the entire family is revoked instead - that can only
    happen if the token was stolen and used by two parties, so every session
    descended from it is killed and the legitimate holder must log in again.

    Args:
        db: Database session.
        raw_token: The raw refresh token from the client's cookie.

    Returns:
        Optional[tuple[str, User]]: (new raw refresh token, user) on success,
        None if the token is invalid, expired, inactive, or reused.
    """
    record = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == hash_one_time_token(raw_token))
        .first()
    )
    if record is None:
        return None

    now = datetime.now(timezone.utc)

    if record.revoked_at is not None:
        # Reuse of an already-rotated-away token: likely theft. Kill the
        # whole family so the legitimate holder is forced to re-authenticate.
        db.query(RefreshToken).filter(
            RefreshToken.family_id == record.family_id,
            RefreshToken.revoked_at.is_(None),
        ).update({RefreshToken.revoked_at: now}, synchronize_session=False)
        db.commit()
        return None

    if record.expires_at < now:
        return None

    user = db.query(User).filter(User.id == record.user_id).first()
    if user is None or not user.is_active:
        return None

    record.revoked_at = now
    db.commit()

    new_raw_token = issue_refresh_token(db, user.id, family_id=record.family_id)
    return new_raw_token, user


def revoke_refresh_token(db: Session, raw_token: str) -> None:
    """
    Revoke a single refresh token (used on logout).

    Args:
        db: Database session.
        raw_token: The raw refresh token to revoke.
    """
    db.query(RefreshToken).filter(
        RefreshToken.token_hash == hash_one_time_token(raw_token),
        RefreshToken.revoked_at.is_(None),
    ).update(
        {RefreshToken.revoked_at: datetime.now(timezone.utc)},
        synchronize_session=False,
    )
    db.commit()


def revoke_all_refresh_tokens_for_user(db: Session, user_id: int) -> None:
    """
    Revoke every active refresh token for a user (e.g. after a password change).

    Args:
        db: Database session.
        user_id: ID of the user whose sessions should be invalidated.
    """
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.revoked_at.is_(None),
    ).update(
        {RefreshToken.revoked_at: datetime.now(timezone.utc)},
        synchronize_session=False,
    )
    db.commit()


def hash_one_time_token(token: str) -> str:
    """
    Hash one-time token for secure storage in database.

    Args:
        token: Raw token sent to user.

    Returns:
        str: SHA-256 hash of the token.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def verify_token(token: str, token_type: str = "access") -> Optional[dict]:
    """
    Verify and decode a JWT token.

    Args:
        token: The JWT token to verify.
        token_type: Expected token type ('access' or 'refresh').

    Returns:
        Optional[dict]: Token payload if valid, None otherwise.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        if payload.get("type") != token_type:
            return None

        return payload
    except JWTError:
        return None


# Precomputed hash of a random value. Used to keep authenticate_user's timing
# constant when the email doesn't exist, so response latency can't be used to
# enumerate registered accounts.
_DUMMY_PASSWORD_HASH = hash_password(secrets.token_urlsafe(32))


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """
    Authenticate a user by email and password.

    Args:
        db: Database session.
        email: User's email address.
        password: User's plain text password.

    Returns:
        Optional[User]: The user if authentication succeeds, None otherwise.
    """
    user = db.query(User).filter(User.email == email).first()
    hashed_password = user.hashed_password if user else _DUMMY_PASSWORD_HASH
    password_ok = verify_password(password, hashed_password)
    if not user or not password_ok:
        return None
    return user
