"""
Pydantic schemas for Character.
"""

from pydantic import BaseModel
from typing import Optional, Literal, Union
from datetime import datetime


class CharacterBase(BaseModel):
    username: Optional[str] = None
    name: Optional[str] = None
    bio: Optional[str] = None
    hobbies: Optional[str] = None
    gender: str
    style: Optional[str] = None
    ethnicity: Optional[str] = None
    age: Optional[int] = None
    eye_colour: Optional[str] = None
    hair_style: Optional[str] = None
    hair_colour: Optional[str] = None
    body_type: Optional[str] = None
    breast_size: Optional[str] = None
    butt_size: Optional[str] = None
    dick_size: Optional[str] = None
    personality: Optional[str] = None
    voice_type: Optional[str] = None
    relationship_type: Optional[str] = None
    clothing: Optional[str] = None
    special_features: Optional[str] = None
    background: Optional[str] = None
    privacy: Optional[str] = None
    onlyfans_url: Optional[str] = None
    fanvue_url: Optional[str] = None
    tiktok_url: Optional[str] = None
    instagram_url: Optional[str] = None
    picture_shot_type: Optional[str] = None
    looking_for: Optional[str] = None


class CharacterCreate(CharacterBase):
    enhanced_prompt: Optional[bool]


class CharacterRead(CharacterBase):
    id: str
    user_id: str
    updated_at: datetime
    image_url_s3: Optional[str] = None
    webp_image_url_s3: Optional[str] = None
    gif_url_s3: Optional[str] = None
    animated_webp_url_s3: Optional[str] = None
    creator_role: Optional[str] = None
    # include user's email in responses
    email_id: Optional[str] = None
    # New voice and prompt fields
    prompt_enhanced: Optional[str] = None
    voice_prompt: Optional[str] = None
    generated_voice_id: Optional[str] = None
    looking_for: Optional[str] = None
    model_config = {
        "from_attributes": True,
    }


class CharacterIdIn(BaseModel):
    # Accept either numeric or string character IDs from the frontend.
    character_id: str


class CharacterEdit(BaseModel):
    character_id: str
    name: Optional[str] = None
    username: Optional[str] = None
    bio: Optional[str] = None
    gender: Optional[str] = None
    style: Optional[str] = None
    ethnicity: Optional[str] = None
    age: Optional[int] = None
    eye_colour: Optional[str] = None
    hair_style: Optional[str] = None
    hair_colour: Optional[str] = None
    body_type: Optional[str] = None
    breast_size: Optional[str] = None
    butt_size: Optional[str] = None
    dick_size: Optional[str] = None
    personality: Optional[str] = None
    voice_type: Optional[str] = None
    relationship_type: Optional[str] = None
    clothing: Optional[str] = None
    special_features: Optional[str] = None
    background: Optional[str] = None
    privacy: Optional[str] = None
    onlyfans_url: Optional[str] = None
    fanvue_url: Optional[str] = None
    tiktok_url: Optional[str] = None
    instagram_url: Optional[str] = None
