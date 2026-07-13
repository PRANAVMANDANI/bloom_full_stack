"""Shared pytest fixtures: an in-memory Mongo (mongomock) and an ASGI test client.

The app talks to Mongo through ``app.database.db``, a module-level global set
by ``connect_to_mongo()`` at startup. Tests never run the real lifespan (no
Atlas connection available in CI), so each test swaps that global for a fresh
mongomock database instead — same interface (Motor-compatible), no network.
"""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient

import app.database as database


@pytest_asyncio.fixture
async def test_db():
    mock_client = AsyncMongoMockClient()
    db = mock_client["bloom_test"]
    database.db = db
    yield db
    database.db = None


@pytest_asyncio.fixture
async def client(test_db):
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
