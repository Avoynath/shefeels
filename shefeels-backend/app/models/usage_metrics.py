"""
UsageMetrics SQLAlchemy model.
"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from app.models.base import Base
import datetime

class UsageMetrics(Base):
    __tablename__ = "usage_metrics"
    id = Column(Integer, primary_key=True, index=True)
    # user and character ids are stored as 32-char strings (uuid4 hex) in other models
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False)
    character_id = Column(String(32), ForeignKey("characters.id"), nullable=False)
    tokens_input = Column(Integer, default=0)
    tokens_output = Column(Integer, default=0)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
