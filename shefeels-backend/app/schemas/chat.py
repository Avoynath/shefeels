"""
Pydantic schemas for Chat and Message.
"""
from pydantic import BaseModel
from typing import Optional, Union, Dict, Any
from enum import Enum

class ChatCreate(BaseModel):
    session_id: str
    character_id: str
    user_query: str
    client_timestamp: Optional[str] = None

class MessageCreate(BaseModel):
    content: str
    is_voice: bool = False

class MessageRead(BaseModel):
    id: str
    session_id: str
    character_id: str
    user_query: str
    ai_message: str
    transcription: Optional[str] = None  # STT transcription of voice message
    context_window: Optional[int] = None
    is_media_available: Optional[bool] = None
    media_type: Optional[str] = None
    # s3_url_media historically could be a single S3 key/URL (string)
    # or, for voice messages, a dict with input/output keys (input_url/output_url).
    # Allow either shape to avoid validation errors when returning mixed payloads.
    s3_url_media: Optional[Union[str, Dict[str, Any]]] = None
    created_at: str

    class Config:
        from_attributes = True