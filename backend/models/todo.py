"""
Todo model - SQLAlchemy model for todos table.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from config.database import Base


class Todo(Base):
    """Todo model for task management."""

    __tablename__ = "todos"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    completed = Column(Boolean, default=False)
    index = Column(Integer, default=0, nullable=False)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    group_id = Column(
        Integer, ForeignKey("groups.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    owner = relationship("User", back_populates="todos")
    group = relationship("Group", back_populates="todos")

    def __repr__(self) -> str:
        return f"<Todo(id={self.id}, title={self.title[:20]}...)>"
