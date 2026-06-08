"""Pipeline 1. ve 2. adım: preprocess + OCR.

NOT: Bu task'lar Celery worker'da senkron çalışır; ai_module senkron
fonksiyonlar sağlar.
"""
from __future__ import annotations

import logging
import time
from typing import Any

from app.tasks.celery_app import celery_app

logger = logging.getLogger("tourlens.tasks.ocr")


@celery_app.task(bind=True, name="tasks.preprocess_image")
def preprocess_image(
    self,
    upload_id: str,
    user_id: str | None,
    crop: list[float] | None = None,
) -> dict[str, Any]:
    """MinIO temp objesini indir, preprocess et, sonucu yine MinIO'ya yaz.

    `crop` verilirse `(x, y, w, h)` (hepsi 0..1 normalize) bölgesi
    preprocess'in başında kırpılır; OCR sadece bu bölgeyi görür.
    """
    self.update_state(state="PREPROCESSING", meta={"progress": 10})

    from ai_module.ocr.preprocessor import preprocess_bytes  # type: ignore
    from ai_module.storage.minio_client import get_temp_object, put_temp_object  # type: ignore

    raw = get_temp_object(upload_id)
    self.update_state(state="PREPROCESSING", meta={"progress": 18})

    crop_tuple = None
    if crop and len(crop) == 4:
        crop_tuple = (float(crop[0]), float(crop[1]), float(crop[2]), float(crop[3]))

    processed = preprocess_bytes(raw, crop=crop_tuple)
    self.update_state(state="PREPROCESSING", meta={"progress": 24})
    put_temp_object(
        upload_id=f"{upload_id}_preprocessed",
        content=processed,
        content_type="image/jpeg",
    )
    return {"upload_id": upload_id, "user_id": user_id, "progress": 30}


@celery_app.task(bind=True, name="tasks.run_ocr")
def run_ocr(self, prev: dict[str, Any]) -> dict[str, Any]:
    """OCR provider çalıştır → raw + cleaned text."""
    self.update_state(state="OCR_PROCESSING", meta={"progress": 35})

    from ai_module.ocr.factory import get_ocr_provider  # type: ignore
    from ai_module.ocr.text_cleaner import clean_text  # type: ignore
    from ai_module.storage.minio_client import get_temp_object  # type: ignore

    upload_id = prev["upload_id"]
    img_bytes = get_temp_object(f"{upload_id}_preprocessed")
    self.update_state(state="OCR_PROCESSING", meta={"progress": 42})
    provider = get_ocr_provider()
    ocr = provider.run(img_bytes)
    self.update_state(state="OCR_PROCESSING", meta={"progress": 52})
    return {
        **prev,
        "raw_text": ocr["text"],
        "cleaned_text": clean_text(ocr["text"]),
        "detected_language": ocr.get("language"),
        "confidence": ocr.get("confidence"),
        "progress": 55,
    }
