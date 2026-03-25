from sqlalchemy import Column, String, ForeignKey, DateTime, Text, Integer
from sqlalchemy.orm import relationship
from app.models.base import Base
import datetime
from app.services.app_config import generate_id
class CharacterMedia(Base):
    __tablename__ = "character_media"
    id = Column(String(32), primary_key=True, default=generate_id)
    # Allow NULL for character_id for text-only / generated images without a specific character
    character_id = Column(String(32), ForeignKey("characters.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(String(32), ForeignKey("users.id", ondelete="CASCADE"))
    media_type = Column(String, nullable=False, default="image")
    s3_path = Column(Text, unique=True, nullable=False)  # e.g. u/123e.../4567.webp
    mime_type = Column(String, nullable=False, default="image/webp")
    pose = Column(String, nullable=True)  # pose used for generation (video/image)
    settings = Column(Text, nullable=True)  # JSON settings used for generation
    # Use a callable for the default so the timestamp is evaluated per-row at insert time
    # instead of being evaluated once at module-import time.
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.timezone.utc), nullable=False)

    # Relationships (optional, for ORM navigation)
    character = relationship(
        "Character",
        back_populates="character_media"
    )
    user = relationship(
        "User",
        back_populates="character_media",
        passive_deletes=True,
    )


