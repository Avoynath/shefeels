"""
User SQLAlchemy model.
"""

import enum as python_enum
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    Text,
    Enum,
    Date,
    ForeignKey,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base
from app.services.app_config import generate_id

import enum
from sqlalchemy.dialects.postgresql import ENUM

class RoleEnum(str, enum.Enum):
    USER = "user"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"

role_type = ENUM(
    RoleEnum,
    name="role_enum",
    values_callable=lambda enum_cls: [e.value for e in enum_cls],  # <-- key line
    create_type=False,  # important if the enum type already exists in DB
)


class User(Base):
    __tablename__ = "users"
    # use string IDs (32-char hex) to match most other models which reference users.id
    id = Column(String(32), primary_key=True, index=True, default=generate_id)
    email = Column(Text, unique=True, nullable=False)
    hashed_password = Column(Text, nullable=True)  # nullable for SSO
    full_name = Column(Text, nullable=True)
    role = Column(
        role_type,
        nullable=False,
        default=RoleEnum.USER.value,
    )
    is_active = Column(Boolean, default=True, nullable=False)
    is_email_verified = Column(Boolean, default=False, nullable=False)
    has_active_subscription = Column(Boolean, default=False, nullable=False)
    payment_customer_id = Column(String, nullable=True)
    tagada_customer_id = Column(String(50), nullable=True)  # TagadaPay customer ID
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # user relations
    activation_tokens = relationship(
        "UserActivation", back_populates="user", cascade="all, delete-orphan"
    )
    # wallet and coin relations
    coin_transactions = relationship("CoinTransaction", back_populates="user")
    # CharacterMedia relation (separate from generic Media table)
    character_media = relationship(
        "CharacterMedia",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    
    # AI generation logs relation
    ai_generation_logs = relationship(
        "AiGenerationLog",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    # one-to-one profile relation
    profile = relationship("UserProfile", back_populates="user", uselist=False)
    order = relationship("Order", back_populates="user")
    user_wallet = relationship("UserWallet", back_populates="user")
    subscription = relationship("Subscription", back_populates="user")
    # media packs created by this user
    created_media_packs = relationship(
        "MediaPack",
        back_populates="creator",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class UserProfile(Base):
    __tablename__ = "user_profiles"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(
        String(32),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    full_name = Column(Text, nullable=True)
    email_id = Column(Text, nullable=True)
    username = Column(String(150), nullable=True, unique=False)
    gender = Column(String(32), nullable=True)
    birth_date = Column(Date, nullable=True)
    profile_image_url = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    user = relationship("User", back_populates="profile")


class UserActivation(Base):
    __tablename__ = "user_activations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(
        String(32), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash = Column(String, nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at = Column(DateTime(timezone=True), nullable=False)
    consumed_at = Column(DateTime(timezone=True))

    user = relationship("User", back_populates="activation_tokens")
