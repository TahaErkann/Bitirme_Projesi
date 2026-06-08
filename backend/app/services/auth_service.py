"""AuthService — register, login, refresh, Google OAuth iş mantığı.

Repository'leri kullanır, doğrudan DB'ye dokunmaz.
"""
from __future__ import annotations

import logging

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import (
    AuthenticationException,
    InvalidCredentialsException,
    UserAlreadyExistsException,
)
from app.core.security import (
    create_token_pair,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    AuthResponse,
    GoogleSignInRequest,
    LoginRequest,
    RegisterRequest,
    TokenPair,
    UserPublic,
)

logger = logging.getLogger("tourlens.auth")


class AuthService:
    """Kimlik doğrulama servisleri."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.users = UserRepository(db)

    # ---------------- Register ----------------
    async def register(self, payload: RegisterRequest) -> AuthResponse:
        if await self.users.email_exists(payload.email):
            raise UserAlreadyExistsException(details={"email": payload.email})

        user = User(
            email=payload.email.lower(),
            password_hash=hash_password(payload.password),
            display_name=payload.display_name,
            preferred_language=payload.preferred_language,
            auth_provider="local",
        )
        await self.users.add(user)
        await self.db.commit()
        await self.db.refresh(user)

        return AuthResponse(user=UserPublic.model_validate(user), tokens=TokenPair(**create_token_pair(user.id)))

    # ---------------- Login ----------------
    async def login(self, payload: LoginRequest) -> AuthResponse:
        user = await self.users.get_by_email(payload.email)
        if user is None or not user.password_hash or not verify_password(payload.password, user.password_hash):
            raise InvalidCredentialsException()
        if not user.is_active:
            raise AuthenticationException(message="Hesap deaktif edilmiş.")

        return AuthResponse(user=UserPublic.model_validate(user), tokens=TokenPair(**create_token_pair(user.id)))

    # ---------------- Refresh ----------------
    async def refresh(self, refresh_token: str) -> TokenPair:
        payload = decode_token(refresh_token, expected_type="refresh")
        sub = payload.get("sub")
        if not sub:
            raise AuthenticationException(message="Refresh token içeriği bozuk.")
        return TokenPair(**create_token_pair(sub))

    # ---------------- Google OAuth ----------------
    async def google_sign_in(self, payload: GoogleSignInRequest) -> AuthResponse:
        """Google ID token'ı doğrular; kullanıcı yoksa oluşturur."""
        token_info = await self._verify_google_id_token(payload.google_id_token)
        email = token_info.get("email")
        if not email:
            raise AuthenticationException(message="Google token'ında e-posta yok.")

        user = await self.users.get_by_email(email)
        if user is None:
            user = User(
                email=email.lower(),
                password_hash=None,
                display_name=token_info.get("name") or email.split("@", 1)[0],
                preferred_language="en",
                avatar_url=token_info.get("picture"),
                auth_provider="google",
            )
            await self.users.add(user)
            await self.db.commit()
            await self.db.refresh(user)

        return AuthResponse(user=UserPublic.model_validate(user), tokens=TokenPair(**create_token_pair(user.id)))

    @staticmethod
    async def _verify_google_id_token(id_token: str) -> dict:
        """Google'ın tokeninfo endpoint'i ile basit doğrulama.

        Üretim için google.oauth2.id_token.verify_oauth2_token tercih edilebilir.
        """
        url = f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPError as exc:
            logger.warning("Google token doğrulama başarısız: %s", exc)
            raise AuthenticationException(message="Google token doğrulanamadı.") from exc

        # client_id eşleşme kontrolü
        if settings.google_oauth_client_id and data.get("aud") != settings.google_oauth_client_id:
            raise AuthenticationException(message="Google client_id eşleşmiyor.")
        return data
