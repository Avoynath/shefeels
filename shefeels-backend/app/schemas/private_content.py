"""
Pydantic schemas for private content.
"""
from pydantic import BaseModel
from typing import Optional
from enum import Enum

class PrivateContentRequest(BaseModel):
    character_id: str
class PrivateContentListRequest(BaseModel):
    character_ids: list[str]
class MediaPackRequest(BaseModel):
    pack_id: str
class MediaPackUnlockRequest(BaseModel):
    pack_id: str
    coin : int
    character_id: str
class ListMediaIdLike(BaseModel):
    media_ids: list[str]

class MediaIdLike(BaseModel):
    id: str

class PrivateContentPackCreateRequest(BaseModel):
    character_id: str
    pack_name: str
    pack_description: Optional[str] = None
    tokens: int
    is_active: Optional[bool] = True
    thumbnail_image_id: Optional[str] = None
    list_media_ids: Optional[list[str]] = []