"""'Daha Fazla Bilgi' orchestrator — RAG + LLM (§ 6.4)."""
from __future__ import annotations

import logging

logger = logging.getLogger("tourlens.llm.enricher")


async def enrich_with_fallback(
    *,
    place_name: str,
    country: str | None,
    city: str | None,
    original_text: str,
    summary: str | None,
    target_lang: str,
) -> tuple[str, str, list[dict[str, str]], bool]:
    """Birincil enrichment provider, başarısızsa fallback.

    Returns:
        (enriched_text, provider_name, sources, grounded)
        - sources: her biri {"title", "url"} olan liste (grounding yoksa boş).
        - grounded: metin başarılı bir grounding çağrısından mı geldi? (caller
          bunu kullanarak boş kaynakları "yakalandı" mı yoksa "tekrar dene" mi
          ayırır — kota/hata durumunda kaynaklar NULL bırakılır.)
    """
    from ai_module.llm.factory import get_enrichment_provider

    primary = get_enrichment_provider()
    try:
        text, sources, grounded = await primary.enrich(
            place_name=place_name,
            country=country,
            city=city,
            original_text=original_text,
            summary=summary,
            target_lang=target_lang,
        )
        if text and text.strip():
            return text, primary.name, sources, grounded
    except Exception as exc:
        logger.warning("Primary enrichment başarısız (%s), fallback'e geçiliyor.", exc)

    fallback_name = "groq" if primary.name != "groq" else "gemini"
    try:
        fb = get_enrichment_provider(fallback_name)
        text, sources, grounded = await fb.enrich(
            place_name=place_name,
            country=country,
            city=city,
            original_text=original_text,
            summary=summary,
            target_lang=target_lang,
        )
        return text, fb.name, sources, grounded
    except Exception as exc:
        logger.exception("Fallback enrichment da başarısız: %s", exc)
        return "", "none", [], False
