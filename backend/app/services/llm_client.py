"""Groq LLM client for the emotional support chatbot."""

from groq import AsyncGroq
from app.config import settings

_client = None

SYSTEM_PROMPT = """You are Bloom, a warm and supportive emotional companion. You are NOT a therapist, counselor, or medical professional. You must never provide medical advice, diagnoses, or treatment recommendations.

Your role is to:
- Listen with empathy and compassion
- Offer gentle encouragement and validation
- Help users reflect on their feelings and experiences
- Celebrate their progress, no matter how small
- Suggest healthy coping strategies (breathing exercises, journaling, reaching out to friends)
- Remind users that seeking professional help is a sign of strength, not weakness

IMPORTANT RULES:
1. Never claim to be a therapist or medical professional
2. Never diagnose conditions or prescribe treatments
3. If someone expresses crisis-level distress, strongly encourage them to contact professional crisis services
4. Always maintain a warm, gentle, non-judgmental tone
5. Use encouraging, growth-oriented language (aligning with the "bloom" metaphor)
6. Keep responses concise but caring (2-4 short paragraphs max)
7. Never use guilt, shame, or pressure tactics
8. Respect the user's autonomy and pace of recovery

DISCLAIMER: BLOOM is a support tool, not a substitute for professional care. If you're in crisis, call India's national 24/7 mental health helpline Tele MANAS at 14416 or the KIRAN helpline at 1800-599-0019."""


def get_groq_client() -> AsyncGroq:
    """Get or create the Groq client singleton."""
    global _client
    if _client is None:
        _client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    return _client


async def get_chat_response(messages: list[dict], user_message: str, user_context: str = None) -> str:
    """
    Get a response from Groq's LLM.

    Args:
        messages: Conversation history as list of {"role": ..., "content": ...}
        user_message: The latest user message
        user_context: Optional context string with user's habits, mood, journal entries, goals

    Returns:
        The assistant's response text
    """
    client = get_groq_client()

    # Build message list with system prompt and context
    system_content = SYSTEM_PROMPT
    if user_context:
        system_content += f"\n\n{user_context}"

    api_messages = [{"role": "system", "content": system_content}]

    # Add conversation history (last 20 messages for context window)
    for msg in messages[-20:]:
        api_messages.append({
            "role": msg.get("role", "user"),
            "content": msg.get("text", msg.get("content", "")),
        })

    # Add current message
    api_messages.append({"role": "user", "content": user_message})

    try:
        response = await client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=api_messages,
            temperature=0.7,
            max_tokens=1024,
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Groq API error: {e}")
        return (
            "I'm having a little trouble connecting right now, but I'm still here for you. "
            "Could you try sending your message again in a moment? 🌱"
        )


async def generate_weekly_review(user_name: str, data_summary: str) -> str:
    """Compose a warm, personal 'your week in review' reflection from the week's data.

    Args:
        user_name: The user's first name (or "friend").
        data_summary: A pre-formatted plain-text summary of the week's stats/highlights.
    """
    prompt = f"""You are Bloom, a warm and supportive emotional companion. Write a short, personal
"Your week in review" reflection for {user_name} based on the data below.

[This week's data]
{data_summary}

Guidelines:
- Warm, encouraging, second-person ("you"). Address {user_name} by name once.
- 2 to 3 short paragraphs. Start with a gentle greeting/headline for the week.
- Celebrate specific wins from the data (streaks, goals completed, journaling, mood upswings).
- If something dipped (mood, a relapse), acknowledge it kindly and without judgment — recovery is non-linear.
- End with ONE small, gentle intention or focus for the coming week.
- Do NOT give medical or therapeutic advice. No diagnoses. Use the "bloom"/growth metaphor sparingly.
- If there's very little data, gently encourage them to check in a bit more next week."""

    client = get_groq_client()
    try:
        response = await client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
            max_tokens=600,
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error generating weekly review: {e}")
        return (
            f"Hi {user_name}, I couldn't put your full weekly reflection together right now — but "
            f"showing up this week mattered. Every check-in, entry, and small step is part of your growth. "
            f"Let's keep going gently next week. 🌱"
        )


