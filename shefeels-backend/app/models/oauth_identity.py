from sqlalchemy import Column, String, Integer, ForeignKey, Text
from app.models.base import Base
from app.services.app_config import generate_id

class OAuthIdentity(Base):
    __tablename__ = "oauth_identities"
    id = Column(String(32), primary_key=True, default=generate_id)
    user_id = Column(String(32), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider = Column(String, nullable=False)
    provider_user_id = Column(String, nullable=False)
    email = Column(String)
    full_name = Column(String)
    avatar_url = Column(String)