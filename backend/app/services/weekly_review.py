"""Weekly 'Your week in review' — an AI-written reflection over the last 7 days.

Gathers the week's moods, journals, goal completions, sobriety streaks and urge
activity, hands a compact summary to the LLM, and stores the result in the
`weekly_reviews` collection so the frontend can show the latest one.
"""

from datetime import datetime, timezone, timedelta
from bson import ObjectId

from app.database import get_database
from app.services.llm_client import generate_weekly_review
from app.routes.habits import compute_sobriety_days


async def _build_week_data_summary(db, user_id: str, now: datetime) -> tuple[str, str, dict]:
    """Return (user_name, plain-text data summary, stats dict) for the last 7 days."""
    week_ago = now - timedelta(days=7)

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    user_name = (user or {}).get("name") or "friend"

    moods = await db.mood_logs.find(
        {"user_id": user_id, "timestamp": {"$gte": week_ago}}
    ).sort("timestamp", 1).to_list(1000)

    journals = await db.journal_entries.find(
        {"user_id": user_id, "timestamp": {"$gte": week_ago}}
    ).sort("timestamp", 1).to_list(1000)

    urge_logs = await db.urge_logs.find(
        {"user_id": user_id, "timestamp": {"$gte": week_ago}}
    ).to_list(5000)

    goals = await db.goals.find({"user_id": user_id}).to_list(100)
    habits = await db.habits.find({"user_id": user_id}).to_list(100)

    # --- Mood ---
    mood_scores = [m["mood_score"] for m in moods]
    if mood_scores:
        avg_mood = sum(mood_scores) / len(mood_scores)
        mid = len(mood_scores) // 2
        first = mood_scores[:mid] or mood_scores
        second = mood_scores[mid:] or mood_scores
        trend = (sum(second) / len(second)) - (sum(first) / len(first))
        trend_word = "trending up" if trend > 0.5 else "dipping" if trend < -0.5 else "steady"
        mood_line = f"Mood: {len(mood_scores)} check-ins, average {avg_mood:.1f}/10, {trend_word}."
    else:
        avg_mood = None
        mood_line = "Mood: no check-ins this week."

    # --- Goals ---
    week_date_strs = {(now - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)}
    goal_completions = 0
    best_goal = None
    best_goal_count = 0
    for g in goals:
        completed = [d for d in g.get("completed_dates", []) if d in week_date_strs]
        goal_completions += len(completed)
        if len(completed) > best_goal_count:
            best_goal_count = len(completed)
            best_goal = g.get("title")
    goals_line = f"Goals: {goal_completions} completions across {len(goals)} goal(s) this week."
    if best_goal:
        goals_line += f" Most consistent: \"{best_goal}\" ({best_goal_count}/7 days)."

    # --- Sobriety streaks ---
    streak_bits = []
    for h in habits:
        days = await compute_sobriety_days(db, h)
        streak_bits.append(f"\"{h['name']}\": {days} days")
    streak_line = "Sobriety streaks: " + ("; ".join(streak_bits) if streak_bits else "none tracked.")

    # --- Journals ---
    journal_line = f"Journaling: {len(journals)} entr{'y' if len(journals) == 1 else 'ies'} this week."

    # --- Urges ---
    relapses = sum(1 for u in urge_logs if "relapse" in u.get("trigger_tags", []))
    resisted = len(urge_logs) - relapses
    urge_line = f"Urges logged: {len(urge_logs)} ({resisted} resisted, {relapses} relapse(s))."

    summary = "\n".join([mood_line, goals_line, streak_line, journal_line, urge_line])
    stats = {
        "mood_checkins": len(mood_scores),
        "avg_mood": round(avg_mood, 1) if avg_mood is not None else None,
        "goal_completions": goal_completions,
        "journal_entries": len(journals),
        "urges_logged": len(urge_logs),
        "relapses": relapses,
    }
    return user_name, summary, stats


async def generate_weekly_review_for_user(user_id: str, now: datetime = None) -> dict:
    """Generate and store one weekly review for a user. Returns the stored doc (dict)."""
    db = get_database()
    now = now or datetime.now(timezone.utc)

    user_name, summary, stats = await _build_week_data_summary(db, user_id, now)
    review_text = await generate_weekly_review(user_name, summary)

    doc = {
        "user_id": user_id,
        "generated_at": now,
        "period_start": now - timedelta(days=7),
        "period_end": now,
        "summary": review_text,
        "stats": stats,
    }
    await db.weekly_reviews.insert_one(doc)
    return doc


async def run_weekly_reviews():
    """Generate weekly reviews for all users. Called by APScheduler."""
    db = get_database()
    if db is None:
        print("[WARN] Database not connected, skipping weekly reviews")
        return

    now = datetime.now(timezone.utc)
    users_cursor = db.users.find({}, {"_id": 1})
    count = 0
    async for user in users_cursor:
        try:
            await generate_weekly_review_for_user(str(user["_id"]), now)
            count += 1
        except Exception as e:
            print(f"Error generating weekly review for user {user['_id']}: {e}")

    print(f"[OK] Weekly reviews generated for {count} users")
