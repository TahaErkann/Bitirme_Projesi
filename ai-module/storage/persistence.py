"""Pipeline çıktılarını DB + Milvus + MinIO'ya yazan yardımcı.

categorization_tasks.save_results buradaki async fonksiyonu çağırır.

Önemli — Celery + asyncio loop izolasyonu:
  Celery worker tasks senkron çalışır ve içinden `asyncio.run()` ile bu
  fonksiyonu çağırırlar. `asyncio.run()` her seferinde YENİ bir event loop
  yaratır. Modül seviyesinde paylaşılan bir async engine (asyncpg
  connection pool) ilk loop'a bağlanıp diğerlerinde "got Future attached
  to a different loop" hatasına yol açar. Bu yüzden burada **her çağrı
  için** sıfırdan `NullPool`'lı bir engine yaratıp sonunda dispose
  ediyoruz. FastAPI tarafı kendi pool'lu engine'ini kullanır; iki tarafı
  karıştırmıyoruz.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

logger = logging.getLogger("tourlens.persistence")


async def persist_pipeline_result(
    payload: dict[str, Any],
    *,
    similarity_threshold: float,
) -> tuple[uuid.UUID | None, uuid.UUID | None]:
    """Pipeline sonuçlarını kalıcılaştırır.

    Returns:
        (place_id, duplicate_of)
        - duplicate_of doluysa yeni Place yaratılmaz.
    """
    from app.core.config import settings
    from app.models.ocr_result import OCRResult
    from app.models.place import Place
    from app.models.place_image import PlaceImage
    from app.repositories.place_repository import PlaceRepository
    from ai_module.embedding.milvus_client import MilvusClient
    from ai_module.storage.minio_client import get_temp_object, public_url, put_original

    upload_id: str = payload["upload_id"]
    user_id_str: str | None = payload.get("user_id")
    cleaned_text: str = payload.get("cleaned_text") or ""
    raw_text: str = payload.get("raw_text") or ""
    detected_language: str | None = payload.get("detected_language")
    confidence = payload.get("confidence")
    categorization: dict[str, Any] = payload.get("categorization") or {}
    candidates: list[dict] = payload.get("candidates") or []
    embedding = payload.get("embedding") or []

    user_id: uuid.UUID | None = uuid.UUID(user_id_str) if user_id_str else None

    # Tek atımlık engine — mevcut event loop'a bağlı, finally'da dispose edilir.
    task_engine = create_async_engine(
        settings.database_url,
        echo=False,
        poolclass=NullPool,
        future=True,
    )
    task_session_maker = async_sessionmaker(
        bind=task_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )

    try:
        async with task_session_maker() as session:  # type: AsyncSession
            repo = PlaceRepository(session)

            # Mükerrer kontrol — primer ölçüt embedding similarity skorudur.
            # similarity_threshold (default 0.85) eşiğini geçen en yüksek
            # skorlu aday MÜKERRER kabul edilir. LLM'in döndürdüğü place_name
            # / city aynı yer için bile değişebildiği için ekstra bir name+city
            # eşleşmesi şart koşmuyoruz.
            duplicate_id: uuid.UUID | None = None
            place_name = (categorization.get("place_name") or "").strip()
            city = categorization.get("city")
            ordered_candidates = sorted(
                candidates, key=lambda c: c.get("score", 0.0), reverse=True
            )
            for cand in ordered_candidates:
                score = float(cand.get("score", 0.0))
                if score < similarity_threshold:
                    continue
                cand_pid = cand.get("place_id")
                if not cand_pid:
                    continue
                try:
                    existing = await repo.get_by_id(uuid.UUID(cand_pid))
                except (TypeError, ValueError):
                    continue
                if existing is None:
                    continue
                logger.info(
                    "Mükerrer tespit edildi: cand_place=%s score=%.3f new_name=%r existing_name=%r",
                    existing.id, score, place_name, existing.place_name,
                )
                duplicate_id = existing.id
                break

            if duplicate_id:
                return None, duplicate_id

            # Yeni Place
            place = Place(
                place_name=place_name or "Bilinmeyen Yer",
                country=categorization.get("country"),
                city=city,
                district=categorization.get("district"),
                category=categorization.get("category"),
                original_text=cleaned_text,
                summary=categorization.get("summary"),
                tags=categorization.get("tags") or None,
                confidence_score=categorization.get("confidence_score"),
                created_by=user_id,
            )
            await repo.add(place)
            await session.flush()

            # MinIO: temp → originals
            try:
                content = get_temp_object(upload_id)
                image_id = uuid.uuid4()
                object_name = put_original(
                    place_id=str(place.id),
                    image_id=str(image_id),
                    content=content,
                    content_type="image/jpeg",
                )
                image = PlaceImage(
                    id=image_id,
                    place_id=place.id,
                    image_url=public_url(object_name),
                    uploaded_by=user_id,
                    is_primary=True,
                )
                session.add(image)
                await session.flush()

                ocr_row = OCRResult(
                    place_image_id=image.id,
                    raw_text=raw_text,
                    cleaned_text=cleaned_text,
                    detected_language=detected_language,
                    confidence=confidence,
                )
                session.add(ocr_row)
            except Exception as exc:  # pragma: no cover
                logger.exception("MinIO/OCR persist hatası: %s", exc)

            # Milvus'a embedding yaz
            try:
                if embedding:
                    import numpy as np
                    MilvusClient().insert(
                        place_id=str(place.id),
                        embedding=np.asarray(embedding, dtype="float32"),
                        source_text=cleaned_text,
                    )
            except Exception as exc:  # pragma: no cover
                logger.warning("Milvus insert başarısız: %s", exc)

            await session.commit()
            return place.id, None
    finally:
        await task_engine.dispose()
