"""Settings routes: data export and account deletion."""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from datetime import datetime, timezone
from bson import ObjectId

from app.database import get_database
from app.auth.dependencies import get_current_user
from app.auth.hashing import hash_password, verify_password
from app.models.user import UserProfileUpdate, ChangePasswordRequest

router = APIRouter(prefix="/api/settings", tags=["Settings"])


@router.get("/export")
async def export_user_data(user: dict = Depends(get_current_user)):
    """Export all user data as a JSON object."""
    db = get_database()
    user_id = user["_id"]

    # Helper to recursively serialize MongoDB documents (converting datetimes and ObjectIds)
    def serialize_mongo_data(val):
        if isinstance(val, dict):
            return {k: serialize_mongo_data(v) for k, v in val.items()}
        elif isinstance(val, list):
            return [serialize_mongo_data(v) for v in val]
        elif isinstance(val, datetime):
            return val.isoformat()
        elif isinstance(val, ObjectId):
            return str(val)
        return val

    # Gather all data
    goals = await db.goals.find({"user_id": user_id}).to_list(1000)
    habits = await db.habits.find({"user_id": user_id}).to_list(1000)
    urge_logs = await db.urge_logs.find({"user_id": user_id}).to_list(5000)
    mood_logs = await db.mood_logs.find({"user_id": user_id}).to_list(5000)
    journal_entries = await db.journal_entries.find({"user_id": user_id}).to_list(1000)
    chat_messages = await db.chat_messages.find({"user_id": user_id}).to_list(10000)
    chat_sessions = await db.chat_sessions.find({"user_id": user_id}).to_list(1000)
    insights = await db.insights.find({"user_id": user_id}).to_list(1000)
    weekly_reviews = await db.weekly_reviews.find({"user_id": user_id}).to_list(1000)

    export_data = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "user": {
            "id": str(user["_id"]),
            "email": user["email"],
            "name": user.get("name", ""),
            "created_at": user["created_at"],
        },
        "goals": goals,
        "habits": habits,
        "urge_logs": urge_logs,
        "mood_logs": mood_logs,
        "journal_entries": journal_entries,
        "chat_messages": chat_messages,
        "chat_sessions": chat_sessions,
        "insights": insights,
        "weekly_reviews": weekly_reviews,
    }

    # Recursively serialize all data
    serialized_export = serialize_mongo_data(export_data)

    return JSONResponse(
        content=serialized_export,
        headers={
            "Content-Disposition": f"attachment; filename=bloom_export_{user['email']}.json"
        },
    )


@router.delete("/account", status_code=200)
async def delete_account(user: dict = Depends(get_current_user)):
    """Permanently delete the user account and ALL associated data."""
    db = get_database()
    user_id = user["_id"]

    # Delete all user data from every collection
    await db.goals.delete_many({"user_id": user_id})
    await db.habits.delete_many({"user_id": user_id})
    await db.urge_logs.delete_many({"user_id": user_id})
    await db.mood_logs.delete_many({"user_id": user_id})
    await db.journal_entries.delete_many({"user_id": user_id})
    await db.chat_messages.delete_many({"user_id": user_id})
    await db.chat_sessions.delete_many({"user_id": user_id})
    await db.insights.delete_many({"user_id": user_id})
    await db.weekly_reviews.delete_many({"user_id": user_id})

    # Delete the user account itself
    if isinstance(user_id, str):
        await db.users.delete_one({"_id": ObjectId(user_id)})
    else:
        await db.users.delete_one({"_id": user_id})

    return {"message": "Account and all associated data permanently deleted"}


@router.put("/password")
async def change_password(
    payload: ChangePasswordRequest,
    user: dict = Depends(get_current_user),
):
    """Change the current user's password after verifying the existing one."""
    db = get_database()

    if not user.get("password_hash"):
        raise HTTPException(
            status_code=400,
            detail="This account signed in with Google and doesn't have a password to change.",
        )
    if not verify_password(payload.current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    # Bumping token_version revokes every outstanding session on password change.
    await db.users.update_one(
        {"_id": ObjectId(str(user["_id"]))},
        {
            "$set": {"password_hash": hash_password(payload.new_password)},
            "$inc": {"token_version": 1},
        },
    )
    return {"message": "Password updated successfully"}


@router.put("/profile")
async def update_user_profile(
    payload: UserProfileUpdate,
    user: dict = Depends(get_current_user)
):
    """Update user demographics profile info."""
    db = get_database()
    obj_id = ObjectId(user["_id"])

    profile_data = {k: v for k, v in payload.model_dump().items() if v is not None}

    await db.users.update_one(
        {"_id": obj_id},
        {"$set": {"profile": profile_data}}
    )

    updated_user = await db.users.find_one({"_id": obj_id})
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Return only safe fields — never the password hash
    return {
        "id": str(updated_user["_id"]),
        "email": updated_user["email"],
        "name": updated_user.get("name", ""),
        "created_at": updated_user["created_at"].isoformat(),
        "preferences": updated_user.get("preferences", {}),
        "profile": updated_user.get("profile"),
        "auth_provider": updated_user.get("auth_provider", "password"),
    }

