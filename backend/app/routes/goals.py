"""Goals routes: CRUD, completion, and streak tracking."""

from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timezone, date, timedelta
import calendar
from bson import ObjectId

from app.database import get_database
from app.auth.dependencies import get_current_user
from app.models.goal import GoalCreate, GoalUpdate, GoalOut, ToggleDatePayload

router = APIRouter(prefix="/api/goals", tags=["Goals"])

# A "streak freeze" / grace day lets a user protect a missed day so it doesn't
# break their streak. Limited per calendar month to keep it meaningful.
MAX_FREEZES_PER_MONTH = 3


def _safe_date(d: str):
    """Parse a YYYY-MM-DD string to a date, or None if invalid."""
    try:
        return date.fromisoformat(d)
    except (ValueError, TypeError):
        return None


def calculate_streak(completed_dates: list[str], frozen_dates: list[str] = None) -> int:
    """Calculate the current streak of consecutive completed days.

    The streak is alive if the most recent completion was today or yesterday
    (today may still be "not done yet"). A frozen/grace day bridges a gap: it
    keeps the chain alive but does not itself add to the count.
    """
    if not completed_dates:
        return 0

    completed = {date.fromisoformat(d) for d in completed_dates}
    frozen = {date.fromisoformat(d) for d in (frozen_dates or [])}
    today = date.today()

    # Anchor the walk: allow a grace for "today not done yet" by starting at
    # yesterday when today is neither completed nor frozen.
    cursor = today
    if cursor not in completed and cursor not in frozen:
        cursor = today - timedelta(days=1)

    streak = 0
    while True:
        if cursor in completed:
            streak += 1
            cursor -= timedelta(days=1)
        elif cursor in frozen:
            cursor -= timedelta(days=1)  # bridges the gap, no increment
        else:
            break

    return streak


def _freezes_remaining_this_month(frozen_dates: list[str]) -> int:
    """How many grace-day freezes the user has left for the current calendar month."""
    today = date.today()
    used = 0
    for d in frozen_dates:
        try:
            fd = date.fromisoformat(d)
        except ValueError:
            continue
        if fd.year == today.year and fd.month == today.month:
            used += 1
    return max(0, MAX_FREEZES_PER_MONTH - used)


def goal_doc_to_out(doc: dict) -> GoalOut:
    """Convert a MongoDB goal document to GoalOut."""
    completed_dates = doc.get("completed_dates", [])
    frozen_dates = doc.get("frozen_dates", [])
    today_str = date.today().isoformat()
    return GoalOut(
        id=str(doc["_id"]),
        user_id=str(doc["user_id"]),
        title=doc["title"],
        frequency=doc.get("frequency", "daily"),
        streak=calculate_streak(completed_dates, frozen_dates),
        completed_dates=completed_dates,
        frozen_dates=frozen_dates,
        freezes_remaining=_freezes_remaining_this_month(frozen_dates),
        created_at=doc["created_at"],
        completed_today=today_str in completed_dates,
    )


@router.get("", response_model=list[GoalOut])
async def get_goals(user: dict = Depends(get_current_user)):
    """Get all goals for the current user."""
    db = get_database()
    cursor = db.goals.find({"user_id": user["_id"]})
    goals = []
    async for doc in cursor:
        goals.append(goal_doc_to_out(doc))
    return goals


