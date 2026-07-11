"""Reminder notification system."""

from datetime import datetime, timezone, timedelta
from app.database import get_database


async def send_hourly_reminders():
    """Check all users with reminders enabled and send notifications for current hour."""
    db = get_database()
    current_utc_hour = datetime.now(timezone.utc).hour
    current_date = datetime.now(timezone.utc).date()

    users = await db.users.find({
        "preferences.reminders.enabled": True,
        "preferences.reminders.times": current_utc_hour,
    }).to_list(None)

    for user in users:
        user_id = user["_id"]
        last_reminder_key = f"last_reminder_sent_{current_date.isoformat()}"

        already_sent = user.get("preferences", {}).get(last_reminder_key)

        if already_sent:
            continue

        await db.users.update_one(
            {"_id": user_id},
            {
                "$set": {
                    f"preferences.{last_reminder_key}": datetime.now(timezone.utc),
                    "preferences.reminder_streak": (
                        user.get("preferences", {}).get("reminder_streak", 0) + 1
                    ),
                }
            },
        )

        await db.reminders.insert_one({
            "user_id": user_id,
            "sent_at": datetime.now(timezone.utc),
            "hour": current_utc_hour,
        })

        print(f"[REMINDER] User {user_id} sent reminder at hour {current_utc_hour}")
