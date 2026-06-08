"""Generic BaseRepository (Repository Pattern).

Standart CRUD operasyonları sağlar; alt sınıflar domain'e özgü
sorgular ekler.
"""
from __future__ import annotations

from typing import Any, Generic, TypeVar
from uuid import UUID

from sqlalchemy import delete as sa_delete
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.base import Base

T = TypeVar("T", bound=Base)


class BaseRepository(Generic[T]):
    """Tip güvenli generic repository."""

    model: type[T]

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, entity_id: UUID) -> T | None:
        """Birincil anahtara göre tek kayıt getirir."""
        result = await self.session.execute(select(self.model).where(self.model.id == entity_id))
        return result.scalar_one_or_none()

    async def list_all(self, *, limit: int = 100, offset: int = 0) -> list[T]:
        """Sayfalı liste."""
        result = await self.session.execute(select(self.model).limit(limit).offset(offset))
        return list(result.scalars().all())

    async def add(self, entity: T) -> T:
        """Yeni kaydı ekler — flush ile id üretilir, commit çağıran sorumluluğunda."""
        self.session.add(entity)
        await self.session.flush()
        return entity

    async def delete(self, entity_id: UUID) -> int:
        """Kaydı siler; etkilenen satır sayısını döner."""
        result = await self.session.execute(sa_delete(self.model).where(self.model.id == entity_id))
        return result.rowcount or 0

    async def update(self, entity: T, **fields: Any) -> T:
        """Verilen alanları günceller."""
        for k, v in fields.items():
            setattr(entity, k, v)
        await self.session.flush()
        return entity
