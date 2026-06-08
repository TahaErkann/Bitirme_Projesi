"""Translation provider factory."""
from __future__ import annotations

from app.core.config import settings  # type: ignore
from ai_module.translation.base_provider import BaseTranslationProvider
from ai_module.translation.google_translate_provider import GoogleTranslateProvider


def get_translation_provider(name: str | None = None) -> BaseTranslationProvider:
    chosen = (name or settings.translation_provider).lower()
    if chosen == "google_translate":
        return GoogleTranslateProvider(api_key=settings.google_translate_api_key)
    raise ValueError(f"Bilinmeyen translation provider: {chosen}")
