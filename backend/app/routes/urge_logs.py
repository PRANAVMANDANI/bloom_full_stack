"""Urge log routes for addiction tracking."""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from datetime import datetime, timezone
from bson import ObjectId
from typing import Optional

from app.database import get_database
from app.rate_limit import limiter
from app.auth.dependencies import get_current_user
from app.models.habit import UrgeLogCreate, UrgeLogOut

router = APIRouter(prefix="/api/urge-logs", tags=["Urge Logs"])


@router.post("", status_code=201)
@limiter.limit("20/hour")
async def create_urge_log(request: Request, log_data: UrgeLogCreate, user: dict = Depends(get_current_user)):
    """Log an urge with intensity, triggers, and notes.

    Returns the created log plus an AI-generated message with quick distraction
    techniques and motivation, tailored to the intensity/trigger reported.
    """
    from app.services.llm_client import generate_urge_coping_suggestions

    db = get_database()

    # Verify the habit belongs to the user
    habit = await db.habits.find_one({"_id": ObjectId(log_data.habit_id), "user_id": user["_id"]})
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")

    doc = {
        "user_id": user["_id"],
        "habit_id": log_data.habit_id,
        "timestamp": datetime.now(timezone.utc),
        "intensity": log_data.intensity,
        "trigger_tags": log_data.trigger_tags,
        "notes": log_data.notes,
    }
    result = await db.urge_logs.insert_one(doc)
    doc["_id"] = result.inserted_id

    urge_log_out = UrgeLogOut(
        id=str(doc["_id"]),
        user_id=str(doc["user_id"]),
        habit_id=doc["habit_id"],
        timestamp=doc["timestamp"],
        intensity=doc["intensity"],
        trigger_tags=doc["trigger_tags"],
        notes=doc["notes"],
    )

    coping_message = await generate_urge_coping_suggestions(
        habit_name=habit["name"],
        intensity=log_data.intensity,
        trigger_tags=log_data.trigger_tags,
        notes=log_data.notes,
    )

    return {"urge_log": urge_log_out, "message": coping_message}


@router.get("", response_model=list[UrgeLogOut])
async def get_urge_logs(
    habit_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    user: dict = Depends(get_current_user),
):
    """Get urge logs, optionally filtered by habit."""
    db = get_database()
    query = {"user_id": user["_id"]}
    if habit_id:
        query["habit_id"] = habit_id

    cursor = db.urge_logs.find(query).sort("timestamp", -1).limit(limit)
    logs = []
    async for doc in cursor:
        logs.append(
            UrgeLogOut(
                id=str(doc["_id"]),
                user_id=str(doc["user_id"]),
                habit_id=doc["habit_id"],
                timestamp=doc["timestamp"],
                intensity=doc["intensity"],
                trigger_tags=doc.get("trigger_tags", []),
                notes=doc.get("notes"),
            )
        )
    return logs
