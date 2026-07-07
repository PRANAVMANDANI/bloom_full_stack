"""Goal models for daily goals and streak tracking."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date


class GoalCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    frequency: str = Field(default="daily", pattern="^(daily|weekly)$")


class GoalUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    frequency: Optional[str] = Field(None, pattern="^(daily|weekly)$")


class GoalOut(BaseModel):
    id: str
    user_id: str
    title: str
    frequency: str
    streak: int = 0
    completed_dates: list[str] = []
    frozen_dates: list[str] = []
    freezes_remaining: int = 0
    created_at: datetime
    completed_today: bool = False


class ToggleDatePayload(BaseModel):
    date: str = Field(..., description="Date string in YYYY-MM-DD format")
