"""/places/* — listeleme, detay, çeviri, enrich, video, like, save."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.place import (
    EnrichRequest,
    EnrichResponse,
    LikeResponse,
    PlaceDetail,
    PlaceListResponse,
    SaveResponse,
    TranslationResponse,
    VideosResponse,
)
from app.services.place_service import PlaceService
from app.services.translation_service import TranslationService

router = APIRouter()


# ---------------------------------------------------------- list
@router.get("", response_model=PlaceListResponse)
async def list_places(
    country: str | None = Query(default=None),
    city: str | None = Query(default=None),
    category: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> PlaceListResponse:
    return await PlaceService(db).list_places(
        country=country, city=city, category=category, page=page, page_size=page_size,
    )


# ---------------------------------------------------------- detail
@router.get("/{place_id}", response_model=PlaceDetail)
async def get_place(place_id: UUID, db: AsyncSession = Depends(get_db)) -> PlaceDetail:
    return await PlaceService(db).get_detail(place_id)


# ---------------------------------------------------------- translate
@router.get("/{place_id}/translate/{lang}", response_model=TranslationResponse)
async def translate_place(
    place_id: UUID, lang: str, db: AsyncSession = Depends(get_db)
) -> TranslationResponse:
    return await TranslationService(db).translate_place(place_id, lang.lower())


# ---------------------------------------------------------- enrich (Daha Fazla Bilgi)
@router.post("/{place_id}/enrich", response_model=EnrichResponse)
async def enrich_place(
    place_id: UUID,
    payload: EnrichRequest,
    db: AsyncSession = Depends(get_db),
) -> EnrichResponse:
    """Tek buton → tek istek → tek cevap (chat değil).

    Kaynak (grounding) tutarlılığı — Sorun 1 fix:
      Kaynaklar artık DB'de (`enrichments.sources`) saklanır.
      - Cache hit (metin VAR + kaynak yakalanmış) → saklanan kaynaklarla döner.
      - Eski satır (kaynak NULL = hiç yakalanmamış) → bir kez yeniden üretip
        kaynakları yakalar; böylece kullanıcı "Tekrar Üret"e basmak zorunda
        kalmaz. Yakalandıktan sonra (boş liste de olsa) artık tekrar üretilmez.
      - force=True (Tekrar Üret) → her zaman taze üretim.

    Birincil sağlayıcı boş döndürürse fallback'e geçilir; iki sağlayıcı da
    boş döndürür VE elde eski metin yoksa 502 → kullanıcı tekrar deneyebilir.
    """
    svc = PlaceService(db)
    cached = await svc.get_cached_enrichment(place_id, payload.language_code)

    has_text = bool(cached and cached.enriched_text and cached.enriched_text.strip())
    # sources NULL ise kaynak hiç yakalanmamış demektir (boş liste "yakalandı"
    # sayılır). NULL satırlarda kaynak çekmek için yeniden üretime düşeriz.
    sources_captured = bool(cached and cached.sources is not None)

    if not payload.force and has_text and sources_captured:
        return svc.to_enrich_response(cached, cached=True)

    place = await svc.places.get_by_id(place_id)
    if place is None:
        from app.core.exceptions import ResourceNotFoundException
        raise ResourceNotFoundException()

    # Birincil + fallback orchestrator (boş cevapta diğerine geçer)
    from ai_module.llm.enricher import enrich_with_fallback  # type: ignore

    enriched_text, provider_name, sources, grounded = await enrich_with_fallback(
        place_name=place.place_name,
        country=place.country,
        city=place.city,
        original_text=place.original_text,
        summary=place.summary,
        target_lang=payload.language_code,
    )

    if not enriched_text or not enriched_text.strip():
        # Üretim boş döndü. Elimizde eski metin varsa onu (saklı kaynaklarıyla)
        # geri ver — boş cevap yüzünden kullanılabilir içeriği kaybetmeyelim.
        if has_text:
            return svc.to_enrich_response(cached, cached=True)
        # Hiç metin yok → cache'lemeden 502 (sonraki tıklama tekrar dener).
        from fastapi import HTTPException
        from fastapi import status as http_status
        raise HTTPException(
            status_code=http_status.HTTP_502_BAD_GATEWAY,
            detail="LLM enrichment boş cevap döndü, lütfen tekrar deneyin.",
        )

    # KAYNAK SAKLAMA — grounding başarılıysa kaynakları "yakala" (boş liste de
    # olsa: bu yer için kaynak bulunamadı → tekrar üretme); grounding'e
    # ulaşılamadıysa (kota/hata → grounded=False) NULL bırak ki kota gelince
    # bir sonraki "Daha Fazla Bilgi" tıklaması grounding'i tekrar denesin.
    store_sources = sources if grounded else None

    # Eski satır varsa güncelle, yoksa yaz.
    if cached:
        cached.enriched_text = enriched_text
        cached.llm_provider = provider_name
        cached.sources = store_sources
        await db.commit()
        await db.refresh(cached)
        return svc.to_enrich_response(cached, cached=False, sources=sources)

    saved = await svc.save_enrichment(
        place_id=place_id,
        lang=payload.language_code,
        text=enriched_text,
        provider=provider_name,
        sources=store_sources,
    )
    return svc.to_enrich_response(saved, cached=False, sources=sources)


# ---------------------------------------------------------- youtube videos
@router.get("/{place_id}/videos", response_model=VideosResponse)
async def place_videos(place_id: UUID, db: AsyncSession = Depends(get_db)) -> VideosResponse:
    """YouTube Data API v3 ile video önerileri."""
    svc = PlaceService(db)
    place = await svc.places.get_by_id(place_id)
    if place is None:
        from app.core.exceptions import ResourceNotFoundException
        raise ResourceNotFoundException()

    from ai_module.youtube.youtube_service import YouTubeService  # type: ignore
    videos = await YouTubeService().search(
        f"{place.place_name} {place.city or ''}".strip(), max_results=5
    )
    return await svc.videos_response(place_id, videos)


# ---------------------------------------------------------- like / save
@router.post("/{place_id}/like", response_model=LikeResponse)
async def like_place(
    place_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LikeResponse:
    return await PlaceService(db).toggle_like(place_id, user.id)


@router.post("/{place_id}/save", response_model=SaveResponse)
async def save_place(
    place_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SaveResponse:
    return await PlaceService(db).toggle_save(place_id, user.id)
