"""APScheduler job definitions for daily reminders and nightly insights."""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from app.services.insights_engine import run_nightly_insights
from app.services.weekly_review import run_weekly_reviews

scheduler = AsyncIOScheduler()


def setup_scheduler():
    """Configure and start the scheduler with all jobs."""

    # Nightly insights generation — runs at 2:00 AM UTC
    scheduler.add_job(
        run_nightly_insights,
        trigger=CronTrigger(hour=2, minute=0),
        id="nightly_insights",
        name="Generate nightly insights for all users",
        replace_existing=True,
    )

    # Weekly review generation — runs Monday at 6:00 AM UTC
    scheduler.add_job(
        run_weekly_reviews,
        trigger=CronTrigger(day_of_week="mon", hour=6, minute=0),
        id="weekly_reviews",
        name="Generate weekly 'week in review' summaries for all users",
        replace_existing=True,
    )

    # Daily reminder placeholder — runs at 8:00 AM UTC
    # (Actual push notifications require additional infrastructure)
    scheduler.add_job(
        daily_reminder_placeholder,
        trigger=CronTrigger(hour=8, minute=0),
        id="daily_reminder",
        name="Daily reminder (placeholder)",
        replace_existing=True,
    )

    scheduler.start()
    print("[OK] Scheduler started with nightly insights, weekly reviews, and daily reminders")


async def daily_reminder_placeholder():
    """Placeholder for daily reminder — logs to console."""
    print("[INFO] Daily reminder would fire here (push notification infrastructure needed)")
