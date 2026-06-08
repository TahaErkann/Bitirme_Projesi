"""Yüksek seviye kategorizasyon orchestrator — fallback dahil."""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("tourlens.llm.categorizer")


def categorize_with_fallback(ocr_text: str) -> dict[str, Any]:
    """Önce birincil provider, başarısızsa Gemini fallback.

    Master prompt § 2.3: "Groq çökerse Gemini Flash, Gemini çökerse Groq"
    """
    from ai_module.llm.factory import get_categorization_provider

    primary = get_categorization_provider()
    try:
        result = primary.categorize(ocr_text)
        if result and result.get("place_name"):
            return result
    except Exception as exc:
        logger.warning("Primary kategorizasyon başarısız (%s), fallback'e geçiliyor.", exc)

    fallback_name = "gemini" if primary.name != "gemini" else "groq"
    try:
        return get_categorization_provider(fallback_name).categorize(ocr_text)
    except Exception as exc:
        logger.exception("Fallback kategorizasyon da başarısız: %s", exc)
        return {
            "country": None, "city": None, "district": None,
            "place_name": "", "category": None, "summary": "",
            "tags": [], "confidence_score": 0.0,
        }
