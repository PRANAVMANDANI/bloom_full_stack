"""MongoDB connection via Motor (async driver) for Atlas."""

import asyncio

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import AutoReconnect, ServerSelectionTimeoutError
import certifi
from app.config import settings

client: AsyncIOMotorClient = None
db = None

# How many times to retry the initial connect/index-creation before giving up.
_STARTUP_ATTEMPTS = 6


async def _create_indexes():
    """Create all indexes. Runs a write per call, so it must reach the primary."""
    await db.users.create_index("email", unique=True)
    await db.goals.create_index("user_id")
    await db.habits.create_index("user_id")
    await db.urge_logs.create_index("user_id")
    await db.urge_logs.create_index("habit_id")
    await db.mood_logs.create_index("user_id")
    await db.journal_entries.create_index("user_id")
    await db.chat_messages.create_index("user_id")
    await db.chat_messages.create_index("session_id")
    await db.insights.create_index("user_id")


async def connect_to_mongo():
    """Initialize the Motor client and connect to MongoDB Atlas.

    On Python 3.14 / OpenSSL 3.0.20, the TLS handshake to individual Atlas
    replica-set nodes intermittently fails with "TLSV1_ALERT_INTERNAL_ERROR".
    A single failed handshake to a node can crash startup, so we retry the
    initial ping + index creation a few times; each retry re-establishes pool
    sockets and usually lands on a healthy node. (retryReads/retryWrites then
    cover the same blips during normal request handling.)
    """
    global client, db
    client = AsyncIOMotorClient(
        settings.MONGODB_URL,
        tlsCAFile=certifi.where(),
        # Skip only the OCSP endpoint revocation call (keeps full cert-chain and
        # hostname verification). Reduces handshake fragility on this OpenSSL build.
        tlsDisableOCSPEndpointCheck=True,
        serverSelectionTimeoutMS=30000,
        connectTimeoutMS=30000,
        socketTimeoutMS=30000,
        retryReads=True,
        retryWrites=True,
        maxPoolSize=50,
        minPoolSize=0,
        heartbeatFrequencyMS=10000,
    )
    db = client[settings.DATABASE_NAME]

    last_error = None
    for attempt in range(1, _STARTUP_ATTEMPTS + 1):
        try:
            await client.admin.command("ping")
            await _create_indexes()
            # Plain ASCII: emoji can crash Windows consoles using cp1252 encoding
            print(f"[OK] Connected to MongoDB Atlas (attempt {attempt})")
            return
        except (AutoReconnect, ServerSelectionTimeoutError) as e:
            last_error = e
            print(f"[WARN] MongoDB connect attempt {attempt}/{_STARTUP_ATTEMPTS} "
                  f"failed ({type(e).__name__}); retrying...")
            await asyncio.sleep(1.5)

    # Exhausted retries — surface the real error so startup fails loudly.
    raise RuntimeError(
        f"Could not establish a MongoDB connection after {_STARTUP_ATTEMPTS} attempts. "
        f"Last error: {last_error}"
    )


async def close_mongo_connection():
    """Close the Motor client."""
    global client
    if client:
        client.close()
        print("[OK] MongoDB connection closed")


def get_database():
    """Return the database instance."""
    return db
