"""
Users routes - User profile and avatar management endpoints.
"""

import shutil
import logging
from pathlib import Path

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
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


@router.post("/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """
    Upload user avatar image.

    Args:
        file: Image file to upload.
        current_user: Current authenticated user.
        db: Database session.

    Returns:
        dict: URL of the uploaded avatar.

    Raises:
        HTTPException: If file is not an image or upload fails.
    """
    # Validate file type
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=api_error(ApiMessages.USER_AVATAR_INVALID_TYPE),
        )

    # Validate file size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=api_error(ApiMessages.USER_AVATAR_TOO_LARGE),
        )
    # Reset file pointer after reading for saving
    await file.seek(0)

    # Validate extension and prevent path traversal
    if not file.filename:
        extension = ".png"
    else:
        # Get extension safely and validate against whitelist
        original_path = Path(file.filename)
        extension = original_path.suffix.lower()
        if extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=api_error(ApiMessages.USER_AVATAR_INVALID_EXTENSION),
            )

    # Create user directory if not exists
    user_dir = UPLOAD_DIR / str(current_user.id)
    user_dir.mkdir(parents=True, exist_ok=True)

    # Generate file path with extension (using hardcoded 'avatar' name prevents traversal)
    file_path = user_dir / f"avatar{extension}"

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception:
        logger.exception("Error saving avatar file")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=api_error(ApiMessages.USER_AVATAR_SAVE_ERROR),
        )

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
