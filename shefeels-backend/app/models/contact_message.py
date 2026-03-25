from sqlalchemy import Column, String, DateTime, Text, func
from app.models.base import Base
from app.services.app_config import generate_id


class ContactMessage(Base):
    __tablename__ = "contact_messages"
    id = Column(String(32), primary_key=True, default=generate_id)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    interest = Column(String(128))
    subject = Column(String(255))
    message = Column(Text, nullable=False)
    status = Column(String(32), nullable=False, server_default="pending")
    admin_notes = Column(Text)
    resolved_by = Column(String(32))
    resolved_at = Column(DateTime(timezone=True))
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
