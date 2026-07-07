"""Authentication routes: signup, login, refresh, logout, Google OAuth."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from datetime import datetime, timezone
from bson import ObjectId

from app.database import get_database
from app.rate_limit import limiter
from app.auth.hashing import hash_password, verify_password
from app.auth.jwt import create_token_pair, verify_token, create_email_verification_token
from app.auth.dependencies import get_current_user
from app.services.google_auth import verify_google_credential, GoogleAuthError
from app.services.email_sender import send_verification_email
from app.models.user import (
    UserCreate,
    UserLogin,
    TokenResponse,
    UserOut,
    RefreshRequest,
    GoogleAuthRequest,
    VerifyEmailRequest,
    ResendVerificationRequest,
    SignupResponse,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


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


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def signup(request: Request, user_data: UserCreate):
    """Register a new account. The user must verify their email before logging in."""
    db = get_database()

    email = user_data.email.lower()

    # Check if email already exists
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    # Create user document — unverified until they click the email link.
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
    user_id = str(result.inserted_id)

    # Send the verification email (or log the link in dev).
    token = create_email_verification_token(user_id)
    await send_verification_email(email, user_data.name, token)

    return SignupResponse(
        message="Account created. Check your email for a verification link to activate it.",
        email=email,
    )


@router.post("/verify-email", response_model=TokenResponse)
async def verify_email(body: VerifyEmailRequest):
    """Confirm an email via the signed token, then log the user in."""
    payload = verify_token(body.token, token_type="verify")
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification link is invalid or has expired. Please request a new one.",
        )

    db = get_database()
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    if not user.get("email_verified"):
        await db.users.update_one(
            {"_id": user["_id"]}, {"$set": {"email_verified": True}}
        )
        user["email_verified"] = True

    return _token_response(user)


@router.post("/resend-verification")
@limiter.limit("3/hour")
async def resend_verification(request: Request, body: ResendVerificationRequest):
    """Resend the verification email. Always returns a generic success response
    so it can't be used to probe which emails have accounts."""
    db = get_database()
    user = await db.users.find_one({"email": body.email.lower()})

    if user and not user.get("email_verified") and user.get("auth_provider") == "password":
        token = create_email_verification_token(str(user["_id"]))
        await send_verification_email(user["email"], user.get("name", ""), token)

    return {"message": "If that account exists and needs verification, we've sent a new link."}


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
            detail="Please verify your email address before signing in. Check your inbox for the link.",
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

    # Reject refresh tokens that were revoked (logout / password change).
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


@router.post("/logout")
async def logout(user: dict = Depends(get_current_user)):
    """Log out everywhere by bumping the user's token version.

    This immediately invalidates all outstanding access and refresh tokens for
    the account, not just the client-side copy.
    """
    db = get_database()
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$inc": {"token_version": 1}},
    )
    return {"message": "Logged out successfully"}
