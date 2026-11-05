"""
Todo model - SQLAlchemy model for todos table.
"""

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    String,
    Time,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from config.database import Base


class Todo(Base):
    """Todo model for task management."""

    __tablename__ = "todos"
    # A client_id identifies a todo the client created (e.g. offline), so a
    # retried create returns the existing todo instead of a duplicate.
    __table_args__ = (
        UniqueConstraint("user_id", "client_id", name="uq_todos_user_client_id"),
        # The reminder worker scans only the reminders that are still to be sent.
        Index(
            "ix_todos_pending_reminders",
            "remind_at",
            postgresql_where=text("reminder_sent_at IS NULL"),
        ),
    )

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
    client_id = Column(String(36), nullable=True)
    # Optional deadline; a time is only allowed together with a date. Both are
    # wall-clock values (no timezone), shown as the user entered them.
    due_date = Column(Date, nullable=True)
    due_time = Column(Time, nullable=True)
    # Minutes before the due time to remind (see services/reminders.py); null =
    # no reminder. remind_at is derived server-side from the due pair, this
    # offset and the user's timezone; reminder_sent_at is never exposed.
    reminder_offset_minutes = Column(Integer, nullable=True)
    remind_at = Column(DateTime(timezone=True), nullable=True)
    reminder_sent_at = Column(DateTime(timezone=True), nullable=True)
    # float32 text embedding (services/embedder.py); never exposed by the API
    embedding = Column(LargeBinary, nullable=True)

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
