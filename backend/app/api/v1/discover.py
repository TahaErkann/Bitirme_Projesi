"""/discover/* — feed, kategoriler, yakındakiler."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_optional_user
from app.models.user import User
from app.schemas.discover import (
    CategoriesResponse,
    DiscoverFeedResponse,
    NearbyResponse,
)
from app.services.discover_service import DiscoverService

router = APIRouter()


@router.get("", response_model=DiscoverFeedResponse)
async def feed(
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
    country: str | None = Query(default=None),
    sort: str = Query(default="recent"),  # şimdilik recent destekleniyor
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> DiscoverFeedResponse:
    return await DiscoverService(db).feed(
        cursor=cursor,
        limit=limit,
        country=country,
        user_id=current_user.id if current_user else None,
    )


@router.get("/categories", response_model=CategoriesResponse)
async def categories(db: AsyncSession = Depends(get_db)) -> CategoriesResponse:
    return await DiscoverService(db).categories()


@router.get("/nearby", response_model=NearbyResponse)
async def nearby(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(default=10.0, gt=0, le=200),
    db: AsyncSession = Depends(get_db),
) -> NearbyResponse:
    return await DiscoverService(db).nearby(lat=lat, lng=lng, radius_km=radius_km)
