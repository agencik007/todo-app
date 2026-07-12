"""
Users routes - User profile and avatar management endpoints.
"""

import os
import shutil
import secrets
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.orm import Session

from config.auth import get_current_verified_user
from config.database import get_db
from config.api_messages import ApiMessages, api_error, api_success
from models.user import User
from models.schemas import UserLanguageUpdate

router = APIRouter(prefix="/users", tags=["users"])
logger = logging.getLogger(__name__)

UPLOAD_DIR = Path("uploadedFiles")
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
UPLOAD_CHUNK_SIZE = 64 * 1024

# Magic-byte signatures for each allowed image format. The client-supplied
# Content-Type and filename are never trusted for the actual saved
# extension - only what the file's own bytes say it is.
_IMAGE_SIGNATURES: list[tuple[bytes, str]] = [
    (b"\x89PNG\r\n\x1a\n", ".png"),
    (b"\xff\xd8\xff", ".jpg"),
    (b"GIF87a", ".gif"),
    (b"GIF89a", ".gif"),
]
_MAX_SIGNATURE_BYTES = 12  # WEBP's signature spans the first 12 bytes


def _sniff_image_extension(prefix: bytes) -> Optional[str]:
    """
    Identify an image's real format from its leading bytes.

    Returns the matching file extension, or None if the prefix doesn't
    match any allowed image format.
    """
    for signature, extension in _IMAGE_SIGNATURES:
        if prefix.startswith(signature):
            return extension

    if len(prefix) >= 12 and prefix[:4] == b"RIFF" and prefix[8:12] == b"WEBP":
        return ".webp"

    return None


@router.post("/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """
    Upload user avatar image.

    Streams the upload to a temporary file in chunks, enforcing the size
    limit as it goes instead of buffering the whole file in memory first,
    then identifies the real image format from its magic bytes - the
    client-supplied Content-Type and filename are only used for the cheap
    early rejection, not for the final saved extension.

    Args:
        file: Image file to upload.
        current_user: Current authenticated user.
        db: Database session.

    Returns:
        dict: URL of the uploaded avatar.

    Raises:
        HTTPException: If the file isn't a recognized image, is too large,
            or the upload fails.
    """
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=api_error(ApiMessages.USER_AVATAR_INVALID_TYPE),
        )

    user_dir = UPLOAD_DIR / str(current_user.id)
    user_dir.mkdir(parents=True, exist_ok=True)

    # Hardcoded 'avatar' name (not the client's filename) prevents path
    # traversal; the random suffix keeps concurrent uploads from colliding.
    temp_path = user_dir / f".avatar-upload-{secrets.token_hex(8)}.tmp"

    prefix = b""
    total_size = 0
    try:
        with open(temp_path, "wb") as buffer:
            while chunk := await file.read(UPLOAD_CHUNK_SIZE):
                total_size += len(chunk)
                if total_size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=api_error(ApiMessages.USER_AVATAR_TOO_LARGE),
                    )
                if len(prefix) < _MAX_SIGNATURE_BYTES:
                    prefix += chunk
                buffer.write(chunk)
    except HTTPException:
        temp_path.unlink(missing_ok=True)
        raise
    except Exception:
        temp_path.unlink(missing_ok=True)
        logger.exception("Error saving avatar file")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=api_error(ApiMessages.USER_AVATAR_SAVE_ERROR),
        )

    extension = _sniff_image_extension(prefix)
    if extension is None:
        temp_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=api_error(ApiMessages.USER_AVATAR_INVALID_EXTENSION),
        )

    # Remove any previous avatar saved under a different extension before
    # moving the new one into place (e.g. switching from .png to .jpg).
    for existing in user_dir.glob("avatar.*"):
        existing.unlink(missing_ok=True)

    final_path = user_dir / f"avatar{extension}"
    os.replace(temp_path, final_path)

    # Update user avatar_url
    avatar_url = f"/uploads/{current_user.id}/avatar{extension}"
    current_user.avatar_url = avatar_url
    db.commit()
    db.refresh(current_user)

    return {"avatarUrl": avatar_url}


@router.delete("/me/avatar")
async def delete_avatar(
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """
    Delete user avatar.

    Args:
        current_user: Current authenticated user.
        db: Database session.

    Returns:
        dict: Success message.
    """
    if current_user.avatar_url:
        # Delete user's upload directory
        try:
            user_dir = UPLOAD_DIR / str(current_user.id)
            if user_dir.exists():
                shutil.rmtree(user_dir)
        except Exception:
            logger.exception("Error deleting avatar file")
            # Continue to clear DB even if file delete fails

        current_user.avatar_url = None
        db.commit()
        db.refresh(current_user)

    return api_success(ApiMessages.USER_AVATAR_DELETED)


@router.put("/me/language")
async def update_language(
    language_update: UserLanguageUpdate,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """
    Update user language preference.

    Args:
        language_update: New language (en or pl).
        current_user: Current authenticated user.
        db: Database session.

    Returns:
        dict: Success message.
    """
    current_user.language = language_update.language
    db.commit()
    db.refresh(current_user)

    return api_success(
        ApiMessages.USER_LANGUAGE_UPDATED, language=current_user.language
    )
