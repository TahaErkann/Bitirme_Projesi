"""FastAPI Depends() bağımlılıkları.

Bu modül; DB session, mevcut kullanıcı, opsiyonel kullanıcı,
admin yetkisi gibi tekrar eden bağımlılıkları sağlar.

Dependency Inversion Principle: Service ve route'lar burada tanımlanan
abstract bağımlılıklara güvenir.
"""
from __future__ import annotations

from collections.abc import AsyncGenerator
from uuid import UUID

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationException, AuthorizationException
from app.core.security import decode_token
from app.database.session import async_session_maker
from app.models.user import User
from app.repositories.user_repository import UserRepository


# ----------------------------------------------------------
# Veritabanı Session
# ----------------------------------------------------------
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Her istek için bir async DB session sağlar (otomatik close)."""
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


# ----------------------------------------------------------
# Auth: token'dan kullanıcıyı çöz
# ----------------------------------------------------------
async def _resolve_user_from_authorization(
    authorization: str | None,
    db: AsyncSession,
    *,
    optional: bool = False,
) -> User | None:
    """Bearer header'ından user'ı çıkarır.

    optional=True ise giriş yapılmamışsa None döner.
    """
    if not authorization:
        if optional:
            return None
        raise AuthenticationException(message="Authorization header eksik.")

    if not authorization.lower().startswith("bearer "):
        raise AuthenticationException(message="Authorization header formatı 'Bearer <token>' olmalı.")

    token = authorization.split(" ", 1)[1].strip()
    payload = decode_token(token, expected_type="access")
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise AuthenticationException(message="Token içinde kullanıcı kimliği yok.")

    try:
        user_id = UUID(user_id_str)
    except ValueError as exc:
        raise AuthenticationException(message="Token içindeki kullanıcı kimliği geçersiz.") from exc

    user = await UserRepository(db).get_by_id(user_id)
    if user is None or not user.is_active:
        raise AuthenticationException(message="Kullanıcı bulunamadı veya deaktif.")
    return user


async def get_current_user(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Kimliği doğrulanmış kullanıcıyı döner — yoksa 401."""
    user = await _resolve_user_from_authorization(authorization, db, optional=False)
    assert user is not None  # type: ignore[truthy-bool]
    return user


async def get_optional_user(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Giriş yapılmamışsa None döner; geçersiz token verilmişse hata fırlatır."""
    return await _resolve_user_from_authorization(authorization, db, optional=True)


# ----------------------------------------------------------
# Yetki: admin / moderator
# ----------------------------------------------------------
def require_role(*allowed_roles: str):
    """Belirli rolleri zorlayan dependency factory."""

    async def _checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_roles:
            raise AuthorizationException(
                message=f"Bu işlem için '{', '.join(allowed_roles)}' rolü gerekli.",
            )
        return user

    return _checker


require_admin = require_role("admin")
require_moderator = require_role("admin", "moderator")
