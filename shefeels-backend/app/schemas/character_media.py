"""
Pydantic schemas for Image and Video.
"""
from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime

class ImageCreate(BaseModel):
    character_id: Optional[str] = None
    name: Optional[str] = None
    outfit: Optional[str] = None
    pose: Optional[str] = None
    action: Optional[str] = None
    accessories: Optional[str] = None
    prompt: Optional[str] = None
    num_images: int
    image_s3_url: Optional[str] = None

class ImageResponse(BaseModel):
    image_url: str
    created_at: datetime

class VideoCreate(BaseModel):
    character_id: str
    name: str
    prompt: Optional[str] = None
    duration: int
    negative_prompt: Optional[str] = None
    pose: Optional[str] = None
    background: Optional[str] = None
    outfit: Optional[str] = None
    video_effect: Optional[str] = None
    image_s3_url: str

class VideoResponse(BaseModel):
    video_url: str
    created_at: datetime