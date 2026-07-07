"""Mood log routes for daily check-ins."""

from fastapi import APIRouter, Depends, Query
from datetime import datetime, timezone
from typing import Optional

from app.database import get_database
from app.auth.dependencies import get_current_user
from app.models.mood_log import MoodLogCreate, MoodLogOut

router = APIRouter(prefix="/api/mood-logs", tags=["Mood Logs"])


@router.post("", response_model=MoodLogOut, status_code=201)
async def create_mood_log(log_data: MoodLogCreate, user: dict = Depends(get_current_user)):
    """Create a mood check-in entry."""
    db = get_database()
    doc = {
        "user_id": user["_id"],
        "timestamp": datetime.now(timezone.utc),
        "mood_score": log_data.mood_score,
        "tags": log_data.tags,
        "notes": log_data.notes,
    }
    result = await db.mood_logs.insert_one(doc)
    doc["_id"] = result.inserted_id

    return MoodLogOut(
        id=str(doc["_id"]),
        user_id=str(doc["user_id"]),
        timestamp=doc["timestamp"],
        mood_score=doc["mood_score"],
        tags=doc["tags"],
        notes=doc["notes"],
    )


@router.get("", response_model=list[MoodLogOut])
async def get_mood_logs(
    limit: int = Query(30, le=200),
    user: dict = Depends(get_current_user),
):
    """Get mood logs for the current user, most recent first."""
    db = get_database()
    cursor = db.mood_logs.find({"user_id": user["_id"]}).sort("timestamp", -1).limit(limit)
    logs = []
    async for doc in cursor:
        logs.append(
            MoodLogOut(
                id=str(doc["_id"]),
                user_id=str(doc["user_id"]),
                timestamp=doc["timestamp"],
                mood_score=doc["mood_score"],
                tags=doc.get("tags", []),
                notes=doc.get("notes"),
            )
        )
    return logs
