"""Seed script: populate MongoDB with sample data for local testing."""

import asyncio
from datetime import datetime, timezone, timedelta, date
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import random
import sys
import os

# Add parent dir to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config import settings
from app.auth.hashing import hash_password


async def seed():
    """Seed the database with sample users and 30 days of realistic data."""
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]

    # Clear existing data
    print("[CLEAR] Clearing existing data...")
    for collection in ["users", "goals", "habits", "urge_logs", "mood_logs",
                       "journal_entries", "chat_messages", "insights"]:
        await db[collection].delete_many({})

    now = datetime.now(timezone.utc)

    # --- Users ---
    print("[USERS] Creating users...")
    user1_id = ObjectId()
    user2_id = ObjectId()

    users = [
        {
            "_id": user1_id,
            "email": "alex@example.com",
            "name": "Alex",
            "password_hash": hash_password("password123"),
            "auth_provider": "password",
            "email_verified": True,
            "created_at": now - timedelta(days=45),
            "preferences": {},
            "token_version": 0,
        },
        {
            "_id": user2_id,
            "email": "sam@example.com",
            "name": "Sam",
            "password_hash": hash_password("password123"),
            "auth_provider": "password",
            "email_verified": True,
            "created_at": now - timedelta(days=30),
            "preferences": {},
            "token_version": 0,
        },
    ]
    await db.users.insert_many(users)

    # --- Goals for User 1 ---
    print("[GOALS] Creating goals...")
    goal1_id = ObjectId()
    goal2_id = ObjectId()
    goal3_id = ObjectId()

    # Generate completed dates (realistic — not every day)
    def generate_completed_dates(days_back=30, hit_rate=0.7):
        dates = []
        for i in range(days_back):
            if random.random() < hit_rate:
                d = (date.today() - timedelta(days=i)).isoformat()
                dates.append(d)
        return dates

    goals = [
        {
            "_id": goal1_id,
            "user_id": user1_id,
            "title": "Meditate for 10 minutes",
            "frequency": "daily",
            "completed_dates": generate_completed_dates(30, 0.8),
            "created_at": now - timedelta(days=30),
        },
        {
            "_id": goal2_id,
            "user_id": user1_id,
            "title": "Go for a walk",
            "frequency": "daily",
            "completed_dates": generate_completed_dates(30, 0.6),
            "created_at": now - timedelta(days=25),
        },
        {
            "_id": goal3_id,
            "user_id": user1_id,
            "title": "Read for 20 minutes",
            "frequency": "daily",
            "completed_dates": generate_completed_dates(30, 0.5),
            "created_at": now - timedelta(days=20),
        },
    ]
    await db.goals.insert_many(goals)

    # --- Habits for User 1 ---
    print("[HABITS] Creating habits...")
    habit1_id = ObjectId()
    habit2_id = ObjectId()

    habits = [
        {
            "_id": habit1_id,
            "user_id": user1_id,
            "name": "Quit smoking",
            "type": "quit",
            "start_date": now - timedelta(days=22),
        },
        {
            "_id": habit2_id,
            "user_id": user1_id,
            "name": "Reduce social media",
            "type": "reduce",
            "start_date": now - timedelta(days=15),
        },
    ]
    await db.habits.insert_many(habits)

    # --- Urge Logs ---
    print("[URGES] Creating urge logs...")
    triggers = ["stress", "boredom", "social", "anxiety", "habit", "after meals", "morning coffee"]
    urge_logs = []
    for i in range(40):
        urge_logs.append({
            "user_id": user1_id,
            "habit_id": str(habit1_id),
            "timestamp": now - timedelta(days=random.randint(0, 30), hours=random.randint(0, 23)),
            "intensity": random.randint(2, 9),
            "trigger_tags": random.sample(triggers, k=random.randint(1, 3)),
            "notes": random.choice([
                "Felt a strong craving after coffee",
                "Stress from work triggered it",
                "Was fine until I saw someone smoking",
                "Just a mild urge, managed to distract myself",
                None,
            ]),
        })
    await db.urge_logs.insert_many(urge_logs)

    # --- Mood Logs ---
    print("[MOOD] Creating mood logs...")
    mood_tags = ["happy", "anxious", "tired", "motivated", "calm", "stressed", "grateful", "lonely"]
    mood_logs = []
    # Generate a somewhat realistic mood pattern (gradually improving)
    base_mood = 4
    for i in range(30, -1, -1):
        improvement = (30 - i) * 0.08  # Gradual improvement
        score = min(10, max(1, int(base_mood + improvement + random.uniform(-1.5, 1.5))))
        mood_logs.append({
            "user_id": user1_id,
            "timestamp": now - timedelta(days=i, hours=random.randint(8, 12)),
            "mood_score": score,
            "tags": random.sample(mood_tags, k=random.randint(1, 3)),
            "notes": random.choice([
                "Feeling pretty good today",
                "Had a rough morning but got better",
                "Grateful for small wins",
                "Struggling a bit but pushing through",
                None,
                None,
            ]),
        })
    await db.mood_logs.insert_many(mood_logs)

    # --- Journal Entries ---
    print("[JOURNAL] Creating journal entries...")
    journal_texts = [
        "Today was a good day. I managed to resist the urge to smoke after lunch. Went for a walk instead and felt so much better. Small wins matter.",
        "Feeling a bit down today. The cravings were intense in the morning. But I made it through. Tomorrow is a new day.",
        "Had a great conversation with my friend about my recovery journey. It felt good to be open about it. They were really supportive.",
        "Meditation this morning was wonderful. I feel more centered and calm. I'm starting to see how these small daily habits are adding up.",
        "Tough day at work. Stress levels were high and I almost gave in. But I called a friend instead. Proud of that choice.",
        "I've been sleeping better lately. I think the evening walks and less screen time are helping. My body is healing.",
        "Wrote a letter to my future self today. It was emotional but therapeutic. I want to read it again in 6 months.",
        "Three weeks without smoking! It doesn't feel like much but it's the longest I've gone in years. Every day counts.",
        "Feeling grateful today. For my health, for the people in my life, for having the courage to change.",
        "Some days are harder than others. Today was one of those. But I'm still here, still trying, and that matters.",
    ]

    from app.services.sentiment import analyze_sentiment

    journal_entries = []
    for i in range(15):
        text = random.choice(journal_texts)
        journal_entries.append({
            "user_id": user1_id,
            "timestamp": now - timedelta(days=random.randint(0, 30)),
            "text": text,
            "sentiment_score": analyze_sentiment(text),
        })
    await db.journal_entries.insert_many(journal_entries)

    # --- Chat Messages ---
    print("[CHAT] Creating chat messages...")
    session_id = "seed-session-001"
    chat_messages = [
        {
            "user_id": user1_id,
            "session_id": session_id,
            "role": "user",
            "text": "Hi, I'm having a tough day today.",
            "timestamp": now - timedelta(hours=5),
        },
        {
            "user_id": user1_id,
            "session_id": session_id,
            "role": "assistant",
            "text": "I'm here for you. Tough days are part of the journey, and it takes real courage to reach out. Would you like to tell me more about what's going on? 🌱",
            "timestamp": now - timedelta(hours=5, minutes=-1),
        },
        {
            "user_id": user1_id,
            "session_id": session_id,
            "role": "user",
            "text": "The cravings are really bad today. I almost bought a pack of cigarettes.",
            "timestamp": now - timedelta(hours=4, minutes=50),
        },
        {
            "user_id": user1_id,
            "session_id": session_id,
            "role": "assistant",
            "text": "I can hear how hard that was. But notice something important — you said 'almost.' You didn't buy them. That moment of resistance? That's your strength showing up. What helped you walk away?",
            "timestamp": now - timedelta(hours=4, minutes=49),
        },
    ]
    await db.chat_messages.insert_many(chat_messages)

    # --- Insights ---
    print("[INSIGHTS] Creating sample insights...")
    insights = [
        {
            "user_id": user1_id,
            "generated_at": now - timedelta(hours=6),
            "type": "mood",
            "message": "🌟 Your mood has been trending upward! Your recent average is 6.2/10, up from 4.8/10 earlier. Keep nurturing what's working for you.",
        },
        {
            "user_id": user1_id,
            "generated_at": now - timedelta(hours=6),
            "type": "goals",
            "message": "🎯 Amazing! You've completed 73% of your daily goals this month. Your consistency is really paying off!",
        },
        {
            "user_id": user1_id,
            "generated_at": now - timedelta(hours=6),
            "type": "urges",
            "message": "📊 Your urges tend to peak in the afternoon (12pm-6pm) with an average intensity of 5.3/10. Knowing your patterns is powerful — try preparing a coping strategy for those times.",
        },
        {
            "user_id": user1_id,
            "generated_at": now - timedelta(hours=6),
            "type": "sentiment",
            "message": "📝 Your journal entries carry a positive tone overall. Writing is clearly a healthy outlet for you — keep it up!",
        },
        {
            "user_id": user1_id,
            "generated_at": now - timedelta(hours=6),
            "type": "general",
            "message": "🌸 Remember: growth isn't always visible. Like roots growing underground before a flower blooms, your daily efforts are building a foundation for lasting change.",
        },
    ]
    await db.insights.insert_many(insights)

    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.goals.create_index("user_id")
    await db.habits.create_index("user_id")
    await db.urge_logs.create_index("user_id")
    await db.mood_logs.create_index("user_id")
    await db.journal_entries.create_index("user_id")
    await db.chat_messages.create_index("user_id")
    await db.insights.create_index("user_id")

    print("\n[OK] Database seeded successfully!")
    print("   User 1: alex@example.com / password123")
    print("   User 2: sam@example.com / password123")
    print("   30 days of mood, goals, habits, urges, journal, chat, insights")

    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
