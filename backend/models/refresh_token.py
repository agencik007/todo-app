"""
RefreshToken model - SQLAlchemy model for server-side refresh token tracking.
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from config.database import Base


class RefreshToken(Base):
    """
    Server-side record of an issued refresh token.

    Enables real logout (revoking a session instead of just clearing the
    cookie) and reuse detection: rotated-away tokens are kept (marked
    revoked) rather than deleted, so if one is presented again - which can
    only happen if it was stolen and used by two parties - the whole
    rotation family can be revoked, forcing re-authentication.
    """

    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash = Column(String, unique=True, nullable=False, index=True)
    family_id = Column(String, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="refresh_tokens")

    def __repr__(self) -> str:
        return f"<RefreshToken(id={self.id}, user_id={self.user_id})>"
