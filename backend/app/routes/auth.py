"""Authentication routes: signup, OTP verification, login, refresh, Google OAuth."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from datetime import datetime, timezone
from bson import ObjectId

from app.database import get_database
from app.rate_limit import limiter
from app.auth.hashing import hash_password, verify_password
from app.auth.otp import new_otp_fields, otp_matches, MAX_ATTEMPTS
from app.auth.jwt import (
    create_token_pair,
    verify_token,
    create_password_reset_token,
)
from app.auth.dependencies import get_current_user
from app.services.google_auth import verify_google_credential, GoogleAuthError
from app.services.email_sender import send_otp_email, send_password_reset_email
from app.models.user import (
    UserCreate,
    UserLogin,
    TokenResponse,
    UserOut,
    RefreshRequest,
    GoogleAuthRequest,
    VerifyOtpRequest,
    ResendVerificationRequest,
    SignupResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

_OTP_FIELDS = ["otp_hash", "otp_expires_at", "otp_attempts"]


def _user_out(user: dict) -> UserOut:
    """Build the public UserOut view from a user document."""
    return UserOut(
        id=str(user["_id"]),
        email=user["email"],
        name=user.get("name", ""),
        created_at=user["created_at"],
        preferences=user.get("preferences", {}),
        profile=user.get("profile"),
        auth_provider=user.get("auth_provider", "password"),
    )


def _token_response(user: dict) -> TokenResponse:
    """Issue a fresh token pair + user payload for a user document."""
    access_token, refresh_token = create_token_pair(user)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=_user_out(user),
    )


async def _issue_and_send_otp(db, user_id, email: str, name: str) -> None:
    """Generate a fresh OTP for the user, store its hash, and email the code."""
    code, fields = new_otp_fields()
    await db.users.update_one({"_id": user_id}, {"$set": fields})
    await send_otp_email(email, name, code)


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def signup(request: Request, user_data: UserCreate):
    """Register a new account. The user must enter the emailed code to activate it."""
    db = get_database()

    email = user_data.email.lower()
    existing = await db.users.find_one({"email": email})

    if existing and existing.get("email_verified") is not False:
        # A verified (or Google) account already owns this email.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Try signing in instead.",
        )

    if existing:
        # Unverified leftover from an earlier signup attempt: let the user
        # re-register instead of dead-ending on a 409. Whoever proves control
        # of the inbox (via the code) owns the account, so overwriting the
        # name/password here is safe.
        await db.users.update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "name": user_data.name,
                    "password_hash": hash_password(user_data.password),
                }
            },
        )
        user_id = existing["_id"]
    else:
        user_doc = {
            "email": email,
            "name": user_data.name,
            "password_hash": hash_password(user_data.password),
            "auth_provider": "password",
            "email_verified": False,
            "created_at": datetime.now(timezone.utc),
            "preferences": {},
            "token_version": 0,
        }
        result = await db.users.insert_one(user_doc)
        user_id = result.inserted_id

    await _issue_and_send_otp(db, user_id, email, user_data.name)

    return SignupResponse(
        message="Account created. We emailed you a 6-digit code to verify your address.",
        email=email,
    )


@router.post("/verify-otp", response_model=TokenResponse)
@limiter.limit("10/minute")
async def verify_otp(request: Request, body: VerifyOtpRequest):
    """Confirm the emailed 6-digit code, then log the user in."""
    db = get_database()
    email = body.email.lower()

    generic_error = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="That code is incorrect or has expired. Please try again or request a new one.",
    )

    user = await db.users.find_one({"email": email})
    if not user:
        raise generic_error

    if user.get("email_verified"):
        # Already verified (e.g. double-click, or verified via Google) — just sign in?
        # No: without a valid code this would let anyone log in as any verified
        # user. Tell them to use the normal login instead.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This email is already verified. Please sign in.",
        )

    if not user.get("otp_hash") or not user.get("otp_expires_at"):
        raise generic_error

    expires_at = user["otp_expires_at"]
    if expires_at.tzinfo is None:  # Mongo stores naive UTC datetimes
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires_at:
        raise generic_error

    if user.get("otp_attempts", 0) >= MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many incorrect attempts. Please request a new code.",
        )

    if not otp_matches(body.code, user["otp_hash"]):
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"otp_attempts": 1}})
        raise generic_error

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"email_verified": True}, "$unset": {f: "" for f in _OTP_FIELDS}},
    )
    user["email_verified"] = True

    return _token_response(user)


@router.post("/resend-verification")
@limiter.limit("5/hour")
async def resend_verification(request: Request, body: ResendVerificationRequest):
    """Send a fresh verification code. Always returns a generic success response
    so it can't be used to probe which emails have accounts."""
    db = get_database()
    user = await db.users.find_one({"email": body.email.lower()})

    if user and not user.get("email_verified") and user.get("auth_provider") == "password":
        await _issue_and_send_otp(db, user["_id"], user["email"], user.get("name", ""))

    return {"message": "If that account exists and needs verification, we've sent a new code."}


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, credentials: UserLogin):
    """Login with email and password."""
    db = get_database()

    user = await db.users.find_one({"email": credentials.email.lower()})
    # user.get("password_hash") guards accounts that only have Google sign-in.
    if (
        not user
        or not user.get("password_hash")
        or not verify_password(credentials.password, user["password_hash"])
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Block until the email is verified. `is False` means only accounts explicitly
    # created unverified are blocked; pre-existing accounts (no field) and Google
    # accounts (verified) are unaffected.
    if user.get("email_verified") is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email first. We can send you a new code.",
        )

    return _token_response(user)


