"""User models for auth and profile."""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class UserProfile(BaseModel):
    birthday: Optional[str] = None
    age: Optional[int] = None
    focus_area: Optional[str] = None
    additional_details: Optional[str] = None


class UserProfileUpdate(BaseModel):
    birthday: Optional[str] = None
    age: Optional[int] = None
    focus_area: Optional[str] = None
    additional_details: Optional[str] = None


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    name: str = Field(..., min_length=1, max_length=100)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    created_at: datetime
    preferences: dict = {}
    profile: Optional[UserProfile] = None
    auth_provider: str = "password"


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class RefreshRequest(BaseModel):
    refresh_token: str


class GoogleAuthRequest(BaseModel):
    """The ID token (credential) returned by Google Identity Services."""
    credential: str


class VerifyEmailRequest(BaseModel):
    token: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class SignupResponse(BaseModel):
    """Signup no longer logs the user in — they must verify their email first."""
    message: str
    email: str
    verification_required: bool = True


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6)
