from pydantic import BaseModel
from typing import Dict, List, Any

class EngagementStats(BaseModel):
    total_messages: int
    total_sessions: int
    avg_messages_per_session: float
    messages_per_character: Dict[str, int]
    media_type_breakdown: Dict[str, int]
    role_breakdown: Dict[str, int]
    messages_over_time: List[Dict[str, Any]]  # [{"date": "YYYY-MM-DD", "count": int}]
    total_characters: int
    most_used_character: str
    prompt_usage_count: int
    common_traits: Dict[str, Dict[str, int]]  # {"gender": {...}, "style": {...}}