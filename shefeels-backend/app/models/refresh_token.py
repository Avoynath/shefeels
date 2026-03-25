from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, INET
from sqlalchemy.sql import func
import uuid
from app.models.base import Base
from app.services.app_config import generate_id

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id = Column(String(32), primary_key=True, default=generate_id)
    user_id = Column(String(32), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String, nullable=False)
    user_agent = Column(String)
    ip_address = Column(INET)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)