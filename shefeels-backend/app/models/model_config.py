from sqlalchemy import Column, Integer, String, Text, Enum
from sqlalchemy.sql import func
from sqlalchemy.types import DateTime
from app.models.base import Base
import enum


# ──────────────────────────────
# Chat Model Definitions
# ──────────────────────────────
class ModelType(str, enum.Enum):
    STANDARD = "standard"
    PREMIUM = "premium"

class ChatTone(str, enum.Enum):
    STANDARD = "Standard"
    NSFW = "NSFW"
    ULTRA_NSFW = "Ultra-NSFW"

class ChatModel(Base):
    __tablename__ = "chat_model"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    model_type = Column(Enum(ModelType, name="chat_model_type", values_callable=lambda x: [e.value for e in x]), nullable=False)
    endpoint_id = Column(String, nullable=False)

    chat_tone = Column(Enum(ChatTone, name="chat_tone_enum", values_callable=lambda x: [e.value for e in x]), nullable=False)

    prompt_standard = Column(Text, nullable=True)
    prompt_nsfw = Column(Text, nullable=True)
    prompt_ultra_nsfw = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


# ──────────────────────────────
# Image Model Definitions
# ──────────────────────────────
class ImageModelType(str, enum.Enum):
    TEXT_TO_IMAGE = "text-to-image"
    IMAGE_TO_IMAGE = "image-to-image"

class ImageModel(Base):
    __tablename__ = "image_model"

    id = Column(Integer, primary_key=True, index=True)
    model_type = Column(Enum(ImageModelType, name="image_model_type_enum", values_callable=lambda x: [e.value for e in x]), nullable=False)
    endpoint_id = Column(String, nullable=False)
    prompt = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

# ──────────────────────────────
# Speech Model Definitions
# ──────────────────────────────

class SpeechModelType(str, enum.Enum):
    TEXT_TO_SPEECH = "text-to-speech"
    SPEECH_TO_TEXT = "speech-to-text"

class SpeechModel(Base):
    __tablename__ = "speech_model"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    model_type = Column(Enum(SpeechModelType, name="speech_model_type_enum", values_callable=lambda x: [e.value for e in x]), nullable=False)
    endpoint_id = Column(String, nullable=False)
    prompt = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
