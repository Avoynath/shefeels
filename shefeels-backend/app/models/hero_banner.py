"""
Hero Banner SQLAlchemy model for managing hero section banners.
"""

from sqlalchemy import Column, String, Text, DateTime, Boolean, Enum
from sqlalchemy.sql import func
import enum
from app.models.base import Base
from app.services.app_config import generate_id


class BannerCategoryEnum(str, enum.Enum):
    DEFAULT = "default"
    MALE = "male"
    FEMALE = "female"
    TRANS = "trans"
    MIDDLE = "middle"
    MIDDLE_DEFAULT = "middle_default"
    MIDDLE_MALE = "middle_male"
    MIDDLE_FEMALE = "middle_female"
    MIDDLE_TRANS = "middle_trans"


class HeroBanner(Base):
    """Model for hero section banners with category-specific images and text."""

    __tablename__ = "hero_banners"

    id = Column(String(32), primary_key=True, default=generate_id)
    category = Column(
        Enum(BannerCategoryEnum, name="banner_category_enum", create_constraint=True),
        nullable=False,
        unique=True,
    )
    image_url = Column(Text, nullable=False)
    mobile_image_url = Column(Text, nullable=True)
    heading = Column(Text, nullable=False)
    subheading = Column(Text, nullable=True)
    cta_text = Column(String(255), nullable=True)  # Call-to-action button text
    cta_link = Column(String(500), nullable=True)  # Call-to-action button link
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def __repr__(self):
        return f"<HeroBanner(id={self.id}, category={self.category}, is_active={self.is_active})>"
