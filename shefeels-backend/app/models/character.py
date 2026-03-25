"""
Character SQLAlchemy model.
"""

from sqlalchemy import (
    Boolean,
    Column,
    Integer,
    String,
    ForeignKey,
    Enum,
    DateTime,
    Float,
    Text,
)
from sqlalchemy.orm import relationship
from app.models.base import Base
import enum
import datetime
from sqlalchemy.sql import func

from app.services.app_config import generate_id

# class GenderEnum(str, enum.Enum):
#     man = "man"
#     woman = "woman"
#     others = "others"


class Character(Base):
    __tablename__ = "characters"
    id = Column(String(32), primary_key=True, default=generate_id)
    username = Column(String(255), nullable=False)
    bio = Column(Text)
    hobbies = Column(String(512))
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    gender = Column(String(255), nullable=False, default="Girl")
    style = Column(String(255))
    ethnicity = Column(String(255))
    age = Column(Integer)
    eye_colour = Column(String(255))
    hair_style = Column(String(255))
    hair_colour = Column(String(255))
    body_type = Column(String(255))
    breast_size = Column(String(255))
    butt_size = Column(String(255))
    dick_size = Column(String(255))
    personality = Column(Text)
    voice_type = Column(String(255))
    relationship_type = Column(String(255))
    clothing = Column(String(255))
    special_features = Column(Text)
    background = Column(Text)
    looking_for = Column(String(255))
    prompt = Column(Text, nullable=False)
    prompt_enhanced = Column(Text)  # AI-enhanced prompt used for image generation
    voice_prompt = Column(Text)  # Voice description prompt for ElevenLabs
    generated_voice_id = Column(String(255))  # ElevenLabs voice ID
    image_url_s3 = Column(Text)  # Original PNG image
    webp_image_url_s3 = Column(Text)  # WebP version of character image
    gif_url_s3 = Column(Text)  # Animated GIF for hover (Now storing MP4)
    animated_webp_url_s3 = Column(Text)  # Animated WebP for hover
    video_prompt = Column(Text) # LLM generated prompt for video generation
    privacy = Column(String(255), default="private")
    onlyfans_url = Column(Text)
    fanvue_url = Column(Text)
    tiktok_url = Column(Text)
    instagram_url = Column(Text)
    created_at = Column(
        DateTime(timezone=True),
        default=datetime.datetime.now(datetime.timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # ORM relationships
    character_media = relationship(
        "CharacterMedia",
        back_populates="character",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    
    # AI generation logs relation
    ai_generation_logs = relationship(
        "AiGenerationLog",
        back_populates="character",
        cascade="all, delete-orphan"
    )
    
    # relationship for private content media packs attached to this character
    media_packs = relationship(
        "MediaPack",
        back_populates="character",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    # Character stats relationship
    character_stats = relationship(
        "CharacterStats",
        back_populates="character",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class CharacterStats(Base):
    __tablename__ = "character_stats"
    id = Column(String(32), primary_key=True, default=generate_id)
    character_id = Column(String(32), ForeignKey("characters.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False)
    liked = Column(Boolean, default=False)
    created_at = Column(
        DateTime(timezone=True),
        default=datetime.datetime.now(datetime.timezone.utc),
        nullable=False,
    )

    # Relationship back to Character
    character = relationship("Character", back_populates="character_stats")
