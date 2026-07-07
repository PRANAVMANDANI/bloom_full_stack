"""Mood log models for daily check-ins."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class MoodLogCreate(BaseModel):
    mood_score: int = Field(..., ge=1, le=10)
    tags: list[str] = []
    notes: Optional[str] = None


class MoodLogOut(BaseModel):
    id: str
    user_id: str
    timestamp: datetime
    mood_score: int
    tags: list[str] = []
    notes: Optional[str] = None
