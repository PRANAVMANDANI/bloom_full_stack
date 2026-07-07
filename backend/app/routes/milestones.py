"""Milestones & badges: achievements computed from the user's real activity."""

from fastapi import APIRouter, Depends

from app.database import get_database
from app.auth.dependencies import get_current_user
from app.routes.habits import compute_sobriety_days
from app.routes.goals import calculate_streak

router = APIRouter(prefix="/api/milestones", tags=["Milestones"])

# Each badge: (id, title, description, emoji, category, metric_key, target).
# `metric_key` is looked up in the computed metrics dict below.
BADGE_DEFS = [
    # Sobriety streaks (based on the strongest current streak across habits)
    ("sober_1", "First Day", "One full day strong.", "🌱", "Sobriety", "max_sobriety", 1),
    ("sober_7", "One Week Strong", "7 days of showing up for yourself.", "🌿", "Sobriety", "max_sobriety", 7),
    ("sober_30", "One Month", "30 days — a real foundation.", "🌳", "Sobriety", "max_sobriety", 30),
    ("sober_90", "90 Days", "A full quarter of growth.", "🏵️", "Sobriety", "max_sobriety", 90),
    ("sober_180", "Half a Year", "180 days of resilience.", "🌻", "Sobriety", "max_sobriety", 180),
    ("sober_365", "One Year", "365 days. Extraordinary.", "🌟", "Sobriety", "max_sobriety", 365),
    # Goal streaks (strongest current goal streak)
    ("goal_7", "Consistent Week", "A 7-day goal streak.", "🔥", "Consistency", "max_goal_streak", 7),
    ("goal_30", "Monthly Momentum", "A 30-day goal streak.", "⚡", "Consistency", "max_goal_streak", 30),
    ("goal_100", "Century Streak", "100 days of consistency.", "💯", "Consistency", "max_goal_streak", 100),
    # Journaling
    ("journal_1", "First Entry", "You opened up for the first time.", "📖", "Journaling", "journal_count", 1),
    ("journal_10", "Ten Reflections", "10 journal entries written.", "📚", "Journaling", "journal_count", 10),
    ("journal_50", "Fifty Reflections", "50 entries of self-reflection.", "✍️", "Journaling", "journal_count", 50),
    # Mood check-ins
    ("mood_1", "First Check-in", "You checked in with yourself.", "🙂", "Awareness", "mood_count", 1),
    ("mood_25", "Tuned In", "25 mood check-ins.", "💜", "Awareness", "mood_count", 25),
    ("mood_100", "Deeply Aware", "100 mood check-ins.", "🧠", "Awareness", "mood_count", 100),
    # Goal completions (total wins)
    ("wins_10", "Ten Wins", "10 goals completed in total.", "🎯", "Wins", "total_goal_completions", 10),
    ("wins_100", "Hundred Wins", "100 goals completed in total.", "🏆", "Wins", "total_goal_completions", 100),
]


@router.get("")
async def get_milestones(user: dict = Depends(get_current_user)):
    """Return all badges with achieved/locked status and progress toward each."""
    db = get_database()
    user_id = user["_id"]

    # --- Gather metrics ---
    habits = await db.habits.find({"user_id": user_id}).to_list(100)
    max_sobriety = 0
    for h in habits:
        days = await compute_sobriety_days(db, h)
        max_sobriety = max(max_sobriety, days)

    goals = await db.goals.find({"user_id": user_id}).to_list(200)
    max_goal_streak = 0
    total_goal_completions = 0
    for g in goals:
        completed = g.get("completed_dates", [])
        total_goal_completions += len(completed)
        max_goal_streak = max(max_goal_streak, calculate_streak(completed, g.get("frozen_dates", [])))

    journal_count = await db.journal_entries.count_documents({"user_id": user_id})
    mood_count = await db.mood_logs.count_documents({"user_id": user_id})

    metrics = {
        "max_sobriety": max_sobriety,
        "max_goal_streak": max_goal_streak,
        "journal_count": journal_count,
        "mood_count": mood_count,
        "total_goal_completions": total_goal_completions,
    }

    # --- Build badge list ---
    badges = []
    achieved_count = 0
    for badge_id, title, desc, emoji, category, metric_key, target in BADGE_DEFS:
        current = metrics.get(metric_key, 0)
        achieved = current >= target
        if achieved:
            achieved_count += 1
        badges.append({
            "id": badge_id,
            "title": title,
            "description": desc,
            "emoji": emoji,
            "category": category,
            "target": target,
            "current": current,
            "achieved": achieved,
            "progress": round(min(current / target, 1.0), 3) if target else 1.0,
        })

    return {
        "badges": badges,
        "achieved_count": achieved_count,
        "total_count": len(badges),
        "metrics": metrics,
    }
