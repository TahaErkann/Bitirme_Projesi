"""OCR sağlayıcı için soyut base sınıf (Strategy Pattern — § 9.2)."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TypedDict


class OCRResultDict(TypedDict, total=False):
    text: str
    language: str
    confidence: float
    # İçerik moderasyonu için ek sinyaller (yalnız destekleyen sağlayıcılarda
    # dolu gelir; örn. Google Vision aynı çağrıda etiket + SafeSearch döndürür).
    labels: list  # [{"description": str, "score": float}, ...]
    safe_search: dict  # {"adult": "LIKELY", "violence": "UNLIKELY", "racy": ...}


class BaseOCRProvider(ABC):
    """Tüm OCR sağlayıcıları bu sözleşmeyi sağlar."""

    name: str = "base"

    @abstractmethod
    def run(self, image_bytes: bytes) -> OCRResultDict:
        """Görsel byte'larından metin + meta çıkarır."""
        raise NotImplementedError
