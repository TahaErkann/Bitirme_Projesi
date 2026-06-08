"""Çeviri ile ilgili yardımcı şemalar."""
from __future__ import annotations

from typing import Final

# Master prompt § 6.5 — desteklenen 12 dil
SUPPORTED_LANGUAGES: Final[set[str]] = {
    "tr", "en", "de", "fr", "es", "ar",
    "ru", "zh", "ja", "ko", "pt", "it",
}
