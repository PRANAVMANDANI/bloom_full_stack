"""Integration tests for the signup -> verify-otp -> login flow.

Runs against the real FastAPI app with an in-memory mongomock database
(see conftest.py). BREVO_API_KEY is unset in tests, so OTP emails are
logged to the console instead of sent over the network.
"""

from datetime import datetime, timezone

import pytest

pytestmark = pytest.mark.asyncio


async def _signup(client, email="new@example.com", password="password123"):
    return await client.post(
        "/api/auth/signup",
        json={"name": "Test User", "email": email, "password": password},
    )


async def test_signup_creates_unverified_user(client, test_db):
    resp = await _signup(client)
    assert resp.status_code == 201

    user = await test_db.users.find_one({"email": "new@example.com"})
    assert user is not None
    assert user["email_verified"] is False
    assert "otp_hash" in user


async def test_signup_duplicate_verified_email_is_rejected(client, test_db):
    await test_db.users.insert_one(
        {"email": "taken@example.com", "email_verified": True, "token_version": 0}
    )
    resp = await _signup(client, email="taken@example.com")
    assert resp.status_code == 409


async def test_login_before_verification_is_blocked(client, test_db):
    await _signup(client, email="unverified@example.com")
    resp = await client.post(
        "/api/auth/login",
        json={"email": "unverified@example.com", "password": "password123"},
    )
    assert resp.status_code == 403


async def test_login_with_wrong_password_is_rejected(client, test_db):
    from app.auth.hashing import hash_password

    await test_db.users.insert_one(
        {
            "email": "someone@example.com",
            "password_hash": hash_password("correct-password"),
            "email_verified": True,
            "token_version": 0,
            "name": "Someone",
            "created_at": datetime.now(timezone.utc),
        }
    )
    resp = await client.post(
        "/api/auth/login",
        json={"email": "someone@example.com", "password": "wrong-password"},
    )
    assert resp.status_code == 401


async def test_login_success_returns_token_pair(client, test_db):
    from app.auth.hashing import hash_password

    await test_db.users.insert_one(
        {
            "email": "verified@example.com",
            "password_hash": hash_password("password123"),
            "email_verified": True,
            "token_version": 0,
            "name": "Verified User",
            "created_at": datetime.now(timezone.utc),
        }
    )
    resp = await client.post(
        "/api/auth/login",
        json={"email": "verified@example.com", "password": "password123"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["user"]["email"] == "verified@example.com"


async def test_me_requires_authentication(client):
    resp = await client.get("/api/auth/me")
    assert resp.status_code in (401, 403)


async def test_me_with_valid_token(client, test_db):
    from app.auth.hashing import hash_password

    result = await test_db.users.insert_one(
        {
            "email": "me@example.com",
            "password_hash": hash_password("password123"),
            "email_verified": True,
            "token_version": 0,
            "name": "Me",
            "created_at": datetime.now(timezone.utc),
        }
    )
    login_resp = await client.post(
        "/api/auth/login",
        json={"email": "me@example.com", "password": "password123"},
    )
    access_token = login_resp.json()["access_token"]

    resp = await client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {access_token}"}
    )
    assert resp.status_code == 200
    assert resp.json()["email"] == "me@example.com"
