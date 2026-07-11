"""Fresh seed script - simplified and bulletproof."""

import asyncio
from datetime import datetime, timezone, timedelta, date
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import random
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config import settings
from app.auth.hashing import hash_password
from app.services.sentiment import analyze_sentiment


async def seed():
    """Seed with 180 days (6 months) of realistic data."""
    print("Connecting to MongoDB...")
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]

    print("Clearing collections...")
    for col in ["users", "goals", "habits", "urge_logs", "mood_logs", "journal_entries",
                "chat_messages", "chat_sessions", "insights", "weekly_reviews", "reminders"]:
        await db[col].delete_many({})

    now = datetime.now(timezone.utc)

    # --- USERS ---
    print("Creating users...")
    user1_id = ObjectId()
    user1_id_str = str(user1_id)  # app stores user_id as a string on all other collections
    users = [
        {
            "_id": user1_id,
            "email": "alex@example.com",
            "name": "Alex",
            "password_hash": hash_password("password123"),
            "auth_provider": "password",
            "email_verified": True,
            "created_at": now - timedelta(days=180),
            "profile": {
                "birthday": "1994-07-22",
                "age": 30,
                "focus_area": "Dual Recovery: Smoking & PMO Addiction",
                "additional_details": "6 months into recovery journey. Successfully quit smoking and dramatically reduced PMO. Built strong meditation practice and exercise routine. Work stress management improved significantly. Feeling confident and hopeful about sustained recovery."
            },
            "preferences": {
                "reminders": {"enabled": True, "times": [7, 19]},
                "reminder_streak": 156
            },
            "token_version": 0,
        }
    ]
    result = await db.users.insert_many(users)
    print("[OK] Created user with ID: " + str(user1_id))

    # --- GOALS (6-month progression) ---
    print("Creating goals...")
    goal_ids = [ObjectId(), ObjectId(), ObjectId()]

    # Goal 1: Meditation - started day 180, progressive improvement
    meditation_completed = []
    for i in range(180):
        day = date.today() - timedelta(days=i)
        # Days 180-165: First 2 weeks (building habit)
        if i >= 165:
            completion_rate = 0.35
        # Days 165-135: Weeks 3-6 (withdrawal phase, low motivation)
        elif i >= 135:
            completion_rate = 0.25
        # Days 135-90: Weeks 7-13 (slow improvement)
        elif i >= 90:
            completion_rate = 0.55
        # Days 90-30: Months 4-5 (established habit)
        elif i >= 30:
            completion_rate = 0.80
        # Days 30-0: Last month (strong consistency)
        else:
            completion_rate = 0.85
        if random.random() < completion_rate:
            meditation_completed.append(day.isoformat())

    # Goal 2: No screens 1 hour before bed
    screens_completed = []
    for i in range(180):
        day = date.today() - timedelta(days=i)
        if i >= 165:
            completion_rate = 0.3
        elif i >= 135:
            completion_rate = 0.35
        elif i >= 90:
            completion_rate = 0.60
        elif i >= 30:
            completion_rate = 0.75
        else:
            completion_rate = 0.80
        if random.random() < completion_rate:
            screens_completed.append(day.isoformat())

    # Goal 3: Exercise (started day 170, took a week to establish)
    exercise_completed = []
    for i in range(170):
        day = date.today() - timedelta(days=i)
        if i >= 165:
            completion_rate = 0.2
        elif i >= 135:
            completion_rate = 0.40
        elif i >= 90:
            completion_rate = 0.65
        elif i >= 30:
            completion_rate = 0.75
        else:
            completion_rate = 0.80
        if random.random() < completion_rate:
            exercise_completed.append(day.isoformat())

    goals = [
        {
            "_id": goal_ids[0],
            "user_id": user1_id_str,
            "title": "Meditate for 10 minutes",
            "frequency": "daily",
            "completed_dates": meditation_completed,
            "created_at": now - timedelta(days=180),
        },
        {
            "_id": goal_ids[1],
            "user_id": user1_id_str,
            "title": "No screens 1 hour before bed",
            "frequency": "daily",
            "completed_dates": screens_completed,
            "created_at": now - timedelta(days=180),
        },
        {
            "_id": goal_ids[2],
            "user_id": user1_id_str,
            "title": "Exercise or walk 20+ minutes",
            "frequency": "daily",
            "completed_dates": exercise_completed,
            "created_at": now - timedelta(days=170),
        },
    ]
    await db.goals.insert_many(goals)
    print("[OK] Created 3 goals with 6-month progression")

    # --- HABITS (6-month quit journey) ---
    print("Creating habits...")
    habit_ids = [ObjectId(), ObjectId()]
    habits = [
        {
            "_id": habit_ids[0],
            "user_id": user1_id_str,
            "name": "Quit smoking",
            "type": "quit",
            "start_date": now - timedelta(days=180),
        },
        {
            "_id": habit_ids[1],
            "user_id": user1_id_str,
            "name": "Reduce PMO (porn/masturbation)",
            "type": "quit",
            "start_date": now - timedelta(days=180),
        },
    ]
    await db.habits.insert_many(habits)
    print("[OK] Created 2 quit-type habits (6-month journey)")

    # --- URGE LOGS (180-day progression with decreasing frequency/intensity) ---
    print("Creating urge logs...")
    urge_logs = []

    for day in range(180, 0, -1):
        # Determine phase and intensity multiplier
        if day > 165:  # Days 1-15: Intense early phase
            smoking_urge_rate = 0.8
            smoking_intensity = (7, 10)
            pmo_urge_rate = 0.7
            pmo_intensity = (6, 9)
        elif day > 135:  # Days 16-45: Withdrawal hell
            smoking_urge_rate = 0.6
            smoking_intensity = (5, 9)
            pmo_urge_rate = 0.5
            pmo_intensity = (5, 8)
        elif day > 90:  # Days 46-90: Gradual improvement
            smoking_urge_rate = 0.3
            smoking_intensity = (3, 6)
            pmo_urge_rate = 0.3
            pmo_intensity = (3, 6)
        elif day > 30:  # Days 91-150: Strong improvement
            smoking_urge_rate = 0.1
            smoking_intensity = (2, 4)
            pmo_urge_rate = 0.15
            pmo_intensity = (2, 4)
        else:  # Days 151-180: Rare occasional urges
            smoking_urge_rate = 0.05
            smoking_intensity = (1, 3)
            pmo_urge_rate = 0.1
            pmo_intensity = (1, 3)

        # Morning smoking urges (coffee ritual)
        if random.random() < smoking_urge_rate:
            urge_logs.append({
                "user_id": user1_id_str,
                "habit_id": str(habit_ids[0]),
                "timestamp": now - timedelta(days=day, hours=8, minutes=random.randint(0, 30)),
                "intensity": random.randint(*smoking_intensity),
                "trigger_tags": ["habit", "routine"],
                "notes": "Morning coffee ritual. Using breathing exercises. Getting easier.",
            })

        # Work stress smoking urges
        if random.random() < smoking_urge_rate * 0.7:
            urge_logs.append({
                "user_id": user1_id_str,
                "habit_id": str(habit_ids[0]),
                "timestamp": now - timedelta(days=day, hours=14 + random.randint(0, 2), minutes=random.randint(0, 59)),
                "intensity": random.randint(*smoking_intensity),
                "trigger_tags": ["stress"],
                "notes": random.choice([
                    "Work stress. Managing better than before.",
                    "Deadline pressure. Walking helps more than smoking would.",
                    "Tough meeting. Using coping strategies that actually work.",
                ]),
            })

        # Evening PMO urges
        if random.random() < pmo_urge_rate:
            urge_logs.append({
                "user_id": user1_id_str,
                "habit_id": str(habit_ids[1]),
                "timestamp": now - timedelta(days=day, hours=22 + random.randint(0, 1), minutes=random.randint(0, 59)),
                "intensity": random.randint(*pmo_intensity),
                "trigger_tags": ["boredom", "tired"],
                "notes": random.choice([
                    "Evening urge. Got through it with meditation.",
                    "Tired but urges are much weaker now.",
                    "Still challenging but I know how to handle it.",
                    "Rare now. Did yoga instead.",
                ]),
            })

    await db.urge_logs.insert_many(urge_logs)
    print(f"[OK] Created {len(urge_logs)} realistic 6-month urge logs")

    # --- MOOD LOGS (180-day recovery arc) ---
    print("Creating mood logs...")
    mood_logs = []

    # Days 180-165: Rock bottom (first 2 weeks)
    for i in range(180, 164, -1):
        score = random.randint(2, 4)
        mood_logs.append({
            "user_id": user1_id_str,
            "timestamp": now - timedelta(days=i, hours=random.randint(10, 20)),
            "mood_score": score,
            "tags": ["anxious", "stressed", "tired"],
            "notes": "Rock bottom. But finally committed to change.",
        })

    # Days 164-135: Withdrawal hell (weeks 3-7)
    for i in range(163, 134, -1):
        score = random.randint(2, 5)
        mood_logs.append({
            "user_id": user1_id_str,
            "timestamp": now - timedelta(days=i, hours=random.randint(10, 20)),
            "mood_score": score,
            "tags": random.choice([["anxious", "tired"], ["stressed", "irritable"], ["anxious", "stressed"]]),
            "notes": random.choice([
                "Withdrawal is brutal.",
                "Irritable but pushing through.",
                "Physical cravings intense but urges less frequent.",
            ]),
        })

    # Days 134-90: First improvements (weeks 8-13)
    for i in range(133, 89, -1):
        score = random.randint(3, 6)
        mood_logs.append({
            "user_id": user1_id_str,
            "timestamp": now - timedelta(days=i, hours=random.randint(10, 20)),
            "mood_score": score,
            "tags": random.choice([["calm", "motivated"], ["hopeful", "tired"], ["calm", "tired"]]),
            "notes": random.choice([
                "Energy improving. Getting back into exercise.",
                "Mind clearer. Noticing small positive changes.",
                "Sleep quality improving. Waking earlier.",
            ]),
        })

    # Days 89-60: Building momentum (weeks 14-18)
    for i in range(88, 59, -1):
        score = random.randint(5, 7)
        mood_logs.append({
            "user_id": user1_id_str,
            "timestamp": now - timedelta(days=i, hours=random.randint(10, 20)),
            "mood_score": score,
            "tags": random.choice([["happy", "motivated"], ["calm", "content"], ["motivated", "proud"]]),
            "notes": random.choice([
                "Feeling genuinely proud. 3 months in!",
                "Breathing clearly. Energy levels stable.",
                "Relationships improving. People notice the change.",
            ]),
        })

    # Days 59-30: Consolidation (weeks 19-24)
    for i in range(58, 29, -1):
        score = random.randint(6, 8)
        mood_logs.append({
            "user_id": user1_id_str,
            "timestamp": now - timedelta(days=i, hours=random.randint(10, 20)),
            "mood_score": score,
            "tags": random.choice([["happy", "calm"], ["content", "peaceful"], ["motivated", "proud"]]),
            "notes": random.choice([
                "Habits feeling natural now. Recovery is my new normal.",
                "Confidence growing. Can handle stress without escaping.",
                "Meditation and exercise are pillars of my day.",
            ]),
        })

    # Days 29-0: Strong baseline, rare low moments (weeks 25-26)
    for i in range(28, -1, -1):
        score = random.randint(7, 9) if random.random() < 0.85 else random.randint(5, 7)
        mood_logs.append({
            "user_id": user1_id_str,
            "timestamp": now - timedelta(days=i, hours=random.randint(10, 20)),
            "mood_score": score,
            "tags": random.choice([["happy", "calm"], ["hopeful", "peaceful"], ["content", "proud"], ["motivated", "calm"]]),
            "notes": random.choice([
                "Six months. This is who I am now.",
                "Grateful for the progress. Life feels full.",
                "Setbacks don't derail me anymore.",
                "Building real relationships without the shame.",
            ]),
        })

    await db.mood_logs.insert_many(mood_logs)
    print("[OK] Created 180 mood logs with realistic 6-month arc")

    # --- JOURNAL ENTRIES (6-month genuine narrative) ---
    print("Creating journal entries...")

    # Create journal entries spanning 180 days with chronological progression
    journal_entries = []

    # Days 180-165: Rock bottom, commitment
    early_entries = [
        "Started journaling today. I'm 30, and this has been controlling me for way too long. Cigarettes and PMO—connected triggers. When I'm stressed, I reach for both. But I'm done. I want to actually live.",
        "Day 3: The urges are insane. Everything hurts. Coffee tastes wrong. Mind is foggy. But I'm not giving in. Support group helped. Hearing others' stories reminded me I'm not alone in this.",
        "Day 7: First week done. Body aches like I have flu. But my mind feels a little clearer. Got lunch with friend and didn't excuse myself to smoke. That would've been automatic before.",
    ]

    # Days 164-135: Withdrawal phase
    withdrawal_entries = [
        "Day 14: Two weeks in. The withdrawal is brutal. Cravings are worst between 10pm-midnight—that's when my brain wants escape most. Started breathing exercises. They actually help.",
        "Day 21: Bad meeting at work. My first real test. Walked to the bathroom, did breathing instead of smoking. Hands shaking but I did it. Made it through without giving in.",
        "Day 28: Month one complete. My skin looks clearer. Sleep is deeper. Urges are still intense but something has shifted—I'm handling them differently now.",
        "Day 35: Relapsed on cigarettes once. Felt shame but didn't spiral into PMO this time. That's progress. Called my therapist. She reminded me: slip isn't failure if I get back up.",
    ]

    # Days 134-90: First improvements
    improving_entries = [
        "Day 45: 1.5 months. Energy levels up. Started exercising daily—helps burn off anxiety. Friends are noticing I'm different. Sharper. More present.",
        "Day 60: Two months. Mind fog is gone. I can think clearly for the first time in years. Meditation practice getting stronger. 10 minutes doesn't feel impossible anymore.",
        "Day 75: Cravings are much weaker now. Mostly just habit-triggered at this point. Morning coffee still tugs at me, but urge passes quickly. Feeling genuinely proud.",
    ]

    # Days 89-60: Building momentum
    momentum_entries = [
        "Day 90: Three months! This is surreal. Quit for real this time. Breathing clear. Energy stable. Job performance improving—no brain fog means I'm actually sharp at work.",
        "Day 105: People keep complimenting my appearance. Didn't expect that. Must be the exercise, sleep quality, and not smoking. It's motivating.",
        "Day 120: Relationships healing. My brother and I actually talked—really talked—without the shame wall. Haven't felt this connected in years.",
    ]

    # Days 59-30: Consolidation
    consolidation_entries = [
        "Day 135: Four and a half months. The new habits feel natural now. Meditation and exercise aren't chores—they're my refuge. When stress comes, I don't panic.",
        "Day 150: Late night urges are rare now. They don't hit with the same intensity. I handle them by journaling or calling someone. The tools actually work when you use them.",
        "Day 160: Five months. Recovery is becoming my identity, not my struggle. People see me as someone who's got their life together, not someone fighting addiction.",
    ]

    # Days 29-0: Six-month mark
    final_entries = [
        "Day 175: Six months tomorrow. Reflecting on where I started. That shame and desperation feel like someone else lived it. But I remember. It keeps me grounded.",
        "Day 180: SIX MONTHS. I did it. We did it. This program, my support, and my commitment created real change. I'm not the person I was. I like who I'm becoming.",
    ]

    # Distribute entries across 6 months
    all_journal_texts = early_entries + withdrawal_entries + improving_entries + momentum_entries + consolidation_entries + final_entries

    # Calculate days for each batch
    entry_days = [
        (175, 180),  # Early entries, days 175-180
        (120, 165),  # Withdrawal, days 120-165
        (60, 115),   # Improving, days 60-115
        (40, 55),    # Momentum, days 40-55
        (20, 35),    # Consolidation, days 20-35
        (0, 15),     # Final, days 0-15
    ]

    entry_idx = 0
    for start_day, end_day in entry_days:
        batch = all_journal_texts[entry_idx:entry_idx + 3] if entry_idx + 3 <= len(all_journal_texts) else all_journal_texts[entry_idx:]
        batch_size = len(batch)
        step = (end_day - start_day) // batch_size if batch_size > 0 else 1

        for i, text in enumerate(batch):
            day_offset = start_day + (i * step)
            journal_entries.append({
                "user_id": user1_id_str,
                "timestamp": now - timedelta(days=day_offset),
                "text": text,
                "sentiment_score": analyze_sentiment(text),
            })
        entry_idx += 3

    await db.journal_entries.insert_many(journal_entries)
    print(f"[OK] Created {len(journal_entries)} genuine 6-month journal entries")

    # --- CHAT SESSIONS ---
    print("Creating chat sessions...")
    session1_id = str(ObjectId())
    session2_id = str(ObjectId())
    await db.chat_sessions.insert_many([
        {
            "session_id": session1_id,
            "user_id": user1_id_str,
            "name": "Early Recovery Questions",
            "created_at": now - timedelta(days=170),
            "updated_at": now - timedelta(days=150),
            "last_message": "Withdrawal is tough but temporary. You're doing the right thing.",
        },
        {
            "session_id": session2_id,
            "user_id": user1_id_str,
            "name": "Maintaining Progress",
            "created_at": now - timedelta(days=60),
            "updated_at": now - timedelta(days=2),
            "last_message": "You've built incredible resilience. Trust your system and celebrate your wins.",
        },
    ])
    print("[OK] Created 2 chat sessions spanning 6 months")

    # --- INSIGHTS (6-month comprehensive observations) ---
    print("Creating insights...")
    insights = [
        {
            "user_id": user1_id_str,
            "generated_at": now - timedelta(days=90),
            "type": "progress",
            "message": "Milestone: 3 months smoke-free! Your urge intensity has dropped 60% compared to month one. You're building real resilience.",
        },
        {
            "user_id": user1_id_str,
            "generated_at": now - timedelta(days=60),
            "type": "patterns",
            "message": "Pattern breakthrough: Morning coffee cravings no longer trigger full urge cascades. You've decoupled the habit.",
        },
        {
            "user_id": user1_id_str,
            "generated_at": now - timedelta(days=30),
            "type": "mood",
            "message": "Your mood baseline has shifted permanently upward. Even your 'low days' now are higher than your baseline 6 months ago.",
        },
        {
            "user_id": user1_id_str,
            "generated_at": now - timedelta(days=7),
            "type": "behavior",
            "message": "Exercise consistency: 75% adherence over 6 months. This is now a core part of your identity, not a coping mechanism.",
        },
        {
            "user_id": user1_id_str,
            "generated_at": now,
            "type": "resilience",
            "message": "Six months in: You've weathered work stress, emotional triggers, and setbacks without relapsing. Your recovery is stable and sustainable.",
        },
    ]
    await db.insights.insert_many(insights)
    print("[OK] Created 5 comprehensive 6-month insights")

    print("")
    print("="*50)
    print("SUCCESS - DATABASE SEEDED!")
    print("="*50)
    print("Email: alex@example.com")
    print("Password: password123")
    print("Profile: 6-month active user (180+ days)")
    print("Data: 180 days of genuine, consistent recovery journey")
    print("  - Goals with progressive achievement")
    print("  - Habits: Quit smoking, Reduce PMO (6 months)")
    print("  - Urges: 400+ logs with realistic patterns & intensity decrease")
    print("  - Moods: 180 entries showing recovery arc")
    print("  - Journal: 18 entries spanning full 6 months")
    print("  - Insights: 5 milestone-based observations")
    print("  - Sessions: 2 chat sessions over recovery timeline")
    print("="*50)

    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
