"""Çeviri sağlayıcı için soyut sözleşme."""
from __future__ import annotations

from abc import ABC, abstractmethod


class BaseTranslationProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def translate(self, *, text: str, target_lang: str, source_lang: str | None = None) -> str:
        raise NotImplementedError
