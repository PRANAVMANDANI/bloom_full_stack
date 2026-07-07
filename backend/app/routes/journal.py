"""Journal routes with VADER sentiment analysis on save."""

import re

from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from bson.errors import InvalidId

from app.database import get_database
from app.auth.dependencies import get_current_user
from app.models.journal import JournalCreate, JournalOut
from app.services.sentiment import analyze_sentiment

router = APIRouter(prefix="/api/journal", tags=["Journal"])


@router.post("", response_model=JournalOut, status_code=201)
async def create_journal_entry(entry_data: JournalCreate, user: dict = Depends(get_current_user)):
    """Create a journal entry with automatic sentiment analysis."""
    db = get_database()

    # Run sentiment analysis
    sentiment_score = analyze_sentiment(entry_data.text)

    doc = {
        "user_id": user["_id"],
        "timestamp": datetime.now(timezone.utc),
        "text": entry_data.text,
        "sentiment_score": sentiment_score,
    }
    result = await db.journal_entries.insert_one(doc)
    doc["_id"] = result.inserted_id

    return JournalOut(
        id=str(doc["_id"]),
        user_id=str(doc["user_id"]),
        timestamp=doc["timestamp"],
        text=doc["text"],
        sentiment_score=doc["sentiment_score"],
    )


@router.get("", response_model=list[JournalOut])
async def get_journal_entries(
    limit: int = Query(20, le=100),
    q: Optional[str] = Query(None, max_length=200, description="Search text within entries"),
    user: dict = Depends(get_current_user),
):
    """Get journal entries for the current user, most recent first. Optionally filter by search text."""
    db = get_database()
    query = {"user_id": user["_id"]}
    if q and q.strip():
        query["text"] = {"$regex": re.escape(q.strip()), "$options": "i"}
    cursor = db.journal_entries.find(query).sort("timestamp", -1).limit(limit)
    entries = []
    async for doc in cursor:
        entries.append(
            JournalOut(
                id=str(doc["_id"]),
                user_id=str(doc["user_id"]),
                timestamp=doc["timestamp"],
                text=doc["text"],
                sentiment_score=doc.get("sentiment_score"),
            )
        )
    return entries


@router.delete("/{entry_id}", status_code=204)
async def delete_journal_entry(entry_id: str, user: dict = Depends(get_current_user)):
    """Delete one of the current user's journal entries."""
    db = get_database()
    try:
        obj_id = ObjectId(entry_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid entry id")

    result = await db.journal_entries.delete_one({"_id": obj_id, "user_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Journal entry not found")
