"""OCR provider factory — config'e göre uygun provider'ı döner (Strategy)."""
from __future__ import annotations

from app.core.config import settings  # type: ignore  # backend kontekstinde
from ai_module.ocr.base_provider import BaseOCRProvider
from ai_module.ocr.google_vision_provider import GoogleVisionProvider


def get_ocr_provider(name: str | None = None) -> BaseOCRProvider:
    """`OCR_PROVIDER` env değerine göre instance döner."""
    chosen = (name or settings.ocr_provider).lower()
    if chosen == "google_vision":
        return GoogleVisionProvider(api_key=settings.google_vision_api_key)
    raise ValueError(f"Bilinmeyen OCR provider: {chosen}")
