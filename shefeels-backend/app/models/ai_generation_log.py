from sqlalchemy import Column, String, ForeignKey, DateTime, Text, Integer, Boolean, ARRAY
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from app.models.base import Base
import datetime
from app.services.app_config import generate_id


class AiGenerationLog(Base):
    __tablename__ = "ai_generation_logs"

    id = Column(String(32), primary_key=True, default=generate_id)
    user_id = Column(String(32), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    character_id = Column(String(32), ForeignKey("characters.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Type of generation: 'image', 'video', 'voice', etc.
    generation_type = Column(String(50), nullable=False, default="image", index=True)
    
    # The actual prompt used for generation
    prompt_text = Column(Text, nullable=False)
    
    # Additional metadata in JSON format (e.g., settings, clothing, style, etc.)
    prompt_metadata = Column(JSONB, nullable=True)
    
    # AI model used (e.g., 'xl_pornai', 'xl_anime', etc.)
    ai_model = Column(String(100), nullable=True)
    
    # Generation parameters
    num_generations = Column(Integer, default=1)
    size_orientation = Column(String(50), nullable=True)
    
    # Initial image if it was an image-to-image generation
    initial_image_s3_key = Column(Text, nullable=True)
    
    # Generated content URLs and S3 keys (can be array for multiple generations)
    generated_content_urls = Column(ARRAY(Text), nullable=True)
    generated_s3_keys = Column(ARRAY(Text), nullable=True)
    
    # Status tracking
    status = Column(String(50), nullable=False, default="pending", index=True)  # pending, success, failed
    error_message = Column(Text, nullable=True)
    
    # Face swap tracking (if applicable)
    face_swap_applied = Column(Boolean, default=False)
    face_swap_source_s3_key = Column(Text, nullable=True)
    
    # Compliance/moderation flags
    is_compliant = Column(Boolean, default=True, index=True)
    moderation_notes = Column(Text, nullable=True)
    
    # Source context (where the generation was triggered from)
    source_context = Column(String(100), nullable=True)  # 'chat', 'character_creation', 'character_media', etc.
    
    # Timestamps
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        nullable=False,
        index=True
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        onupdate=lambda: datetime.datetime.now(datetime.timezone.utc),
        nullable=False
    )

    # Relationships
    user = relationship("User", back_populates="ai_generation_logs")
    character = relationship("Character", back_populates="ai_generation_logs")
