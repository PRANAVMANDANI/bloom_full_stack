"""Chat message models for the support chatbot."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ChatMessageOut(BaseModel):
    id: str
    user_id: str
    session_id: str
    role: str  # "user", "assistant", "system"
    text: str
    timestamp: datetime


class ChatMessageCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    session_id: Optional[str] = None
