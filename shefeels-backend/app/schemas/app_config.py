from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from datetime import datetime

class AppConfigUpdateRequest(BaseModel):
    updates: Dict[str, Any] = Field(..., description="Key-value pairs of config fields to update.")

class AppConfigCreateRequest(BaseModel):
    # `ConfigCategory` enum was removed from the models; accept a string
    # here instead. If you want to enforce allowed values, replace `str`
    # with `Literal[...]` or reintroduce an Enum.
    category: str = Field(..., description="Configuration category")
    parameter_name: str = Field(..., description="Unique parameter name")
    parameter_value: str = Field(..., description="Parameter value")
    parameter_description: Optional[str] = Field(None, description="Optional parameter description")

class AppConfigEditRequest(BaseModel):
    parameter_value: Optional[str] = Field(None, description="New parameter value")
    parameter_description: Optional[str] = Field(None, description="New parameter description")

class AppConfigResponse(BaseModel):
    id: int
    category: str
    parameter_name: str
    parameter_value: str
    parameter_description: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class ChatModelUpdateRequest(BaseModel):
    # Accepts any fields that may be updated; for flexibility, use dict
    updates: dict