"""WebSocket chat handler with Groq LLM and crisis detection."""

import json
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone, date
from fastapi import WebSocket, WebSocketDisconnect
from bson import ObjectId

from app.auth.jwt import verify_token
from app.database import get_database
from app.origin_check import is_allowed_origin
from app.services.llm_client import get_chat_response
from app.services.crisis_detector import detect_crisis, CRISIS_RESOURCES
from app.services.journal_query import retrieve_journals_context
from app.routes.goals import goal_doc_to_out
from app.routes.habits import compute_sobriety_days, habit_doc_to_out


# --- Per-user chat rate limiting ---------------------------------------------
# Each LLM turn costs a Groq call, so cap how fast a single user can send.
# Sliding window kept in memory (single-process deployment).
_CHAT_MAX_MESSAGES = 15
_CHAT_WINDOW_SECONDS = 60
_chat_hits: dict[str, deque] = defaultdict(deque)


def _chat_rate_limited(user_id: str) -> bool:
    """Return True if the user has exceeded the per-minute message allowance."""
    now = time.monotonic()
    hits = _chat_hits[user_id]
    while hits and now - hits[0] > _CHAT_WINDOW_SECONDS:
        hits.popleft()
    if len(hits) >= _CHAT_MAX_MESSAGES:
        return True
    hits.append(now)
    return False


async def build_user_context_string(db, user_id: str) -> str:
    """Query MongoDB for recent user history and format it for LLM ingestion."""
    # 1. Goals
    goals_cursor = db.goals.find({"user_id": user_id})
    goals = []
    async for doc in goals_cursor:
        goals.append(goal_doc_to_out(doc))

    # 2. Habits & Sobriety
    habits_cursor = db.habits.find({"user_id": user_id})
    habits = []
    async for doc in habits_cursor:
        sobriety = await compute_sobriety_days(db, doc)
        habits.append(habit_doc_to_out(doc, sobriety))

    # 3. Mood logs (last 3 entries)
    mood_cursor = db.mood_logs.find({"user_id": user_id}).sort("timestamp", -1).limit(3)
    moods = []
    async for doc in mood_cursor:
        moods.append(doc)

    # 4. Journal entries (last 10 entries)
    journal_cursor = db.journal_entries.find({"user_id": user_id}).sort("timestamp", -1).limit(10)
    journals = []
    async for doc in journal_cursor:
        journals.append(doc)

    # 5. Format to markdown string
    lines = ["[USER RECOVERY PROFILE & HISTORY]"]

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if user and user.get("profile"):
        profile = user["profile"]
        lines.append("- Demographic Profile:")
        lines.append(f"  * Name: {user.get('name', 'Friend')}")
        lines.append(f"  * Age: {profile.get('age', 'Not specified')} (DOB: {profile.get('birthday', 'Not specified')})")
        lines.append(f"  * Primary Focus: {profile.get('focus_area', 'Not specified')}")
        if profile.get("additional_details"):
            lines.append(f"  * Recovery Notes: {profile.get('additional_details')}")

    # Active Goals
    lines.append("- Active Goals:")
    if not goals:
        lines.append("  * None set yet")
    for g in goals:
        completed = "Yes" if g.completed_today else "No"
        lines.append(f"  * \"{g.title}\" (Completed Today: {completed}, Streak: {g.streak} days, Frequency: {g.frequency})")

    # Habits
    lines.append("- Sobriety Streaks:")
    if not habits:
        lines.append("  * None set yet")
    for h in habits:
        lines.append(f"  * \"{h.name}\": {h.sobriety_days} days strong ({h.type})")

    # Moods
    lines.append("- Recent Mood Check-ins:")
    if not moods:
        lines.append("  * None logged yet")
    for m in moods:
        date_str = m["timestamp"].strftime("%b %d")
        tags_str = ", ".join(m.get("tags", [])) or "no tags"
        notes_str = f" - \"{m['notes']}\"" if m.get("notes") else ""
        lines.append(f"  * {date_str}: {m['mood_score']}/10 ({tags_str}){notes_str}")

    # Journals
    lines.append("- Recent Journal Entries:")
    if not journals:
        lines.append("  * None written yet")
    for j in journals:
        date_str = j["timestamp"].strftime("%b %d")
        score = j.get("sentiment_score", 0.0)
        sentiment_label = "Positive" if score >= 0.3 else "Negative" if score <= -0.3 else "Neutral"
        snippet = j["text"][:120] + "..." if len(j["text"]) > 120 else j["text"]
        lines.append(f"  * {date_str}: {sentiment_label} (Sentiment Score: {score}) - \"{snippet}\"")

    return "\n".join(lines)


async def prune_chat_messages(db, user_id: str, session_id: str):
    """Keep only the last 20 messages for the given chat session to minimize space use."""
    count = await db.chat_messages.count_documents({"user_id": user_id, "session_id": session_id})
    if count > 20:
        # Find the 20th most recent message's timestamp
        cursor = (
            db.chat_messages.find({"user_id": user_id, "session_id": session_id})
            .sort("timestamp", -1)
            .skip(20)
            .limit(1)
        )
        oldest_to_keep = None
        async for msg in cursor:
            oldest_to_keep = msg["timestamp"]

        if oldest_to_keep:
            # Delete any message that is older than or equal to this timestamp
            await db.chat_messages.delete_many({
                "user_id": user_id,
                "session_id": session_id,
                "timestamp": {"$lte": oldest_to_keep}
            })


