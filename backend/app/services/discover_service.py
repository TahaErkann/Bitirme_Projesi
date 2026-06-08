"""DiscoverService — keşfet feed, kategori, yakındakiler."""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_interaction import UserInteraction
from app.repositories.place_repository import PlaceRepository
from app.schemas.discover import (
    CategoriesResponse,
    DiscoverFeedResponse,
    NearbyResponse,
)
from app.schemas.place import PlaceListItem


class DiscoverService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.places = PlaceRepository(db)

    async def feed(
        self,
        *,
        cursor: str | None,
        limit: int,
        country: str | None,
        user_id: UUID | None = None,
    ) -> DiscoverFeedResponse:
        rows, next_cursor = await self.places.feed_with_cursor(
            cursor=cursor, limit=limit, country=country
        )

        # Bu kullanıcının bu sayfadaki yerlerden hangilerini beğendiğini tek
        # sorguda topla (kalbin başlangıç durumu sunucudan gelsin).
        liked_ids: set[UUID] = set()
        if user_id and rows:
            place_ids = [p.id for p in rows]
            res = await self.db.execute(
                select(UserInteraction.place_id).where(
                    UserInteraction.user_id == user_id,
                    UserInteraction.action_type == "like",
                    UserInteraction.place_id.in_(place_ids),
                )
            )
            liked_ids = set(res.scalars().all())

        items = [
            PlaceListItem(
                id=p.id,
                place_name=p.place_name,
                country=p.country,
                city=p.city,
                category=p.category,
                primary_image_url=await self.places.primary_image_url(p.id),
                like_count=p.like_count,
                view_count=p.view_count,
                liked=p.id in liked_ids,
                created_at=p.created_at,
            )
            for p in rows
        ]
        return DiscoverFeedResponse(places=items, next_cursor=next_cursor)

    async def categories(self) -> CategoriesResponse:
        return CategoriesResponse(categories=await self.places.list_categories())

    async def nearby(
        self, *, lat: float, lng: float, radius_km: float
    ) -> NearbyResponse:
        # Basit yaklaşım: PostGIS yokken bbox + Haversine post-filter.
        from math import asin, cos, radians, sin, sqrt

        # Geniş bir aday seti çek (en fazla 200) — ardından mesafeye göre filtrele.
        all_rows, _ = await self.places.filter_paginated(
            country=None, city=None, category=None, page=1, page_size=200
        )

        def haversine(lat1, lng1, lat2, lng2) -> float:
            r = 6371.0
            dlat = radians(lat2 - lat1)
            dlng = radians(lng2 - lng1)
            a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
            return 2 * r * asin(sqrt(a))

        within: list[PlaceListItem] = []
        for p in all_rows:
            if p.latitude is None or p.longitude is None:
                continue
            d = haversine(lat, lng, float(p.latitude), float(p.longitude))
            if d <= radius_km:
                within.append(
                    PlaceListItem(
                        id=p.id,
                        place_name=p.place_name,
                        country=p.country,
                        city=p.city,
                        category=p.category,
                        primary_image_url=await self.places.primary_image_url(p.id),
                        like_count=p.like_count,
                        view_count=p.view_count,
                        created_at=p.created_at,
                    )
                )
        return NearbyResponse(places=within)