@router.post("/google", response_model=TokenResponse)
@limiter.limit("10/minute")
async def google_auth(request: Request, body: GoogleAuthRequest):
    """Sign in (or sign up) with a Google ID token credential."""
    try:
        profile = await verify_google_credential(body.credential)
    except GoogleAuthError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    db = get_database()

    # Find by Google subject id first, then fall back to email so an existing
    # password account can link Google sign-in.
    user = await db.users.find_one({"google_sub": profile["sub"]})
    if not user:
        user = await db.users.find_one({"email": profile["email"]})

    if user:
        # Ensure the account is linked to this Google identity going forward.
        # Signing in via Google also confirms ownership of the email address.
        updates = {"google_sub": profile["sub"], "email_verified": True}
        if profile.get("picture") and not user.get("picture"):
            updates["picture"] = profile["picture"]
        # An unverified password signup that never completed OTP has no proven
        # owner; Google's verified email wins and the account becomes Google-only.
        if user.get("email_verified") is False:
            updates["auth_provider"] = "google"
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": updates, "$unset": {"password_hash": "", **{f: "" for f in _OTP_FIELDS}}},
            )
            user.pop("password_hash", None)
        else:
            await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
        user.update(updates)
        return _token_response(user)

    # Create a brand-new Google-only account (no password_hash). Google has
    # already verified the email, so it's trusted immediately.
    user_doc = {
        "email": profile["email"],
        "name": profile["name"],
        "auth_provider": "google",
        "google_sub": profile["sub"],
        "picture": profile.get("picture"),
        "email_verified": True,
        "created_at": datetime.now(timezone.utc),
        "preferences": {},
        "token_version": 0,
    }
    result = await db.users.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id

    return _token_response(user_doc)


@router.post("/forgot-password")
@limiter.limit("5/hour")
async def forgot_password(request: Request, body: ForgotPasswordRequest):
    """Send a password reset email if account exists with password."""
    db = get_database()
    user = await db.users.find_one({"email": body.email.lower()})

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account does not exist with this email address",
        )

    if not user.get("password_hash"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account signed in with Google and cannot reset password here.",
        )

    if user.get("email_verified") is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please verify your email first before resetting password.",
        )

    token = create_password_reset_token(str(user["_id"]), user.get("token_version", 0))
    await send_password_reset_email(user["email"], user.get("name", ""), token)

    return {"message": "Password reset link sent to your email."}


@router.post("/reset-password")
@limiter.limit("10/hour")
async def reset_password(request: Request, body: ResetPasswordRequest):
    """Set a new password from a valid reset token, then revoke all existing sessions."""
    payload = verify_token(body.token, token_type="reset")
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset link is invalid or has expired. Please request a new one.",
        )

    db = get_database()
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    # The token embeds the token_version at send-time — if it's already moved on
    # (password changed, another reset used, or a sign-out-everywhere happened),
    # reject it.
    if payload.get("token_version", 0) != user.get("token_version", 0):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset link has already been used or is no longer valid. Please request a new one.",
        )

    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"password_hash": hash_password(body.new_password)},
            "$inc": {"token_version": 1},
        },
    )
    return {"message": "Password reset successfully. Please sign in with your new password."}


@router.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(body: RefreshRequest):
    """Refresh access token using a valid refresh token."""
    payload = verify_token(body.refresh_token, token_type="refresh")
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    db = get_database()
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # Reject refresh tokens that were revoked (sign-out-everywhere / password change).
    if payload.get("token_version", 0) != user.get("token_version", 0):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked. Please sign in again.",
        )

    return _token_response(user)


@router.get("/me", response_model=UserOut)
async def get_me(user: dict = Depends(get_current_user)):
    """Return the authoritative current user, straight from the database.

    The frontend calls this on load so fields added after a user's last login
    (like auth_provider) are never stale in the cached localStorage copy.
    """
    return _user_out(user)


@router.post("/logout-all")
async def logout_all(user: dict = Depends(get_current_user)):
    """Sign out everywhere by bumping the user's token version.

    This invalidates every outstanding access and refresh token for the
    account. A normal single-device logout is purely client-side (the app
    just discards its tokens) so it never touches other sessions.
    """
    db = get_database()
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$inc": {"token_version": 1}},
    )
    return {"message": "Signed out of all devices"}