async def chat_websocket_handler(websocket: WebSocket):
    """
    Handle a WebSocket chat connection.

    Protocol:
    1. Client sends first message with: {"type": "auth", "token": "<jwt>"}
    2. Server authenticates and responds with: {"type": "auth_ok", "session_id": "..."}
    3. Client sends messages: {"type": "message", "text": "..."}
    4. Server responds with: {"type": "response", "text": "...", "crisis": false}
    """
    # Starlette doesn't apply CORSMiddleware to WebSocket upgrades, so the
    # Origin header is checked manually against the same allow-list as HTTP.
    # (This isn't a token-theft defense — a stored JWT is only readable by
    # same-origin JS anyway — but it stops arbitrary pages from opening
    # connections against this endpoint.)
    origin = websocket.headers.get("origin")
    if origin is not None and not is_allowed_origin(origin):
        await websocket.close(code=1008)  # policy violation
        return

    await websocket.accept()

    user_id = None
    session_id = str(uuid.uuid4())

    try:
        # Step 1: Authentication
        auth_data = await websocket.receive_text()
        auth_msg = json.loads(auth_data)

        if auth_msg.get("type") != "auth":
            await websocket.send_json({"type": "error", "text": "First message must be auth"})
            await websocket.close()
            return

        token = auth_msg.get("token", "")
        payload = verify_token(token, token_type="access")
        if not payload:
            await websocket.send_json({"type": "error", "text": "Invalid token"})
            await websocket.close()
            return

        user_id = payload["sub"]

        # Restore session if provided
        if auth_msg.get("session_id"):
            session_id = auth_msg["session_id"]

        db = get_database()

        # Ensure session document exists
        session_exists = await db.chat_sessions.find_one({"session_id": session_id})
        if not session_exists:
            await db.chat_sessions.insert_one({
                "session_id": session_id,
                "user_id": user_id,
                "name": "New Conversation",
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
                "last_message": "New conversation 🌱",
            })

        # Load conversation history for context (last 20 messages)
        history_cursor = (
            db.chat_messages.find({"user_id": user_id, "session_id": session_id})
            .sort("timestamp", 1)
            .limit(20)
        )
        conversation_history = []
        async for msg in history_cursor:
            conversation_history.append({
                "role": msg["role"],
                "text": msg["text"],
            })

        await websocket.send_json({
            "type": "auth_ok",
            "session_id": session_id,
            "history": conversation_history,
        })

        # Step 2: Message loop
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)

            if data.get("type") != "message":
                continue

            user_text = data.get("text", "").strip()
            if not user_text:
                continue

            # Per-user rate limit (protects the Groq quota from abuse/runaways).
            if _chat_rate_limited(user_id):
                await websocket.send_json({
                    "type": "error",
                    "text": "You're sending messages a little too fast. Take a breath 🌱 and try again in a moment.",
                })
                continue

            # Save user message
            user_msg_doc = {
                "user_id": user_id,
                "session_id": session_id,
                "role": "user",
                "text": user_text,
                "timestamp": datetime.now(timezone.utc),
            }
            await db.chat_messages.insert_one(user_msg_doc)

            # Update session last message and timestamp
            await db.chat_sessions.update_one(
                {"session_id": session_id},
                {
                    "$set": {
                        "updated_at": datetime.now(timezone.utc),
                        "last_message": user_text
                    }
                }
            )

            # Crisis detection
            crisis_result = detect_crisis(user_text)
            if crisis_result.is_crisis:
                # Send crisis resources IMMEDIATELY
                crisis_msg = {
                    "user_id": user_id,
                    "session_id": session_id,
                    "role": "system",
                    "text": CRISIS_RESOURCES,
                    "timestamp": datetime.now(timezone.utc),
                }
                await db.chat_messages.insert_one(crisis_msg)
                await websocket.send_json({
                    "type": "crisis",
                    "text": CRISIS_RESOURCES,
                })

            # Get latest user context (goals, habits, mood, recent journals)
            user_context = await build_user_context_string(db, user_id)

            # If the user referenced a specific month/day, pull the journal entries
            # from that period so the LLM can recall what actually happened then.
            retrieved_journals = await retrieve_journals_context(db, user_id, user_text)
            if retrieved_journals:
                user_context += "\n\n" + retrieved_journals

            # Get LLM response
            conversation_history.append({"role": "user", "text": user_text})

            assistant_text = await get_chat_response(conversation_history, user_text, user_context=user_context)

            # Save assistant response
            assistant_msg_doc = {
                "user_id": user_id,
                "session_id": session_id,
                "role": "assistant",
                "text": assistant_text,
                "timestamp": datetime.now(timezone.utc),
            }
            await db.chat_messages.insert_one(assistant_msg_doc)

            # Update session last message and timestamp
            await db.chat_sessions.update_one(
                {"session_id": session_id},
                {
                    "$set": {
                        "updated_at": datetime.now(timezone.utc),
                        "last_message": assistant_text
                    }
                }
            )

            # Prune messages to keep only the latest 20
            await prune_chat_messages(db, user_id, session_id)

            conversation_history.append({"role": "assistant", "text": assistant_text})

            await websocket.send_json({
                "type": "response",
                "text": assistant_text,
                "crisis": crisis_result.is_crisis,
            })

    except WebSocketDisconnect:
        print(f"WebSocket disconnected for user {user_id}")
    except json.JSONDecodeError:
        await websocket.send_json({"type": "error", "text": "Invalid JSON"})
        await websocket.close()
    except Exception as e:
        print(f"WebSocket error: {e}")
        try:
            await websocket.send_json({"type": "error", "text": "An unexpected error occurred"})
            await websocket.close()
        except Exception:
            pass
