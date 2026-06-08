"""LLM provider factory + Strategy seçimi (§ 9.2).

Kategorizasyon: Groq önce, başarısızsa Gemini Flash.
Enrichment: Gemini önce, başarısızsa Groq.
"""
from __future__ import annotations

from app.core.config import settings  # type: ignore
from ai_module.llm.base_provider import CategorizationProvider, EnrichmentProvider
from ai_module.llm.gemini_provider import GeminiProvider
from ai_module.llm.groq_provider import GroqProvider


def get_categorization_provider(name: str | None = None) -> CategorizationProvider:
    chosen = (name or settings.llm_categorization_provider).lower()
    if chosen == "groq":
        return GroqProvider(api_key=settings.groq_api_key, model=settings.groq_model)
    if chosen == "gemini":
        return GeminiProvider(
            api_key=settings.gemini_api_key,
            enrichment_model=settings.gemini_enrichment_model,
            categorization_model=settings.gemini_categorization_model,
        )
    raise ValueError(f"Bilinmeyen kategorizasyon provider: {chosen}")


def get_enrichment_provider(name: str | None = None) -> EnrichmentProvider:
    chosen = (name or settings.llm_enrichment_provider).lower()
    if chosen == "gemini":
        return GeminiProvider(
            api_key=settings.gemini_api_key,
            enrichment_model=settings.gemini_enrichment_model,
            categorization_model=settings.gemini_categorization_model,
        )
    if chosen == "groq":
        # Groq enrichment fallback — chat üzerinden uzun cevap üretir.
        # NOT: ENRICH_SYSTEM_PROMPT_TEMPLATE'de iki placeholder var
        # ({target_lang_name}, {target_lang_code}); ikisini de geçirmek
        # ŞART, aksi halde KeyError fırlatır ve fallback sessizce ölür.
        from ai_module.llm.gemini_provider import ENRICH_SYSTEM_PROMPT_TEMPLATE, LANG_NAMES

        groq = GroqProvider(api_key=settings.groq_api_key, model=settings.groq_model)

        class GroqEnricher(EnrichmentProvider):
            name = "groq"

            def chat(self, *, system, user, json_mode=False):
                return groq.chat(system=system, user=user, json_mode=json_mode)

            async def enrich(
                self, *, place_name, country, city, original_text, summary, target_lang,
            ) -> str:
                target_lang_name = LANG_NAMES.get(target_lang, "English")
                sys_prompt = ENRICH_SYSTEM_PROMPT_TEMPLATE.format(
                    target_lang_name=target_lang_name,
                    target_lang_code=target_lang,
                )
                user_prompt = "\n".join(
                    [
                        f"Place / subject name: {place_name}",
                        f"Country: {country or '-'}",
                        f"City: {city or '-'}",
                        f"Brief summary: {summary or '-'}",
                        f"Sign / source text: {original_text[:1500]}",
                        f"\nReminder: write the ENTIRE answer ONLY in {target_lang_name} ({target_lang}). Begin now.",
                    ]
                )
                return groq.chat(system=sys_prompt, user=user_prompt, json_mode=False)

        return GroqEnricher()

    raise ValueError(f"Bilinmeyen enrichment provider: {chosen}")
