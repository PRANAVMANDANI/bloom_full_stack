"""Insights routes: get generated insights for the current user."""

from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import get_database
from app.auth.dependencies import get_current_user
from app.models.insight import InsightOut
from app.services.insights_engine import generate_insights_for_user
from app.services.weekly_review import generate_weekly_review_for_user

router = APIRouter(prefix="/api/insights", tags=["Insights"])


def _weekly_review_to_dict(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "generated_at": doc["generated_at"].isoformat() if doc.get("generated_at") else None,
        "period_start": doc["period_start"].isoformat() if doc.get("period_start") else None,
        "period_end": doc["period_end"].isoformat() if doc.get("period_end") else None,
        "summary": doc.get("summary", ""),
        "stats": doc.get("stats", {}),
    }


@router.get("", response_model=list[InsightOut])
async def get_insights(
    limit: int = Query(10, le=50),
    user: dict = Depends(get_current_user),
):
    """Get the latest insights generated for the current user."""
    db = get_database()
    cursor = (
        db.insights.find({"user_id": user["_id"]})
        .sort("generated_at", -1)
        .limit(limit)
    )
    insights = []
    async for doc in cursor:
        insights.append(
            InsightOut(
                id=str(doc["_id"]),
                user_id=str(doc["user_id"]),
                generated_at=doc["generated_at"],
                type=doc["type"],
                message=doc["message"],
            )
        )
    return insights


@router.post("/generate", response_model=list[InsightOut], status_code=201)
async def generate_insights_now(user: dict = Depends(get_current_user)):
    """Generate fresh insights for the current user on demand.

    Limited to once per hour to keep the data meaningful.
    """
    db = get_database()

    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    recent = await db.insights.find_one(
        {"user_id": user["_id"], "generated_at": {"$gte": one_hour_ago}}
    )
    if recent:
        raise HTTPException(
            status_code=429,
            detail="Insights were generated recently. Please try again in a bit.",
        )

    generated = await generate_insights_for_user(user["_id"])
    return [
        InsightOut(
            id=str(doc["_id"]),
            user_id=str(doc["user_id"]),
            generated_at=doc["generated_at"],
            type=doc["type"],
            message=doc["message"],
        )
        for doc in generated
    ]


@router.get("/weekly-review")
async def get_weekly_review(user: dict = Depends(get_current_user)):
    """Get the most recent weekly review for the current user, or null if none yet."""
    db = get_database()
    doc = await db.weekly_reviews.find_one(
        {"user_id": user["_id"]}, sort=[("generated_at", -1)]
    )
    return _weekly_review_to_dict(doc) if doc else None


@router.post("/weekly-review/generate", status_code=201)
async def generate_weekly_review_now(user: dict = Depends(get_current_user)):
    """Generate a fresh weekly review on demand. Limited to once per hour."""
    db = get_database()

    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    recent = await db.weekly_reviews.find_one(
        {"user_id": user["_id"], "generated_at": {"$gte": one_hour_ago}}
    )
    if recent:
        raise HTTPException(
            status_code=429,
            detail="Your weekly review was just refreshed. Please try again in a bit.",
        )

    doc = await generate_weekly_review_for_user(user["_id"])
    return _weekly_review_to_dict(doc)
