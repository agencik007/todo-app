"""
Group model - SQLAlchemy model for groups table.
"""

import enum
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from config.database import Base


class GroupColor(str, enum.Enum):
    """Predefiniowane kolory dla grup - spójne z paletą UI."""

    BLUE = "blue"  # #3B82F6 - Niebieski
    GREEN = "green"  # #10B981 - Zielony
    RED = "red"  # #EF4444 - Czerwony
    YELLOW = "yellow"  # #F59E0B - Żółty
    PURPLE = "purple"  # #8B5CF6 - Fioletowy
    PINK = "pink"  # #EC4899 - Różowy
    ORANGE = "orange"  # #F97316 - Pomarańczowy
    TEAL = "teal"  # #14B8A6 - Turkusowy
    INDIGO = "indigo"  # #6366F1 - Indygo
    GRAY = "gray"  # #6B7280 - Szary


class Group(Base):
    """Group model for organizing todos."""

    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    color = Column(Enum(GroupColor), nullable=False, default=GroupColor.BLUE)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    owner = relationship("User", back_populates="groups")
    todos = relationship("Todo", back_populates="group")

    def __repr__(self) -> str:
        return f"<Group(id={self.id}, name={self.name[:20]}...)>"
