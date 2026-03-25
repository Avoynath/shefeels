"""
Pydantic schemas for Hero Banner management.
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class HeroBannerBase(BaseModel):
    """Base schema for hero banner."""

    category: Literal["default", "male", "female", "trans", "middle", "middle_default", "middle_male", "middle_female", "middle_trans"]
    heading: str = Field(..., max_length=500)
    subheading: Optional[str] = Field(None, max_length=1000)
    cta_text: Optional[str] = Field(None, max_length=255)
    cta_link: Optional[str] = Field(None, max_length=500)
    is_active: bool = True


class HeroBannerCreate(HeroBannerBase):
    """Schema for creating a hero banner."""

    image_url: str = Field(..., description="S3 URL of the banner image")
    mobile_image_url: Optional[str] = Field(
        None, description="Optional S3 URL for mobile-specific banner image"
    )


class HeroBannerUpdate(BaseModel):
    """Schema for updating a hero banner (all fields optional)."""

    heading: Optional[str] = Field(None, max_length=500)
    subheading: Optional[str] = Field(None, max_length=1000)
    cta_text: Optional[str] = Field(None, max_length=255)
    cta_link: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None
    image_url: Optional[str] = Field(None, description="S3 URL of the banner image")
    mobile_image_url: Optional[str] = Field(
        None, description="Optional S3 URL for mobile-specific banner image"
    )


class HeroBannerRead(HeroBannerBase):
    """Schema for reading a hero banner."""

    id: str
    image_url: str
    mobile_image_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class HeroBannerPublic(BaseModel):
    """Public schema for hero banner (no admin fields)."""

    category: str
    image_url: str
    mobile_image_url: Optional[str] = None
    heading: str
    subheading: Optional[str] = None
    cta_text: Optional[str] = None
    cta_link: Optional[str] = None

    class Config:
        from_attributes = True
