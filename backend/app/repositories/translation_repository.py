"""Translation repository."""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.translation import Translation
from app.repositories.base import BaseRepository


class TranslationRepository(BaseRepository[Translation]):
    model = Translation

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get(self, place_id: UUID, lang: str) -> Translation | None:
        stmt = select(Translation).where(
            Translation.place_id == place_id,
            Translation.language_code == lang,
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()
