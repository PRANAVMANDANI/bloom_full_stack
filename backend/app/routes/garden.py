"""Bloom Garden route: the user's growth history, one 'garden bed' per week.

Each week bundles that week's per-day plant data (same shape the dashboard uses
for its weekly plant) with a rollup summary across mood, goals, journaling and
sobriety — so the frontend can render a shelf of weekly gardens and reveal a
full week-in-review on hover.
"""

from datetime import datetime, timezone, date, timedelta

from fastapi import APIRouter, Depends, Query

from app.database import get_database
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/garden", tags=["Garden"])

_MONTH = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _label(monday: date, sunday: date) -> str:
    """Human range label, e.g. 'Jun 30 – Jul 6' or 'Jul 7 – 13'."""
    if monday.month == sunday.month:
        return f"{_MONTH[monday.month]} {monday.day} – {sunday.day}"
    return f"{_MONTH[monday.month]} {monday.day} – {_MONTH[sunday.month]} {sunday.day}"


def _goal_created_date(g: dict) -> date:
    c = g.get("created_at")
    if isinstance(c, datetime):
        return c.date()
    if isinstance(c, str):
        try:
            return datetime.fromisoformat(c).date()
        except ValueError:
            return date.min
    return date.min


def _as_utc(ts: datetime) -> datetime:
    return ts.replace(tzinfo=timezone.utc) if ts.tzinfo is None else ts


@router.get("")
async def get_garden(
    weeks: int = Query(12, ge=1, le=52),
    user: dict = Depends(get_current_user),
):
    """Return up to `weeks` recent weeks (newest first) that have any activity."""
    db = get_database()
    user_id = user["_id"]

    today = date.today()
    this_monday = today - timedelta(days=today.weekday())
    start_monday = this_monday - timedelta(weeks=weeks - 1)
    range_start = datetime.combine(start_monday, datetime.min.time()).replace(tzinfo=timezone.utc)

    # --- One fetch per collection over the whole window, then bucket by week. ---
    goals = await db.goals.find({"user_id": user_id}).to_list(500)

    moods = await db.mood_logs.find(
        {"user_id": user_id, "timestamp": {"$gte": range_start}}
    ).to_list(5000)

    journals = await db.journal_entries.find(
        {"user_id": user_id, "timestamp": {"$gte": range_start}}
    ).to_list(5000)

    urges = await db.urge_logs.find(
        {"user_id": user_id, "timestamp": {"$gte": range_start}}
    ).to_list(10000)

    # Relapse days (ISO date -> True) across the window.
    relapse_days = set()
    for u in urges:
        if "relapse" in (u.get("trigger_tags") or []):
            relapse_days.add(_as_utc(u["timestamp"]).date().isoformat())

    result = []
    for w in range(weeks):
        monday = start_monday + timedelta(weeks=w)
        sunday = monday + timedelta(days=6)
        # Current week stops at today; past weeks show the full 7 days.
        last_day = min(sunday, today)
        if monday > today:
            continue

        # Per-day plant data (same algorithm as the dashboard weekly plant).
        days = []
        for offset in range((last_day - monday).days + 1):
            d = monday + timedelta(days=offset)
            d_iso = d.isoformat()
            active = [g for g in goals if _goal_created_date(g) <= d]
            if active:
                completed = sum(1 for g in active if d_iso in (g.get("completed_dates") or []))
                goal_pct = completed / len(active)
            else:
                goal_pct = 0.0
            days.append({
                "date": d_iso,
                "weekday": offset,
                "goal_pct": goal_pct,
                "relapsed": d_iso in relapse_days,
            })

        # --- Week rollup summary ---
        wk_start_dt = datetime.combine(monday, datetime.min.time()).replace(tzinfo=timezone.utc)
        wk_end_dt = datetime.combine(sunday, datetime.max.time()).replace(tzinfo=timezone.utc)

        def _in_week(doc):
            ts = _as_utc(doc["timestamp"])
            return wk_start_dt <= ts <= wk_end_dt

        wk_moods = [m for m in moods if _in_week(m)]
        wk_journals = [j for j in journals if _in_week(j)]
        wk_urges = [u for u in urges if _in_week(u)]

        mood_scores = [m["mood_score"] for m in wk_moods]
        avg_mood = round(sum(mood_scores) / len(mood_scores), 1) if mood_scores else None

        week_date_strs = {(monday + timedelta(days=i)).isoformat() for i in range(7)}
        goal_completions = 0
        best_goal = None
        best_goal_count = 0
        for g in goals:
            done = [d for d in (g.get("completed_dates") or []) if d in week_date_strs]
            goal_completions += len(done)
            if len(done) > best_goal_count:
                best_goal_count = len(done)
                best_goal = g.get("title")

        relapses = sum(1 for u in wk_urges if "relapse" in (u.get("trigger_tags") or []))
        urges_resisted = len(wk_urges) - relapses

        # A short representative journal excerpt (the longest entry that week).
        journal_snippet = None
        if wk_journals:
            longest = max(wk_journals, key=lambda j: len(j.get("text", "")))
            text = (longest.get("text") or "").strip().replace("\n", " ")
            journal_snippet = text[:140] + ("…" if len(text) > 140 else "")

        # Bloom score: average daily goal completion, gently penalised by relapses.
        elapsed = len(days) or 1
        avg_goal = sum(d["goal_pct"] for d in days) / elapsed
        bloom_score = max(0.0, avg_goal - 0.12 * relapses)
        clean_days = elapsed - len({d["date"] for d in days if d["relapsed"]})

        has_activity = (
            goal_completions > 0 or len(wk_moods) > 0 or len(wk_journals) > 0
            or len(wk_urges) > 0 or relapses > 0
        )
        is_current = monday == this_monday

        result.append({
            "week_start": monday.isoformat(),
            "week_end": sunday.isoformat(),
            "label": _label(monday, sunday),
            "is_current": is_current,
            "has_activity": has_activity,
            "days": days,
            "summary": {
                "bloom_score": round(bloom_score, 2),
                "clean_days": clean_days,
                "days_tracked": elapsed,
                "mood_checkins": len(mood_scores),
                "avg_mood": avg_mood,
                "goal_completions": goal_completions,
                "best_goal": best_goal,
                "best_goal_count": best_goal_count,
                "journal_entries": len(wk_journals),
                "journal_snippet": journal_snippet,
                "urges_resisted": urges_resisted,
                "relapses": relapses,
            },
        })

    # Newest first; drop empty past weeks but always keep the current week.
    result = [w for w in result if w["has_activity"] or w["is_current"]]
    result.reverse()
    return {"weeks": result}
