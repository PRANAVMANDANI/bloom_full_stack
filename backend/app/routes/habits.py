"""Habit tracking routes: CRUD for habits."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from datetime import datetime, timezone
from bson import ObjectId

from app.database import get_database
from app.rate_limit import limiter
from app.auth.dependencies import get_current_user
from app.models.habit import HabitCreate, HabitOut

router = APIRouter(prefix="/api/habits", tags=["Habits"])


def habit_doc_to_out(doc: dict, sobriety_days: int = 0) -> HabitOut:
    """Convert a MongoDB habit document to HabitOut."""
    return HabitOut(
        id=str(doc["_id"]),
        user_id=str(doc["user_id"]),
        name=doc["name"],
        type=doc["type"],
        start_date=doc["start_date"],
        sobriety_days=sobriety_days,
    )


async def compute_sobriety_days(db, habit_doc: dict) -> int:
    """Compute sobriety days: days since start_date, or since the last logged relapse.

    Only urge logs explicitly tagged "relapse" (created by the relapse endpoint)
    reset the counter — resisting a strong urge should never be penalized.
    """
    start = habit_doc["start_date"]
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)

    now = datetime.now(timezone.utc)
    total_days = (now - start).days

    last_relapse = await db.urge_logs.find_one(
        {
            "habit_id": str(habit_doc["_id"]),
            "trigger_tags": "relapse",
        },
        sort=[("timestamp", -1)],
    )

    if last_relapse:
        relapse_time = last_relapse["timestamp"]
        if relapse_time.tzinfo is None:
            relapse_time = relapse_time.replace(tzinfo=timezone.utc)
        days_since_relapse = (now - relapse_time).days
        return max(0, days_since_relapse)

    return max(0, total_days)


@router.get("", response_model=list[HabitOut])
async def get_habits(user: dict = Depends(get_current_user)):
    """Get all tracked habits for the current user."""
    db = get_database()
    cursor = db.habits.find({"user_id": user["_id"]})
    habits = []
    async for doc in cursor:
        sobriety = await compute_sobriety_days(db, doc)
        habits.append(habit_doc_to_out(doc, sobriety))
    return habits


@router.post("", response_model=HabitOut, status_code=status.HTTP_201_CREATED)
async def create_habit(habit_data: HabitCreate, user: dict = Depends(get_current_user)):
    """Create a new habit to track."""
    db = get_database()
    doc = {
        "user_id": user["_id"],
        "name": habit_data.name,
        "type": habit_data.type,
        "start_date": datetime.now(timezone.utc),
    }
    result = await db.habits.insert_one(doc)
    doc["_id"] = result.inserted_id
    return habit_doc_to_out(doc, sobriety_days=0)


@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_habit(habit_id: str, user: dict = Depends(get_current_user)):
    """Delete a habit and its associated urge logs."""
    db = get_database()
    result = await db.habits.delete_one({"_id": ObjectId(habit_id), "user_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Habit not found")
    # Also delete associated urge logs
    await db.urge_logs.delete_many({"habit_id": habit_id})


@router.post("/{habit_id}/relapse")
@limiter.limit("10/hour")
async def log_habit_relapse(
    request: Request,
    habit_id: str,
    user: dict = Depends(get_current_user),
):
    """Log a habit relapse: resets sobriety count and returns AI-generated support message."""
    from app.services.llm_client import generate_relapse_encouragement

    db = get_database()
    habit = await db.habits.find_one({"_id": ObjectId(habit_id), "user_id": user["_id"]})
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")

    # 1. Create a high-intensity urge log (intensity 10) to act as a relapse indicator
    now = datetime.now(timezone.utc)
    relapse_log = {
        "user_id": user["_id"],
        "habit_id": habit_id,
        "timestamp": now,
        "intensity": 10,
        "trigger_tags": ["relapse"],
        "notes": "Relapse logged by user.",
    }
    await db.urge_logs.insert_one(relapse_log)

    # 2. Call LLM prompt to generate empathetic guilt-relieving recovery message
    ai_message = await generate_relapse_encouragement(user["_id"], habit["name"], db)

    # 3. Calculate updated sobriety (will be 0)
    sobriety = await compute_sobriety_days(db, habit)

    return {
        "message": ai_message,
        "habit": habit_doc_to_out(habit, sobriety),
    }
