"""Auth şemaları — register, login, refresh, Google OAuth."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    """Yerel kullanıcı kayıt isteği."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=128, examples=["StrongPass123!"])
    display_name: str = Field(min_length=2, max_length=100)
    preferred_language: str = Field(default="en", min_length=2, max_length=10)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class GoogleSignInRequest(BaseModel):
    """Google ID token ile sign-in (frontend Google Sign-In SDK'dan alır)."""

    google_id_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserPublic(BaseModel):
    """Kullanıcı bilgisinin public görünümü."""

    id: UUID
    email: EmailStr
    display_name: str
    preferred_language: str
    avatar_url: str | None = None
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    """Login/register/google sonrası standart cevap."""

    user: UserPublic
    tokens: TokenPair