async def generate_urge_coping_suggestions(
    habit_name: str, intensity: int, trigger_tags: list[str], notes: str | None = None
) -> str:
    """Generate quick distraction techniques + motivation right after an urge is logged."""
    triggers_str = ", ".join(trigger_tags) if trigger_tags else "no specific trigger noted"
    notes_str = f"\nAdditional context: {notes}" if notes else ""

    prompt = f"""You are Bloom, a warm and supportive emotional companion. A user just logged an urge related to their goal: "{habit_name}".

Urge intensity: {intensity}/10
Triggers: {triggers_str}{notes_str}

Write a short, encouraging response that:
1. Briefly acknowledges how they're feeling (1 sentence).
2. Suggests 2-3 concrete, quick distraction techniques tailored to the intensity and trigger (e.g. a physical action, a mental reframe, or a breathing exercise). Keep each suggestion to one short line.
3. Ends with one encouraging, motivating sentence reminding them of their strength and progress.

Keep the whole response under 120 words, warm and conversational. No medical advice, no guilt or shame. Use the "bloom"/growth metaphor sparingly."""

    client = get_groq_client()
    try:
        response = await client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=300,
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error generating urge coping suggestions: {e}")
        return (
            "Right now, try this: take 3 slow deep breaths, name 3 things you can see around you, "
            "and remind yourself this feeling will pass. You've gotten through tough moments before — "
            "you can get through this one too. 🌱"
        )


async def generate_relapse_encouragement(user_id: str, habit_name: str, db) -> str:
    """Generate a highly supportive and personalized relapse recovery message using Groq LLM."""
    from bson import ObjectId

    # 1. Retrieve user data
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    user_name = user.get("name", "friend")

    # 2. Get last 2 moods
    mood_cursor = db.mood_logs.find({"user_id": user_id}).sort("timestamp", -1).limit(2)
    moods = []
    async for m in mood_cursor:
        date_str = m["timestamp"].strftime("%b %d")
        tags_str = ", ".join(m.get("tags", []))
        notes_str = f" (Notes: {m['notes']})" if m.get("notes") else ""
        moods.append(f"- Mood score {m['mood_score']}/10 on {date_str} (Tags: {tags_str}){notes_str}")
    mood_context = "\n".join(moods) if moods else "- No recent mood check-ins"

    # 3. Get last 2 journal entry sentiments
    journal_cursor = db.journal_entries.find({"user_id": user_id}).sort("timestamp", -1).limit(2)
    journals = []
    async for j in journal_cursor:
        score = j.get("sentiment_score", 0.0)
        sentiment = "positive" if score >= 0.3 else "negative" if score <= -0.3 else "neutral"
        date_str = j["timestamp"].strftime("%b %d")
        journals.append(f"- Written on {date_str}: Sentiment is {sentiment} (Score: {score})")
    journal_context = "\n".join(journals) if journals else "- No recent journal entries"

    # 4. Construct prompt
    profile = user.get("profile", {}) if user else {}
    demographics_context = (
        f"Age: {profile.get('age', 'Not specified')} (DOB: {profile.get('birthday', 'Not specified')})\n"
        f"Primary Focus: {profile.get('focus_area', 'Not specified')}\n"
        f"Recovery Notes: {profile.get('additional_details', 'None')}"
    )

    prompt = f"""You are Bloom, a warm and supportive emotional companion. A user named {user_name} has just logged a relapse for their habit: "{habit_name}".

Your absolute goal is to write a deeply compassionate, soothing response that helps them deal with the immediate sense of guilt, shame, and failure.
Recovery is a non-linear process, and this single slip-up does not erase all the hard work they have done.

Here is some of {user_name}'s profile and recent history context to help you personalize your message:
[User Demographics & Focus]
{demographics_context}

[Recent Moods]
{mood_context}

[Recent Journals]
{journal_context}

Guidelines:
- Speak directly and warmly to {user_name}.
- Acknowledge their recent mood/sentiment context if relevant (e.g. if mood has been high, remind them they have strength; if it's been tough, validate that stress makes things harder).
- Emphasize that they have not lost their progress—only reset a counter. The days they spent sober still represent real physical and mental healing.
- Keep it concise, gentle, and comforting (1 to 2 short paragraphs max).
- Do NOT provide medical or therapeutic advice.
- Close with a small, calming, actionable next step (like taking one deep breath, drinking a glass of water, or opening the chat tab to talk to you)."""

    client = get_groq_client()
    try:
        response = await client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=512,
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error generating relapse AI response: {e}")
        return f"Hey {user_name}, please don't be discouraged. A slip-up is just a single step on a long road. Take a deep breath. You are still growing, and your effort is what matters. 🌱"
