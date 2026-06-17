"""PlaceService — yer detayı, listeleme, like/save, video, enrich orkestrasyonu."""
from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ResourceNotFoundException
from app.models.enrichment import Enrichment
from app.models.ocr_result import OCRResult
from app.models.place_image import PlaceImage
from app.models.user_interaction import UserInteraction
from app.repositories.place_repository import PlaceRepository
from app.schemas.place import (
    EnrichResponse,
    LikeResponse,
    OCRResultPublic,
    PlaceDetail,
    PlaceImagePublic,
    PlaceListItem,
    PlaceListResponse,
    SaveResponse,
    VideosResponse,
)

logger = logging.getLogger("tourlens.place")


class PlaceService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.places = PlaceRepository(db)

    # ---------------- List ----------------
    async def list_places(
        self,
        *,
        country: str | None,
        city: str | None,
        category: str | None,
        page: int,
        page_size: int,
    ) -> PlaceListResponse:
        rows, total = await self.places.filter_paginated(
            country=country, city=city, category=category, page=page, page_size=page_size
        )
        items: list[PlaceListItem] = []
        for p in rows:
            items.append(
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
        return PlaceListResponse(places=items, total=total, page=page, page_size=page_size)

    # ---------------- Detail ----------------
    async def get_detail(self, place_id: UUID) -> PlaceDetail:
        place = await self.places.get_by_id(place_id)
        if place is None:
            raise ResourceNotFoundException(details={"place_id": str(place_id)})

        # Görseller
        img_rows = (
            await self.db.execute(select(PlaceImage).where(PlaceImage.place_id == place_id))
        ).scalars().all()

        # OCR sonuçları (place_id → place_image_id üstünden)
        ocr_rows = (
            await self.db.execute(
                select(OCRResult)
                .join(PlaceImage, OCRResult.place_image_id == PlaceImage.id)
                .where(PlaceImage.place_id == place_id)
            )
        ).scalars().all()

        # Koordinat yoksa (LLM koordinat döndürmez) il/ilçe merkezini geocode
        # et ve kalıcılaştır → "Haritada Gör" yeri kırmızı işaretle gösterebilir.
        # Bir kez çözülünce coords dolu olur, sonraki açılışlarda atlanır.
        if (place.latitude is None or place.longitude is None) and (
            place.city or place.district or place.country
        ):
            try:
                from app.services.geocoding import geocode_place

                coords = await geocode_place(
                    district=place.district,
                    city=place.city,
                    country=place.country,
                )
                if coords:
                    place.latitude, place.longitude = coords
            except Exception as exc:  # pragma: no cover
                logger.warning("Geocode get_detail içinde başarısız: %s", exc)

        # View sayacı +1 (ve varsa yeni koordinatlar) tek commit ile yazılır.
        await self.places.increment_view(place_id)
        await self.db.commit()

        return PlaceDetail(
            id=place.id,
            place_name=place.place_name,
            country=place.country,
            city=place.city,
            district=place.district,
            category=place.category,
            original_text=place.original_text,
            summary=place.summary,
            tags=place.tags,
            latitude=place.latitude,
            longitude=place.longitude,
            confidence_score=place.confidence_score,
            view_count=place.view_count,
            like_count=place.like_count,
            is_verified=place.is_verified,
            images=[PlaceImagePublic.model_validate(i) for i in img_rows],
            ocr_results=[OCRResultPublic.model_validate(o) for o in ocr_rows],
            created_at=place.created_at,
        )

    # ---------------- Like / Save ----------------
    async def toggle_like(self, place_id: UUID, user_id: UUID) -> LikeResponse:
        place = await self.places.get_by_id(place_id)
        if place is None:
            raise ResourceNotFoundException()

        existing = (
            await self.db.execute(
                select(UserInteraction).where(
                    UserInteraction.user_id == user_id,
                    UserInteraction.place_id == place_id,
                    UserInteraction.action_type == "like",
                )
            )
        ).scalar_one_or_none()

        liked: bool
        if existing:
            await self.db.delete(existing)
            place.like_count = max(0, place.like_count - 1)
            liked = False
        else:
            self.db.add(
                UserInteraction(user_id=user_id, place_id=place_id, action_type="like")
            )
            place.like_count += 1
            liked = True

        await self.db.commit()
        return LikeResponse(liked=liked, like_count=place.like_count)

    async def toggle_save(self, place_id: UUID, user_id: UUID) -> SaveResponse:
        existing = (
            await self.db.execute(
                select(UserInteraction).where(
                    UserInteraction.user_id == user_id,
                    UserInteraction.place_id == place_id,
                    UserInteraction.action_type == "save",
                )
            )
        ).scalar_one_or_none()

        if existing:
            await self.db.delete(existing)
            saved = False
        else:
            self.db.add(
                UserInteraction(user_id=user_id, place_id=place_id, action_type="save")
            )
            saved = True
        await self.db.commit()
        return SaveResponse(saved=saved)

    # ---------------- Enrichment cache ----------------
    async def get_cached_enrichment(self, place_id: UUID, lang: str) -> Enrichment | None:
        stmt = select(Enrichment).where(
            Enrichment.place_id == place_id,
            Enrichment.language_code == lang,
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def save_enrichment(
        self,
        place_id: UUID,
        lang: str,
        text: str,
        provider: str,
        sources: list[dict[str, str]] | None = None,
    ) -> Enrichment:
        row = Enrichment(
            place_id=place_id,
            language_code=lang,
            enriched_text=text,
            llm_provider=provider,
            # Olduğu gibi yaz (None→NULL): caller grounding BAŞARILIYSA liste
            # (boş olsa bile "yakalandı") geçer; grounding'e ulaşılamadıysa
            # (kota/hata) None geçer → NULL kalır → sonraki tıklama tekrar dener.
            sources=sources,
        )
        self.db.add(row)
        await self.db.commit()
        await self.db.refresh(row)
        return row

    # ---------------- Videos passthrough (servis dışında çağrılır) ----------------
    async def videos_response(self, place_id: UUID, videos: list[dict]) -> VideosResponse:
        from app.schemas.place import YouTubeVideo
        return VideosResponse(
            place_id=place_id,
            videos=[YouTubeVideo(**v) for v in videos],
        )

    # ---------------- Enrichment cevap helper ----------------
    @staticmethod
    def to_enrich_response(
        row: Enrichment,
        *,
        cached: bool,
        sources: list[dict[str, str]] | None = None,
    ) -> EnrichResponse:
        from app.schemas.place import EnrichSource

        # `sources` açıkça verilmediyse satırda saklanan kaynakları kullan
        # (cache hit'te kaynakların DB'den dönmesini sağlar — Sorun 1 fix).
        effective = sources if sources is not None else (row.sources or [])
        return EnrichResponse(
            place_id=row.place_id,
            language_code=row.language_code,
            enriched_text=row.enriched_text,
            llm_provider=row.llm_provider or "unknown",
            cached=cached,
            sources=[EnrichSource(**s) for s in effective],
        )
