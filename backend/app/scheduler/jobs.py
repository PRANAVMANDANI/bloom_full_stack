"""APScheduler job definitions for daily reminders and nightly insights."""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from app.services.insights_engine import run_nightly_insights
from app.services.weekly_review import run_weekly_reviews
from app.services.reminders import send_hourly_reminders

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

    # Hourly reminders — runs at every hour (checks user preferences)
    scheduler.add_job(
        send_hourly_reminders,
        trigger=CronTrigger(minute=0),
        id="hourly_reminders",
        name="Send reminders to users based on their preferences",
        replace_existing=True,
    )

    scheduler.start()
    print("[OK] Scheduler started with nightly insights, weekly reviews, and hourly reminders")
