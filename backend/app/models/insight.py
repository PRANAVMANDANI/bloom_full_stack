"""Insight models for the nightly insights engine."""

from pydantic import BaseModel
from datetime import datetime


class InsightOut(BaseModel):
    id: str
    user_id: str
    generated_at: datetime
    type: str  # "mood", "goals", "urges", "sentiment", "correlation", "general"
    message: str
