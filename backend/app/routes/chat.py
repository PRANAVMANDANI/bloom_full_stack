"""Chat route: manage distinct chat sessions."""

from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId

from app.database import get_database
from app.auth.dependencies import get_current_user

from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/chat", tags=["Chat"])


class RenameSessionRequest(BaseModel):
    name: str


@router.get("/sessions")
async def get_chat_sessions(user: dict = Depends(get_current_user)):
    """Retrieve all active chat sessions for the user."""
    db = get_database()
    user_id = user["_id"]

    cursor = db.chat_sessions.find({"user_id": user_id}).sort("updated_at", -1)
    sessions = []
    async for s in cursor:
        sessions.append({
            "session_id": s["session_id"],
            "name": s.get("name", "New Conversation"),
            "last_message": s.get("last_message", "New conversation 🌱"),
            "last_timestamp": s["updated_at"].isoformat() if s.get("updated_at") else None,
        })

    return sessions


@router.put("/sessions/{session_id}/rename")
async def rename_chat_session(
    session_id: str,
    payload: RenameSessionRequest,
    user: dict = Depends(get_current_user)
):
    """Rename an existing chat session."""
    db = get_database()
    user_id = user["_id"]

    result = await db.chat_sessions.update_one(
        {"session_id": session_id, "user_id": user_id},
        {"$set": {"name": payload.name}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")

    return {"message": "Session renamed successfully"}


@router.delete("/sessions/{session_id}", status_code=status.HTTP_200_OK)
async def delete_chat_session(session_id: str, user: dict = Depends(get_current_user)):
    """Permanently delete a chat session and all messages contained within."""
    db = get_database()
    user_id = user["_id"]

    # Delete session meta
    await db.chat_sessions.delete_one({"user_id": user_id, "session_id": session_id})
    # Delete all messages in the session
    result = await db.chat_messages.delete_many({"user_id": user_id, "session_id": session_id})

    return {
        "message": f"Successfully deleted session and cleared {result.deleted_count} messages"
    }
