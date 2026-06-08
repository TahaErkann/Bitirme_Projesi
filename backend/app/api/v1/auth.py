"""/auth/* — register, login, refresh, google, logout."""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    GoogleSignInRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenPair,
)
from app.services.auth_service import AuthService

router = APIRouter()


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    """Yerel hesap oluşturma."""
    return await AuthService(db).register(payload)


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    """E-posta/şifre ile giriş."""
    return await AuthService(db).login(payload)


@router.post("/refresh", response_model=TokenPair)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)) -> TokenPair:
    """Refresh token ile yeni access üretir."""
    return await AuthService(db).refresh(payload.refresh_token)


@router.post("/google", response_model=AuthResponse)
async def google_sign_in(
    payload: GoogleSignInRequest, db: AsyncSession = Depends(get_db)
) -> AuthResponse:
    """Google ID token ile giriş veya kayıt."""
    return await AuthService(db).google_sign_in(payload)


@router.post("/logout")
async def logout(_: User = Depends(get_current_user)) -> dict:
    """Stateless JWT — istemci tarafında token'ı atmak yeterlidir.

    İleride Redis tabanlı blacklist eklenebilir.
    """
    return {"message": "Çıkış yapıldı."}
