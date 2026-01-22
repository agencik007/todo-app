import os
import shutil
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.orm import Session
from models.user import User
from config.database import get_db
from routes.auth import get_current_user
from pathlib import Path

router = APIRouter(
    prefix="/users",
    tags=["users"]
)

UPLOAD_DIR = Path("uploadedFiles")

@router.post("/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image"
        )
    
    # Create user directory if not exists
    user_dir = UPLOAD_DIR / str(current_user.id)
    user_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate file path
    # We'll use a fixed name 'avatar' + extension to avoid accumulating files
    # or we could use the original filename. Let's use 'avatar' to keep it simple and overwrite.
    extension = Path(file.filename).suffix
    if not extension:
        extension = ".png" # Default to png if no extension
        
    file_path = user_dir / f"avatar{extension}"
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not save file: {str(e)}"
        )
        
    # Update user avatar_url
    # The URL should be accessible via the static mount
    # We'll serve 'uploadedFiles' at '/static' or similar, or directly at '/uploadedFiles'
    # Let's assume we mount it at '/uploads'
    avatar_url = f"/uploads/{current_user.id}/avatar{extension}"
    
    current_user.avatar_url = avatar_url
    db.commit()
    db.refresh(current_user)
    
    return {"avatar_url": avatar_url}

@router.delete("/me/avatar")
async def delete_avatar(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.avatar_url:
        # Extract file path from url
        # URL is like /uploads/{user_id}/avatar.png
        # File path is uploadedFiles/{user_id}/avatar.png
        
        # Simple way: assume structure
        try:
            user_dir = UPLOAD_DIR / str(current_user.id)
            if user_dir.exists():
                shutil.rmtree(user_dir)
        except Exception as e:
            print(f"Error deleting file: {e}")
            # Continue to clear DB even if file delete fails
            
        current_user.avatar_url = None
        db.commit()
        db.refresh(current_user)
        
    return {"message": "Avatar deleted"}
