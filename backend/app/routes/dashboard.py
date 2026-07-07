"""Dashboard route: aggregated data for the main dashboard view."""

from fastapi import APIRouter, Depends
from datetime import datetime, timezone, date, timedelta

from app.database import get_database
from app.auth.dependencies import get_current_user
from app.routes.goals import goal_doc_to_out

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("")
async def get_dashboard(user: dict = Depends(get_current_user)):
    """Get aggregated dashboard data: today's goals, streaks, mood trend, insights."""
    db = get_database()
    user_id = user["_id"]
    today_str = date.today().isoformat()

    # 1. Today's goals
    goals_cursor = db.goals.find({"user_id": user_id})
    goals = []
    async for doc in goals_cursor:
        goals.append(goal_doc_to_out(doc))

    # 2. Active habits with sobriety counts
    from app.routes.habits import compute_sobriety_days, habit_doc_to_out
    habits_cursor = db.habits.find({"user_id": user_id})
    habits = []
    async for doc in habits_cursor:
        sobriety = await compute_sobriety_days(db, doc)
        habits.append(habit_doc_to_out(doc, sobriety))

    # 3. Mood trend (last 14 days)
    fourteen_days_ago = datetime.now(timezone.utc) - timedelta(days=14)
    mood_cursor = (
        db.mood_logs.find({"user_id": user_id, "timestamp": {"$gte": fourteen_days_ago}})
        .sort("timestamp", 1)
    )
    mood_trend = []
    async for doc in mood_cursor:
        mood_trend.append({
            "date": doc["timestamp"].strftime("%m/%d"),
            "score": doc["mood_score"],
        })

    # 4. Latest insights (up to 5)
    insights_cursor = db.insights.find({"user_id": user_id}).sort("generated_at", -1).limit(5)
    insights = []
    async for doc in insights_cursor:
        insights.append({
            "id": str(doc["_id"]),
            "type": doc["type"],
            "message": doc["message"],
            "generated_at": doc["generated_at"].isoformat(),
        })

    # 5. Today's stats
    today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)
    today_mood = await db.mood_logs.find_one(
        {"user_id": user_id, "timestamp": {"$gte": today_start}},
        sort=[("timestamp", -1)],
    )
    today_journal = await db.journal_entries.count_documents(
        {"user_id": user_id, "timestamp": {"$gte": today_start}}
    )

    return {
        "goals": [g.model_dump() for g in goals],
        "habits": [h.model_dump() for h in habits],
        "mood_trend": mood_trend,
        "insights": insights,
        "today_stats": {
            "goals_completed": sum(1 for g in goals if g.completed_today),
            "goals_total": len(goals),
            "mood_logged": today_mood is not None,
            "current_mood": today_mood["mood_score"] if today_mood else None,
            "journal_entries_today": today_journal,
        },
    }
