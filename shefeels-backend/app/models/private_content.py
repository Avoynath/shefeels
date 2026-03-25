from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Numeric, BigInteger, CheckConstraint, CHAR, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from app.models.base import Base
from sqlalchemy.sql import func

from app.services.app_config import generate_id


class MediaPack(Base):
    __tablename__ = "media_packs"

    id = Column(String(32), primary_key=True, default=generate_id)
    character_id = Column(String(32), ForeignKey("characters.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(String(32), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    price_tokens = Column(Integer, nullable=False, default=100)  # cost to unlock
    num_images = Column(Integer, nullable=False, default=0)
    num_videos = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, default=True)
    thumbnail_s3_path = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    character = relationship("Character", back_populates="media_packs")
    creator = relationship("User", back_populates="created_media_packs")
    media_items = relationship("MediaPackMedia", back_populates="pack", cascade="all, delete-orphan")


class MediaPackMedia(Base):
    __tablename__ = "media_pack_media"

    id = Column(String(32), primary_key=True, default=generate_id)
    media_pack_id = Column(String(32), ForeignKey("media_packs.id", ondelete="CASCADE"), nullable=False)
    character_media_id = Column(String(32), ForeignKey("character_media.id", ondelete="CASCADE"), nullable=False)

    pack = relationship("MediaPack", back_populates="media_items")
    media = relationship("CharacterMedia")

class UserMediaPackAccess(Base):
    __tablename__ = "user_media_pack_access"

    id = Column(String(32), primary_key=True, default=generate_id)
    user_id = Column(String(32), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    media_pack_id = Column(String(32), ForeignKey("media_packs.id", ondelete="CASCADE"), nullable=False)
    unlocked_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    __table_args__ = (UniqueConstraint('user_id', 'media_pack_id', name='_user_pack_unique'),)


class CharacterMediaLike(Base):
    __tablename__ = "character_media_likes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    character_media_id = Column(String(32))
    user_id = Column(String(32), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    liked_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (UniqueConstraint('character_media_id', 'user_id', name='_user_media_like_unique'),)