@router.get("/stats/monthly")
async def get_monthly_goal_stats(
    year: int = None,
    month: int = None,
    user: dict = Depends(get_current_user)
):
    """Retrieve monthly completion stats, best goal, longest streak, and daily heatmap."""
    db = get_database()
    today = date.today()
    if year is None:
        year = today.year
    if month is None:
        month = today.month

    # Calculate month boundary
    try:
        last_day = calendar.monthrange(year, month)[1]
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid year or month")

    start_of_month = date(year, month, 1)
    end_of_month = date(year, month, last_day)

    goals_list = []
    goals_cursor = db.goals.find({"user_id": user["_id"]})
    async for doc in goals_cursor:
        goals_list.append(doc)

    total_completed = 0
    total_elapsed = 0
    best_goal_name = None
    best_goal_rate = -1.0
    longest_streak = 0

    for doc in goals_list:
        completed_dates = doc.get("completed_dates", [])
        
        # Calculate current streak
        streak = calculate_streak(completed_dates, doc.get("frozen_dates", []))
        if streak > longest_streak:
            longest_streak = streak

        # Handle creation date
        created_at_dt = doc.get("created_at")
        if created_at_dt:
            if isinstance(created_at_dt, str):
                created_at_dt = datetime.fromisoformat(created_at_dt.replace("Z", "+00:00"))
            elif isinstance(created_at_dt, datetime) and created_at_dt.tzinfo is None:
                created_at_dt = created_at_dt.replace(tzinfo=timezone.utc)
            goal_created_date = created_at_dt.date()
        else:
            goal_created_date = start_of_month

        # If goal was created after this month ends
        if goal_created_date > end_of_month:
            continue

        # Tracking bounds
        start_tracking = max(start_of_month, goal_created_date)
        
        if end_of_month > today:
            # Future or current month
            if start_of_month > today:
                continue
            end_tracking = min(today, end_of_month)
        else:
            end_tracking = end_of_month

        elapsed_days = (end_tracking - start_tracking).days + 1
        if elapsed_days <= 0:
            continue

        # Count completed dates in range
        month_completions = 0
        for d_str in completed_dates:
            try:
                d = date.fromisoformat(d_str)
                if start_tracking <= d <= end_tracking:
                    month_completions += 1
            except ValueError:
                continue

        total_completed += month_completions
        total_elapsed += elapsed_days

        rate = month_completions / elapsed_days
        if rate > best_goal_rate:
            best_goal_rate = rate
            best_goal_name = doc["title"]

    overall_completion_rate = (total_completed / total_elapsed) * 100 if total_elapsed > 0 else 0

    # Build heatmap data (YYYY-MM-DD -> completion percentage)
    heatmap = {}
    curr = start_of_month
    limit_date = min(today, end_of_month)
    while curr <= limit_date:
        curr_str = curr.isoformat()
        active_goals = 0
        completed_goals = 0
        for g in goals_list:
            created_at_dt = g.get("created_at")
            if created_at_dt:
                if isinstance(created_at_dt, str):
                    created_at_dt = datetime.fromisoformat(created_at_dt.replace("Z", "+00:00"))
                elif isinstance(created_at_dt, datetime) and created_at_dt.tzinfo is None:
                    created_at_dt = created_at_dt.replace(tzinfo=timezone.utc)
                goal_created_date = created_at_dt.date()
            else:
                goal_created_date = start_of_month
            
            if goal_created_date <= curr:
                active_goals += 1
                if curr_str in g.get("completed_dates", []):
                    completed_goals += 1
        
        heatmap[curr_str] = round((completed_goals / active_goals) * 100, 1) if active_goals > 0 else 0
        curr += timedelta(days=1)

    return {
        "overall_completion_rate": round(overall_completion_rate, 1),
        "best_goal": best_goal_name or "None yet",
        "best_goal_rate": round(best_goal_rate * 100, 1) if best_goal_rate >= 0 else 0,
        "longest_streak": longest_streak,
        "heatmap": heatmap,
    }


