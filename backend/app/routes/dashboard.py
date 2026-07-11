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

    # 6. Sobriety state for the plant visual.
    # The plant resets every Monday, so we only consider relapses in the current
    # week (Mon 00:00 UTC -> now). A relapse "wilts" the plant, but 2 clean days
    # after the most recent relapse heal it back (re-bloom), so we treat a relapse
    # older than 2 days as recovered.
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    week_start = datetime.combine(monday, datetime.min.time()).replace(tzinfo=timezone.utc)
    last_relapse = await db.urge_logs.find_one(
        {"user_id": user_id, "trigger_tags": "relapse", "timestamp": {"$gte": week_start}},
        sort=[("timestamp", -1)],
    )
    relapsed_this_week = False
    if last_relapse:
        relapse_time = last_relapse["timestamp"]
        if relapse_time.tzinfo is None:
            relapse_time = relapse_time.replace(tzinfo=timezone.utc)
        # Wilted only until 2 clean days have passed since the last relapse.
        relapsed_this_week = (datetime.now(timezone.utc) - relapse_time) < timedelta(days=2)

    # 7. Weekly plant: one stalk segment per day, Monday -> today. Each segment
    # carries THAT day's goal-completion tier (shape) and sobriety (color), so a
    # full week builds a 7-level stalk with leaves/flowers at each day's level.
    relapse_days = set()
    async for r in db.urge_logs.find(
        {"user_id": user_id, "trigger_tags": "relapse", "timestamp": {"$gte": week_start}}
    ):
        ts = r["timestamp"]
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        relapse_days.add(ts.date().isoformat())

    def _goal_created_date(g):
        c = getattr(g, "created_at", None)
        if isinstance(c, datetime):
            return c.date()
        if isinstance(c, str):
            return datetime.fromisoformat(c).date()
        return date.min

    week_plant = []
    for offset in range((today - monday).days + 1):
        day = monday + timedelta(days=offset)
        day_iso = day.isoformat()
        active = [g for g in goals if _goal_created_date(g) <= day]
        if active:
            completed = sum(1 for g in active if day_iso in (g.completed_dates or []))
            goal_pct = completed / len(active)
        else:
            goal_pct = 0.0
        week_plant.append({
            "date": day_iso,
            "weekday": offset,  # 0 = Monday
            "goal_pct": goal_pct,
            "relapsed": day_iso in relapse_days,
        })

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
            "relapsed_this_week": relapsed_this_week,
        },
        "week_plant": week_plant,
    }
