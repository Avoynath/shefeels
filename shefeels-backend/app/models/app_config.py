from sqlalchemy import Column, Integer, String, Text, Enum, DateTime
from sqlalchemy.sql import func
from app.models.base import Base
import enum



class AppConfig(Base):
    __tablename__ = "app_config"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    category = Column(Text, nullable=False)
    parameter_name = Column(String, unique=True, nullable=False)
    parameter_value = Column(Text, nullable=False)
    parameter_description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    def as_dict(self):
        """Convert the model instance to a dictionary"""
        return {
            'id': self.id,
            'category': self.category.value if self.category else None,
            'parameter_name': self.parameter_name,
            'parameter_value': self.parameter_value,
            'parameter_description': self.parameter_description,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
