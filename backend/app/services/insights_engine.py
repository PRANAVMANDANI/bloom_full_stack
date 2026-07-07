"""Insights engine: nightly computation of user-specific insights."""

from datetime import datetime, timezone, timedelta
from collections import Counter
from app.database import get_database

_WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _avg(values):
    return sum(values) / len(values) if values else 0.0


async def generate_insights_for_user(user_id) -> list[dict]:
    """
    Generate insights for a single user based on their last 30 days of data.

    Computes:
    - Mood trend analysis
    - Goal completion rate
    - Urge patterns (time-of-day, common triggers)
    - Journal sentiment trend
    - General encouragement

    Returns list of insight documents to insert.
    """
    db = get_database()
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    insights = []

    # --- 1. Mood Trend ---
    mood_logs = await db.mood_logs.find(
        {"user_id": user_id, "timestamp": {"$gte": thirty_days_ago}}
    ).sort("timestamp", 1).to_list(1000)

    if len(mood_logs) >= 3:
        scores = [m["mood_score"] for m in mood_logs]
        avg_score = sum(scores) / len(scores)
        # Compare first half to second half
        mid = len(scores) // 2
        first_half_avg = sum(scores[:mid]) / max(len(scores[:mid]), 1)
        second_half_avg = sum(scores[mid:]) / max(len(scores[mid:]), 1)

        if second_half_avg > first_half_avg + 0.5:
            insights.append({
                "user_id": user_id,
                "generated_at": now,
                "type": "mood",
                "message": f"🌟 Your mood has been trending upward! Your recent average is {second_half_avg:.1f}/10, up from {first_half_avg:.1f}/10 earlier. Keep nurturing what's working for you.",
            })
        elif second_half_avg < first_half_avg - 0.5:
            insights.append({
                "user_id": user_id,
                "generated_at": now,
                "type": "mood",
                "message": f"💙 Your mood has dipped a bit recently (from {first_half_avg:.1f} to {second_half_avg:.1f}/10). This is completely normal — recovery isn't linear. Consider reaching out to someone you trust or trying a new self-care activity.",
            })
        else:
            insights.append({
                "user_id": user_id,
                "generated_at": now,
                "type": "mood",
                "message": f"🌿 Your mood has been steady around {avg_score:.1f}/10. Consistency is a form of strength. Keep checking in with yourself.",
            })

    # --- 2. Goal Completion Rate ---
    goals = await db.goals.find({"user_id": user_id}).to_list(100)
    if goals:
        from datetime import date
        total_completable_days = 0
        total_completed = 0
        for goal in goals:
            completed_dates = goal.get("completed_dates", [])
            # Count completions in last 30 days
            recent = [d for d in completed_dates if d >= thirty_days_ago.strftime("%Y-%m-%d")]
            total_completed += len(recent)
            total_completable_days += 30  # Simplified: assume daily

        if total_completable_days > 0:
            rate = (total_completed / total_completable_days) * 100
            if rate >= 70:
                insights.append({
                    "user_id": user_id,
                    "generated_at": now,
                    "type": "goals",
                    "message": f"🎯 Amazing! You've completed {rate:.0f}% of your daily goals this month. Your consistency is really paying off!",
                })
            elif rate >= 40:
                insights.append({
                    "user_id": user_id,
                    "generated_at": now,
                    "type": "goals",
                    "message": f"🌱 You've completed {rate:.0f}% of your goals this month. Every day you show up counts — progress over perfection.",
                })
            else:
                insights.append({
                    "user_id": user_id,
                    "generated_at": now,
                    "type": "goals",
                    "message": f"🌻 You've been working on {len(goals)} goals. Even on tough days, opening this app shows you care about your growth. Consider simplifying your goals to build momentum.",
                })

    # --- 3. Urge Patterns ---
    urge_logs = await db.urge_logs.find(
        {"user_id": user_id, "timestamp": {"$gte": thirty_days_ago}}
    ).to_list(5000)

    if len(urge_logs) >= 3:
        # Time-of-day analysis
        hour_counts = {}
        trigger_counts = {}
        intensities = []

        for log in urge_logs:
            hour = log["timestamp"].hour
            period = "morning (6am-12pm)" if 6 <= hour < 12 else \
                     "afternoon (12pm-6pm)" if 12 <= hour < 18 else \
                     "evening (6pm-12am)" if 18 <= hour < 24 else \
                     "night (12am-6am)"
            hour_counts[period] = hour_counts.get(period, 0) + 1

            for tag in log.get("trigger_tags", []):
                trigger_counts[tag] = trigger_counts.get(tag, 0) + 1

            intensities.append(log["intensity"])

        # Find peak time
        peak_time = max(hour_counts, key=hour_counts.get)
        avg_intensity = sum(intensities) / len(intensities)

        insights.append({
            "user_id": user_id,
            "generated_at": now,
            "type": "urges",
            "message": f"📊 Your urges tend to peak in the {peak_time} with an average intensity of {avg_intensity:.1f}/10. Knowing your patterns is powerful — try preparing a coping strategy for those times.",
        })

        # Top triggers
        if trigger_counts:
            top_triggers = sorted(trigger_counts, key=trigger_counts.get, reverse=True)[:3]
            insights.append({
                "user_id": user_id,
                "generated_at": now,
                "type": "urges",
                "message": f"🔍 Your most common urge triggers: {', '.join(top_triggers)}. Awareness of triggers is the first step to managing them.",
            })

    # --- 4. Journal Sentiment Trend ---
    journal_entries = await db.journal_entries.find(
        {"user_id": user_id, "timestamp": {"$gte": thirty_days_ago}, "sentiment_score": {"$exists": True}}
    ).sort("timestamp", 1).to_list(1000)

    if len(journal_entries) >= 3:
        sentiments = [e["sentiment_score"] for e in journal_entries]
        avg_sentiment = sum(sentiments) / len(sentiments)
        mid = len(sentiments) // 2
        recent_avg = sum(sentiments[mid:]) / max(len(sentiments[mid:]), 1)

        if avg_sentiment > 0.2:
            insights.append({
                "user_id": user_id,
                "generated_at": now,
                "type": "sentiment",
                "message": f"📝 Your journal entries carry a positive tone overall. Writing is clearly a healthy outlet for you — keep it up!",
            })
        elif avg_sentiment < -0.2:
            insights.append({
                "user_id": user_id,
                "generated_at": now,
                "type": "sentiment",
                "message": f"📝 Your recent journal entries reflect some difficult emotions. That's okay — journaling about tough feelings is a healthy way to process them. Consider also sharing with someone you trust.",
            })

    # --- 5. Cross-signal Correlations (the "intelligence" layer) ---
    # Bucket mood scores by calendar day so we can compare moods across the
    # kinds of days a user had (urge days, journaling days, goal days...).
    mood_by_date = {}
    for m in mood_logs:
        d = m["timestamp"].date()
        mood_by_date.setdefault(d, []).append(m["mood_score"])

    # 5a. Mood on urge days vs. urge-free days
    if len(mood_by_date) >= 4 and len(urge_logs) >= 2:
        urge_dates = {u["timestamp"].date() for u in urge_logs}
        urge_day_moods = [s for d, ss in mood_by_date.items() if d in urge_dates for s in ss]
        calm_day_moods = [s for d, ss in mood_by_date.items() if d not in urge_dates for s in ss]
        if len(urge_day_moods) >= 2 and len(calm_day_moods) >= 2:
            diff = _avg(calm_day_moods) - _avg(urge_day_moods)
            if diff >= 0.8:
                insights.append({
                    "user_id": user_id,
                    "generated_at": now,
                    "type": "correlation",
                    "message": (
                        f"🔗 On days you log an urge, your mood averages {_avg(urge_day_moods):.1f}/10 — "
                        f"about {diff:.1f} points lower than urge-free days ({_avg(calm_day_moods):.1f}/10). "
                        f"Urges are tough on how you feel; a coping plan for those moments may lift the whole day."
                    ),
                })

    # 5b. Mood on days you journal vs. days you don't
    if len(mood_by_date) >= 4 and len(journal_entries) >= 2:
        journal_dates = {e["timestamp"].date() for e in journal_entries}
        journal_day_moods = [s for d, ss in mood_by_date.items() if d in journal_dates for s in ss]
        quiet_day_moods = [s for d, ss in mood_by_date.items() if d not in journal_dates for s in ss]
        if len(journal_day_moods) >= 2 and len(quiet_day_moods) >= 2:
            diff = _avg(journal_day_moods) - _avg(quiet_day_moods)
            if diff >= 0.8:
                insights.append({
                    "user_id": user_id,
                    "generated_at": now,
                    "type": "correlation",
                    "message": (
                        f"🔗 Days you journal, your mood runs about {diff:.1f} points higher "
                        f"({_avg(journal_day_moods):.1f}/10 vs {_avg(quiet_day_moods):.1f}/10). "
                        f"Writing really seems to work for you — worth reaching for on the harder days."
                    ),
                })

    # 5c. Which weekday do urges cluster on?
    if len(urge_logs) >= 5:
        weekday_counts = Counter(u["timestamp"].weekday() for u in urge_logs)
        top_wd, top_count = weekday_counts.most_common(1)[0]
        share = top_count / len(urge_logs)
        if share >= 0.35:
            insights.append({
                "user_id": user_id,
                "generated_at": now,
                "type": "correlation",
                "message": (
                    f"🔗 Your urges cluster on {_WEEKDAY_NAMES[top_wd]}s — {top_count} of your last "
                    f"{len(urge_logs)} logged urges. Knowing the day is half the battle; consider lining up "
                    f"a supportive plan or distraction for {_WEEKDAY_NAMES[top_wd]}s."
                ),
            })

    # 5d. Mood on days you complete a goal vs. days you don't
    if len(mood_by_date) >= 4 and goals:
        goal_completion_dates = set()
        for g in goals:
            goal_completion_dates.update(g.get("completed_dates", []))
        if goal_completion_dates:
            active_moods = [s for d, ss in mood_by_date.items() if d.isoformat() in goal_completion_dates for s in ss]
            idle_moods = [s for d, ss in mood_by_date.items() if d.isoformat() not in goal_completion_dates for s in ss]
            if len(active_moods) >= 2 and len(idle_moods) >= 2:
                diff = _avg(active_moods) - _avg(idle_moods)
                if diff >= 0.8:
                    insights.append({
                        "user_id": user_id,
                        "generated_at": now,
                        "type": "correlation",
                        "message": (
                            f"🔗 On days you complete at least one goal, your mood averages "
                            f"{_avg(active_moods):.1f}/10 — about {diff:.1f} points higher than days you don't. "
                            f"Small wins and good days seem to travel together for you."
                        ),
                    })

    # --- 6. General Encouragement (always include one) ---
    insights.append({
        "user_id": user_id,
        "generated_at": now,
        "type": "general",
        "message": "🌸 Remember: growth isn't always visible. Like roots growing underground before a flower blooms, your daily efforts are building a foundation for lasting change. Be gentle with yourself.",
    })

    # Write insights to database
    if insights:
        await db.insights.insert_many(insights)

    return insights


async def run_nightly_insights():
    """Run the insights engine for all users. Called by APScheduler."""
    db = get_database()
    if db is None:
        print("[WARN] Database not connected, skipping insights generation")
        return

    users_cursor = db.users.find({}, {"_id": 1})
    count = 0
    async for user in users_cursor:
        try:
            # All collections store user_id as a string, so convert the ObjectId
            await generate_insights_for_user(str(user["_id"]))
            count += 1
        except Exception as e:
            print(f"Error generating insights for user {user['_id']}: {e}")

    print(f"[OK] Nightly insights generated for {count} users")
