"""
Schemas for background image generation jobs.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel


class ImageJobStatus(str, Enum):
    queued = "queued"
    generating = "generating"
    completed = "completed"
    failed = "failed"


class ImageJob(BaseModel):
    job_id: str
    user_id: str
    status: ImageJobStatus
    created_at: datetime
    updated_at: datetime
    image_s3_key: Optional[str] = None
    image_url: Optional[str] = None
    error: Optional[str] = None
    message_id: Optional[str] = None
    character_id: Optional[str] = None

    class Config:
        use_enum_values = True


class ImageJobStatusResponse(BaseModel):
    job_id: str
    status: ImageJobStatus
    image_url: Optional[str] = None
    error: Optional[str] = None

    class Config:
        use_enum_values = True
