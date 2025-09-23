from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

# Base Todo schema
class TodoBase(BaseModel):
    title: str = Field(..., min_length=1, description="Title must not be empty")
    description: Optional[str] = None
    completed: bool = False

# Todo schema for creating new todos (inherits from TodoBase)
class TodoCreate(TodoBase):
    pass

# Todo schema for updating existing todos
class TodoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    completed: Optional[bool] = None

# Todo schema for API responses (includes id and timestamps)
class Todo(TodoBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True  # Allows conversion from SQLAlchemy models

