"""
Pydantic schemas for User and Auth.
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
import uuid
from app.models.user import RoleEnum


class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    role: RoleEnum = Field(default=RoleEnum.USER.value)


class UserCreate(UserBase):
    password: str


class UserRead(UserBase):
    # users.id is a 32-char hex string in the DB (generate_id)
    id: str
    full_name: Optional[str] = None
    role: str
    is_active: bool
    is_email_verified: bool
    total_revenue: Optional[float] = 0.0
    subscription_status: str = "free"
    has_active_subscription: bool = False
    coin_balance: int = 0
    country: Optional[str] = None
    city: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    # Pydantic v2: enable parsing from ORM / attribute objects
    model_config = {"from_attributes": True}


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordConfirm(BaseModel):
    email: EmailStr
    # uid is a string matching PasswordReset.id
    uid: str
    token: str  # the raw token from e-mail link
    new_password: str = Field(min_length=8)


# Pydantic schema for user edit
class UserEditRequest(BaseModel):
    full_name: str | None = None
    role: str | None = None
    is_active: bool | None = None


# Pydantic schema for admin user creation
class AdminUserCreateRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    role: RoleEnum = Field(default=RoleEnum.USER)


# Pydantic schema for user activation (REMOVED - activation is now handled by a GET request)


class SetPasswordRequest(BaseModel):
    uid: int
    token: str
    password: str = Field(..., min_length=8)


# Pydantic schema for profile upsert
class ProfileUpsertRequest(BaseModel):
    full_name: Optional[str] = None
    # support both `email` (common) and `email_id` (legacy) fields
    email: Optional[EmailStr] = None
    email_id: Optional[EmailStr] = None
    username: Optional[str] = Field(None, max_length=150)
    gender: Optional[str] = Field(None, max_length=32)
    birth_date: Optional[str] = None  # ISO date string YYYY-MM-DD
