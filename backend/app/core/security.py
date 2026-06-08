"""Güvenlik yardımcıları: JWT, şifre hashleme, OAuth doğrulama.

- Access token: HS256, 15 dakika ömür
- Refresh token: HS256, 7 gün ömür
- Şifre: bcrypt (passlib), salt rounds=12
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings
from app.core.exceptions import AuthenticationException

# bcrypt context — rounds=12 (master prompt § 7.1)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


# ----------------------------------------------------------
# Şifre hashleme
# ----------------------------------------------------------
def hash_password(plain_password: str) -> str:
    """Düz şifreyi bcrypt ile hash'ler."""
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Düz şifrenin hash ile uyuşup uyuşmadığını kontrol eder."""
    return pwd_context.verify(plain_password, hashed_password)


# ----------------------------------------------------------
# JWT
# ----------------------------------------------------------
def _create_token(
    *,
    subject: str | UUID,
    expires_delta: timedelta,
    token_type: str,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """Genel JWT üretici (access ve refresh için ortak)."""
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "iat": now,
        "exp": now + expires_delta,
        "type": token_type,
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(subject: str | UUID, **extra: Any) -> str:
    """Kısa ömürlü access token üretir."""
    return _create_token(
        subject=subject,
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
        token_type="access",  # noqa: S106 — token tipi, parola değil
        extra_claims=extra or None,
    )


def create_refresh_token(subject: str | UUID) -> str:
    """Uzun ömürlü refresh token üretir."""
    return _create_token(
        subject=subject,
        expires_delta=timedelta(days=settings.refresh_token_expire_days),
        token_type="refresh",  # noqa: S106 — token tipi, parola değil
    )


def decode_token(token: str, *, expected_type: str | None = None) -> dict[str, Any]:
    """JWT'yi doğrular ve payload'ı döner.

    Raises:
        AuthenticationException: imza/expiry/type hatalı ise
    """
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise AuthenticationException(message="Token geçersiz veya süresi dolmuş.") from exc

    if expected_type and payload.get("type") != expected_type:
        raise AuthenticationException(
            message=f"Beklenen token tipi: {expected_type}",
            details={"got": payload.get("type")},
        )
    return payload


def create_token_pair(subject: str | UUID) -> dict[str, str]:
    """Standard access+refresh çiftini üretir."""
    return {
        "access_token": create_access_token(subject),
        "refresh_token": create_refresh_token(subject),
        "token_type": "bearer",
    }