@router.post("", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
async def create_goal(goal_data: GoalCreate, user: dict = Depends(get_current_user)):
    """Create a new goal."""
    db = get_database()
    doc = {
        "user_id": user["_id"],
        "title": goal_data.title,
        "frequency": goal_data.frequency,
        "completed_dates": [],
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.goals.insert_one(doc)
    doc["_id"] = result.inserted_id
    return goal_doc_to_out(doc)


@router.put("/{goal_id}", response_model=GoalOut)
async def update_goal(goal_id: str, goal_data: GoalUpdate, user: dict = Depends(get_current_user)):
    """Update a goal's title or frequency."""
    db = get_database()
    goal = await db.goals.find_one({"_id": ObjectId(goal_id), "user_id": user["_id"]})
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    update_fields = {}
    if goal_data.title is not None:
        update_fields["title"] = goal_data.title
    if goal_data.frequency is not None:
        update_fields["frequency"] = goal_data.frequency

    if update_fields:
        await db.goals.update_one({"_id": ObjectId(goal_id)}, {"$set": update_fields})

    updated = await db.goals.find_one({"_id": ObjectId(goal_id)})
    return goal_doc_to_out(updated)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(goal_id: str, user: dict = Depends(get_current_user)):
    """Delete a goal."""
    db = get_database()
    result = await db.goals.delete_one({"_id": ObjectId(goal_id), "user_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Goal not found")


@router.post("/{goal_id}/complete", response_model=GoalOut)
async def complete_goal(goal_id: str, user: dict = Depends(get_current_user)):
    """Mark a goal as completed for today."""
    db = get_database()
    goal = await db.goals.find_one({"_id": ObjectId(goal_id), "user_id": user["_id"]})
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    today_str = date.today().isoformat()
    completed_dates = goal.get("completed_dates", [])

    if today_str in completed_dates:
        # Uncomplete (toggle)
        completed_dates.remove(today_str)
    else:
        completed_dates.append(today_str)

    await db.goals.update_one(
        {"_id": ObjectId(goal_id)},
        {"$set": {"completed_dates": completed_dates}},
    )

    updated = await db.goals.find_one({"_id": ObjectId(goal_id)})
    return goal_doc_to_out(updated)


@router.post("/{goal_id}/freeze-date", response_model=GoalOut)
async def freeze_goal_date(
    goal_id: str,
    payload: ToggleDatePayload,
    user: dict = Depends(get_current_user)
):
    """Toggle a 'streak freeze' (grace day) on a specific past date (YYYY-MM-DD).

    Freezing a missed day keeps a streak alive without counting as a completion.
    Limited to MAX_FREEZES_PER_MONTH per calendar month; a completed day or a
    future/today date can't be frozen.
    """
    db = get_database()
    goal = await db.goals.find_one({"_id": ObjectId(goal_id), "user_id": user["_id"]})
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    date_str = payload.date
    try:
        target = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")

    completed_dates = goal.get("completed_dates", [])
    frozen_dates = goal.get("frozen_dates", [])

    if date_str in frozen_dates:
        # Un-freeze (always allowed)
        frozen_dates.remove(date_str)
    else:
        if target >= date.today():
            raise HTTPException(status_code=400, detail="You can only freeze a past day.")
        if date_str in completed_dates:
            raise HTTPException(status_code=400, detail="That day is already completed — no freeze needed.")
        used_that_month = sum(
            1 for d in frozen_dates
            if (lambda fd: fd and fd.year == target.year and fd.month == target.month)(
                _safe_date(d)
            )
        )
        if used_that_month >= MAX_FREEZES_PER_MONTH:
            raise HTTPException(
                status_code=400,
                detail=f"No streak freezes left for {target.strftime('%B %Y')} (max {MAX_FREEZES_PER_MONTH}/month).",
            )
        frozen_dates.append(date_str)

    await db.goals.update_one(
        {"_id": ObjectId(goal_id)},
        {"$set": {"frozen_dates": frozen_dates}},
    )
    updated = await db.goals.find_one({"_id": ObjectId(goal_id)})
    return goal_doc_to_out(updated)


@router.post("/{goal_id}/toggle-date", response_model=GoalOut)
async def toggle_goal_date(
    goal_id: str,
    payload: ToggleDatePayload,
    user: dict = Depends(get_current_user)
):
    """Toggle a goal's completion for a specific date (YYYY-MM-DD)."""
    db = get_database()
    goal = await db.goals.find_one({"_id": ObjectId(goal_id), "user_id": user["_id"]})
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    date_str = payload.date
    try:
        date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")

    completed_dates = goal.get("completed_dates", [])

    if date_str in completed_dates:
        completed_dates.remove(date_str)
    else:
        completed_dates.append(date_str)

    await db.goals.update_one(
        {"_id": ObjectId(goal_id)},
        {"$set": {"completed_dates": completed_dates}},
    )

    updated = await db.goals.find_one({"_id": ObjectId(goal_id)})
    return goal_doc_to_out(updated)
