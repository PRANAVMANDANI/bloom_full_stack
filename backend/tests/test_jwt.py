"""Unit tests for JWT token creation, verification, and type/version enforcement."""

import pytest

from app.auth.jwt import (
    create_access_token,
    create_refresh_token,
    create_token_pair,
    verify_token,
)


def test_access_token_round_trip():
    token = create_access_token({"sub": "user123"})
    payload = verify_token(token, token_type="access")
    assert payload is not None
    assert payload["sub"] == "user123"
    assert payload["type"] == "access"


def test_refresh_token_rejected_as_access_token():
    token = create_refresh_token({"sub": "user123"})
    assert verify_token(token, token_type="access") is None


def test_garbage_token_is_rejected():
    assert verify_token("not-a-real-token", token_type="access") is None


def test_token_pair_carries_email_and_version():
    user = {"_id": "abc123", "email": "a@example.com", "token_version": 2}
    access, refresh = create_token_pair(user)

    access_payload = verify_token(access, token_type="access")
    refresh_payload = verify_token(refresh, token_type="refresh")

    assert access_payload["email"] == "a@example.com"
    assert access_payload["token_version"] == 2
    assert refresh_payload["sub"] == "abc123"
