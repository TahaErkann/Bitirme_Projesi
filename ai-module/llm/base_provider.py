"""LLM provider için soyut sözleşmeler."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class BaseLLMProvider(ABC):
    """Soyut LLM provider — tüm sağlayıcıların ortak yüzü."""

    name: str = "base"

    @abstractmethod
    def chat(self, *, system: str, user: str, json_mode: bool = False) -> str:
        """Tek-seferlik prompt → metin yanıt."""
        raise NotImplementedError


class CategorizationProvider(BaseLLMProvider):
    """Kategorizasyon için yüksek seviye sözleşme."""

    @abstractmethod
    def categorize(self, ocr_text: str) -> dict[str, Any]:
        """OCR metnini JSON formatında kategorilere ayırır."""
        raise NotImplementedError


class EnrichmentProvider(BaseLLMProvider):
    """'Daha Fazla Bilgi' için sözleşme — chat değil tek cevap."""

    @abstractmethod
    async def enrich(
        self,
        *,
        place_name: str,
        country: str | None,
        city: str | None,
        original_text: str,
        summary: str | None,
        target_lang: str,
    ) -> str:
        """300–500 kelimelik tek bir zenginleştirilmiş metin üretir."""
        raise NotImplementedError
