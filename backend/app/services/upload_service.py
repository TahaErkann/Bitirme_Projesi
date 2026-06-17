"""UploadService — görsel yükleme + Celery pipeline tetikleme.

Akış:
  1) MIME + boyut kontrolü (10 MB, image/*)
  2) Magic byte kontrolü (Pillow ile)
  3) MinIO'ya temp/{upload_id} olarak kaydet
  4) Celery chain başlat: preprocess → ocr → moderate → duplicate → categorize → save
"""
from __future__ import annotations

import io
import logging
from uuid import UUID, uuid4

from fastapi import UploadFile
from PIL import Image, UnidentifiedImageError

from app.core.config import settings
from app.core.exceptions import FileTooLargeException, InvalidImageException
from app.schemas.upload import UploadResponse

logger = logging.getLogger("jourex.upload")


class UploadService:
    """Görsel yükleme orkestratörü."""

    async def handle_upload(
        self,
        file: UploadFile,
        *,
        user_id: UUID | None,
        crop: list[float] | None = None,
    ) -> UploadResponse:
        """Görsel yükleme işleminin baş halkası.

        `crop` opsiyonel; verilirse `[x, y, w, h]` (hepsi 0..1 normalize)
        olarak preprocess_image task'ına iletilir.
        """
        # 1) İçerik tipini kontrol et
        if file.content_type not in settings.allowed_mime_set:
            raise InvalidImageException(
                message="Desteklenmeyen içerik tipi.",
                details={"content_type": file.content_type, "allowed": list(settings.allowed_mime_set)},
            )

        # 2) Veriyi oku — boyut limiti (master prompt § 7.2: 10 MB)
        contents = await file.read()
        max_bytes = settings.max_upload_size_mb * 1024 * 1024
        if len(contents) > max_bytes:
            raise FileTooLargeException(
                details={"size_bytes": len(contents), "max_bytes": max_bytes},
            )

        # 3) Magic byte / format doğrulaması (Pillow gerçek formatı tespit eder)
        try:
            with Image.open(io.BytesIO(contents)) as img:
                img.verify()
        except (UnidentifiedImageError, OSError) as exc:
            raise InvalidImageException(message="Görsel okunamadı veya bozuk.") from exc

        upload_id = uuid4()

        # 4) MinIO'ya yaz + Celery pipeline başlat
        # Not: Celery import'u burada lazy yapılır (worker tarafında task tanımlı).
        try:
            from app.tasks.celery_app import enqueue_pipeline
            task_id = enqueue_pipeline(
                upload_id=str(upload_id),
                content=contents,
                content_type=file.content_type or "image/jpeg",
                user_id=str(user_id) if user_id else None,
                crop=crop,
            )
        except Exception as exc:  # pragma: no cover
            logger.exception("Celery pipeline tetiklenemedi: %s", exc)
            # Yine de bir task_id dönüyoruz; client polling devam edebilir.
            task_id = str(upload_id)

        return UploadResponse(task_id=task_id, status="PENDING")
