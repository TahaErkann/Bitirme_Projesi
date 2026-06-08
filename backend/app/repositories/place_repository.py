"""Place repository — keşfet, filtreleme, yakındakiler sorguları."""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.place import Place
from app.models.place_image import PlaceImage
from app.repositories.base import BaseRepository


class PlaceRepository(BaseRepository[Place]):
    model = Place

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def filter_paginated(
        self,
        *,
        country: str | None = None,
        city: str | None = None,
        category: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Place], int]:
        """Filtreli sayfalı listeleme + total."""
        stmt = select(Place)
        count_stmt = select(func.count(Place.id))

        conditions = []
        if country:
            conditions.append(Place.country == country)
        if city:
            conditions.append(Place.city == city)
        if category:
            conditions.append(Place.category == category)
        if conditions:
            stmt = stmt.where(and_(*conditions))
            count_stmt = count_stmt.where(and_(*conditions))

        stmt = stmt.order_by(Place.created_at.desc()).limit(page_size).offset((page - 1) * page_size)
        rows = (await self.session.execute(stmt)).scalars().all()
        total = (await self.session.execute(count_stmt)).scalar_one()
        return list(rows), int(total)

    async def find_by_name_and_city(self, name: str, city: str | None) -> Place | None:
        """Mükerrer kontrol — place_name + city eşleşmesi (master prompt § 6.3)."""
        stmt = select(Place).where(
            func.lower(Place.place_name) == name.lower(),
            (Place.city == city) if city else (Place.city.is_(None)),
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def list_categories(self) -> list[str]:
        """DB'de mevcut tüm kategorileri döner."""
        stmt = select(Place.category).where(Place.category.is_not(None)).distinct()
        rows = (await self.session.execute(stmt)).scalars().all()
        return [c for c in rows if c]

    async def primary_image_url(self, place_id: UUID) -> str | None:
        """Yere ait birincil görselin URL'sini döner (yoksa ilk görsel)."""
        stmt = (
            select(PlaceImage.image_url)
            .where(PlaceImage.place_id == place_id)
            .order_by(PlaceImage.is_primary.desc(), PlaceImage.created_at.asc())
            .limit(1)
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def increment_view(self, place_id: UUID) -> None:
        """View sayacını arttırır."""
        place = await self.get_by_id(place_id)
        if place is not None:
            place.view_count += 1
            await self.session.flush()

    async def feed_with_cursor(
        self,
        *,
        cursor: str | None,
        limit: int = 20,
        country: str | None = None,
    ) -> tuple[list[Place], str | None]:
        """Cursor tabanlı (created_at, id) sayfalama — Instagram tarzı feed."""
        stmt = select(Place)
        if country:
            stmt = stmt.where(Place.country == country)

        if cursor:
            # cursor formatı: "<iso_datetime>|<uuid>"
            try:
                ts_str, last_id = cursor.split("|", 1)
                from datetime import datetime as _dt
                ts = _dt.fromisoformat(ts_str)
                stmt = stmt.where(
                    (Place.created_at < ts)
                    | ((Place.created_at == ts) & (Place.id < UUID(last_id))),
                )
            except (ValueError, IndexError):
                pass  # bozuk cursor — başa dön

        stmt = stmt.order_by(Place.created_at.desc(), Place.id.desc()).limit(limit + 1)
        rows = list((await self.session.execute(stmt)).scalars().all())

        next_cursor: str | None = None
        if len(rows) > limit:
            last = rows[limit - 1]
            next_cursor = f"{last.created_at.isoformat()}|{last.id}"
            rows = rows[:limit]
        return rows, next_cursor
