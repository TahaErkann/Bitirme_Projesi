"""TranslationService — lazy translation + cache.

Sıralı strateji:
  1) Redis cache (TTL 24h)
  2) PostgreSQL `translations` tablosu
  3) Translation provider (Google Translate)
  Provider başarısız olursa TranslationException fırlatılır.
"""
from __future__ import annotations

import logging
from uuid import UUID

import redis.asyncio as redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ResourceNotFoundException, TranslationException
from app.models.translation import Translation
from app.repositories.place_repository import PlaceRepository
from app.repositories.translation_repository import TranslationRepository
from app.schemas.place import TranslationResponse
from app.schemas.translation import SUPPORTED_LANGUAGES

logger = logging.getLogger("jourex.translation")


class TranslationService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.places = PlaceRepository(db)
        self.translations = TranslationRepository(db)
        self._redis: redis.Redis | None = None

    async def _get_redis(self) -> redis.Redis:
        if self._redis is None:
            self._redis = redis.from_url(
                settings.redis_url, decode_responses=True
            )
        return self._redis

    @staticmethod
    def _cache_key(place_id: UUID, lang: str) -> str:
        return f"trans:{place_id}:{lang}"

    async def translate_place(self, place_id: UUID, lang: str) -> TranslationResponse:
        if lang not in SUPPORTED_LANGUAGES:
            raise TranslationException(
                message=f"Desteklenmeyen dil: {lang}",
                details={"supported": sorted(SUPPORTED_LANGUAGES)},
            )

        place = await self.places.get_by_id(place_id)
        if place is None:
            raise ResourceNotFoundException(details={"place_id": str(place_id)})

        # 1) Redis cache
        try:
            r = await self._get_redis()
            cached = await r.get(self._cache_key(place_id, lang))
            if cached:
                return TranslationResponse(
                    place_id=place_id,
                    language_code=lang,
                    translated_text=cached,
                    cached=True,
                )
        except Exception as exc:  # pragma: no cover
            logger.warning("Redis cache okunamadı: %s", exc)

        # 2) PostgreSQL
        existing = await self.translations.get(place_id, lang)
        if existing is not None:
            try:
                r = await self._get_redis()
                await r.setex(
                    self._cache_key(place_id, lang),
                    settings.translation_cache_ttl,
                    existing.translated_text,
                )
            except Exception:  # pragma: no cover
                pass
            return TranslationResponse(
                place_id=place_id,
                language_code=lang,
                translated_text=existing.translated_text,
                translated_summary=existing.translated_summary,
                cached=True,
            )

        # 3) Provider
        try:
            from ai_module.translation.factory import get_translation_provider  # type: ignore
            provider = get_translation_provider(settings.translation_provider)
            translated_text = await provider.translate(text=place.original_text, target_lang=lang)
            translated_summary = (
                await provider.translate(text=place.summary, target_lang=lang)
                if place.summary
                else None
            )
        except Exception as exc:  # pragma: no cover
            logger.exception("Çeviri provider hatası: %s", exc)
            raise TranslationException() from exc

        # PostgreSQL kaydet
        row = Translation(
            place_id=place_id,
            language_code=lang,
            translated_text=translated_text,
            translated_summary=translated_summary,
        )
        self.db.add(row)
        await self.db.commit()

        # Redis cache
        try:
            r = await self._get_redis()
            await r.setex(
                self._cache_key(place_id, lang),
                settings.translation_cache_ttl,
                translated_text,
            )
        except Exception:  # pragma: no cover
            pass

        return TranslationResponse(
            place_id=place_id,
            language_code=lang,
            translated_text=translated_text,
            translated_summary=translated_summary,
            cached=False,
        )
