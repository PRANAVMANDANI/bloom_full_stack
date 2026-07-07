"""Journal entry models with sentiment analysis."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class JournalCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000)


class JournalOut(BaseModel):
    id: str
    user_id: str
    timestamp: datetime
    text: str
    sentiment_score: Optional[float] = None
