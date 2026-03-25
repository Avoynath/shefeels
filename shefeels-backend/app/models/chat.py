"""
Chat message model (sessions and messages merged).
"""
import enum
import json
from sqlalchemy import (
    Boolean,
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Enum as PgEnum,
    ForeignKey,
    Index,
)
from sqlalchemy.sql import func
from sqlalchemy.types import TypeDecorator, Text as TextType
from app.models.base import Base
from app.services.app_config import generate_id


class JSONEncodedDict(TypeDecorator):
    """Stores dict as JSON string in text column."""
    impl = TextType
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            value = json.dumps(value)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            try:
                value = json.loads(value)
            except (json.JSONDecodeError, TypeError):
                # If it's a plain string (legacy data), return as-is
                pass
        return value

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(String(32), primary_key=True, default=generate_id)
    session_id = Column(String(64),nullable=False,index=True)
    user_id = Column(String(32),ForeignKey("users.id"),nullable=False,index=True)
    character_id = Column(String(32),ForeignKey("characters.id", ondelete="CASCADE"),nullable=False,index=True)
    user_query = Column(Text, nullable=False)
    ai_message = Column(Text, nullable=True)
    # Optional debug column to store raw LLM/AI text for ops (not shown to users)
    debug_ai_message = Column(Text, nullable=True)
    # Transcription of voice message (STT result from ElevenLabs)
    transcription = Column(Text, nullable=True)
    context_window = Column(Integer, nullable=True)  # in seconds
    is_media_available = Column(Boolean, default=False)
    media_type = Column(String(250), nullable=True)  # e.g., 'image', 'video', 'voice'
    s3_url_media = Column(JSONEncodedDict, nullable=True)  # For voice: {"input_url": "...", "output_url": "..."}, for others: string URL
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)