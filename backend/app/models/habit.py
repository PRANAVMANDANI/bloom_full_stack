"""Habit and urge log models for addiction tracking."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class HabitCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    type: str = Field(default="quit", pattern="^(quit|reduce|build)$")


class HabitOut(BaseModel):
    id: str
    user_id: str
    name: str
    type: str
    start_date: datetime
    sobriety_days: int = 0


class UrgeLogCreate(BaseModel):
    habit_id: str
    intensity: int = Field(..., ge=1, le=10)
    trigger_tags: list[str] = []
    notes: Optional[str] = None


class UrgeLogOut(BaseModel):
    id: str
    user_id: str
    habit_id: str
    timestamp: datetime
    intensity: int
    trigger_tags: list[str] = []
    notes: Optional[str] = None
