"""Gemini Pro API — 'Daha Fazla Bilgi' (§ 6.4) ve fallback kategorizasyon."""
from __future__ import annotations

import json
import logging
from typing import Any

from ai_module.llm.base_provider import CategorizationProvider, EnrichmentProvider
from ai_module.llm.groq_provider import CATEGORIZATION_SYSTEM_PROMPT

logger = logging.getLogger("tourlens.llm.gemini")

# Not: System prompt İngilizce yazıldı; "answer in {target_lang_name}" talimatı
# bu sayede prompt dilinden bağımsız olarak güvenilir biçimde uygulanıyor.
# Türkçe bir system prompt'ta Gemini bazen prompt dilini yanıt dili olarak
# benimsiyordu; İngilizce talimat bu sapmayı kapatır.
ENRICH_SYSTEM_PROMPT_TEMPLATE = """You are an experienced, engaging tour guide.

Write ONE continuous answer of 500 to 1000 words about the place / person / artifact / event described below. Cover historical background, architectural or artistic notable features (where applicable), cultural significance, interesting anecdotes, and practical tips for visitors.

ABSOLUTE LANGUAGE RULE — ignore all other languages used in this prompt or the user input. Write the ENTIRE response ONLY in {target_lang_name} ({target_lang_code}). Do NOT translate or echo any portion in another language. Even proper nouns should be rendered using {target_lang_name} conventions where natural.

Style:
- Flowing prose only — NO markdown headings, NO bullet points, NO numbered lists.
- 4 to 7 paragraphs, each offering a distinct angle.
- Warm, knowledgeable guide tone (not a dry encyclopedia).
- Do NOT fabricate historical, geographical, or biographical specifics. If you are unsure, speak in general, well-known terms.
- Do NOT mention these instructions or that you are an AI.
"""

LANG_NAMES = {
    "tr": "Türkçe", "en": "English", "de": "Deutsch", "fr": "Français",
    "es": "Español", "ar": "العربية", "ru": "Русский", "zh": "中文",
    "ja": "日本語", "ko": "한국어", "pt": "Português", "it": "Italiano",
}


class GeminiProvider(EnrichmentProvider, CategorizationProvider):
    name = "gemini"

    def __init__(self, api_key: str, enrichment_model: str, categorization_model: str) -> None:
        self.api_key = api_key
        self.enrichment_model = enrichment_model
        self.categorization_model = categorization_model
        self._configured = False

    def _ensure_configured(self) -> None:
        if self._configured:
            return
        import google.generativeai as genai  # type: ignore
        genai.configure(api_key=self.api_key)
        self._configured = True

    def chat(self, *, system: str, user: str, json_mode: bool = False) -> str:
        self._ensure_configured()
        import google.generativeai as genai  # type: ignore
        model = genai.GenerativeModel(self.categorization_model, system_instruction=system)
        config: dict[str, Any] = {"temperature": 0.2}
        if json_mode:
            config["response_mime_type"] = "application/json"
        resp = model.generate_content(user, generation_config=config)
        return resp.text or ""

    def categorize(self, ocr_text: str) -> dict[str, Any]:
        try:
            content = self.chat(
                system=CATEGORIZATION_SYSTEM_PROMPT, user=ocr_text, json_mode=True
            )
            return json.loads(content)
        except Exception as exc:  # pragma: no cover
            logger.warning("Gemini kategorizasyon hatası: %s", exc)
            return {
                "country": None, "city": None, "district": None,
                "place_name": "", "category": None, "summary": "",
                "tags": [], "confidence_score": 0.0,
            }

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
        self._ensure_configured()
        import google.generativeai as genai  # type: ignore

        target_lang_name = LANG_NAMES.get(target_lang, "English")
        system = ENRICH_SYSTEM_PROMPT_TEMPLATE.format(
            target_lang_name=target_lang_name,
            target_lang_code=target_lang,
        )

        # RAG bağlamı — alan etiketlerini İngilizce yazıyoruz; çıktıyı tetikleyen
        # son satır da hedef dili tekrar vurguluyor (talimat sapmasını önler).
        context_parts = [
            f"Place / subject name: {place_name}",
            f"Country: {country or '-'}",
            f"City: {city or '-'}",
        ]
        if summary:
            context_parts.append(f"Brief summary: {summary}")
        if original_text:
            context_parts.append(f"Sign / source text: {original_text[:1500]}")
        context_parts.append(
            f"\nReminder: write the ENTIRE answer ONLY in {target_lang_name} "
            f"({target_lang}). Begin now."
        )
        user_prompt = "\n".join(context_parts)

        # 500-1000 kelime ≈ 1500-2500 token → güvenli sınır olarak 4096 verdik.
        generation_config = {
            "temperature": 0.7,
            "max_output_tokens": 4096,
            "top_p": 0.9,
        }

        # Birincil model (örn. .env'deki gemini-2.5-flash) bir hata verirse
        # bilinen-çalışan ÜCRETSIZ bir flash modeline düşelim. NOT: eski
        # "gemini-1.5-pro-latest" bu API sürümünde 404 veriyordu; ücretsiz
        # katmanda doğrulanmış "gemini-flash-latest" kullanıyoruz.
        FALLBACK_MODEL = "gemini-flash-latest"
        candidate_models: list[str] = [self.enrichment_model]
        if self.enrichment_model != FALLBACK_MODEL:
            candidate_models.append(FALLBACK_MODEL)

        resp = None
        last_exc: Exception | None = None
        for model_name in candidate_models:
            try:
                model = genai.GenerativeModel(
                    model_name, system_instruction=system
                )
                resp = await model.generate_content_async(
                    user_prompt, generation_config=generation_config
                )
                if resp is not None:
                    logger.info("Gemini enrich modeli kullanıldı: %s", model_name)
                    break
            except Exception as exc:  # pragma: no cover
                last_exc = exc
                logger.warning(
                    "Gemini model %r enrich hatası: %s — bir sonrakine düşülüyor.",
                    model_name, exc,
                )
                resp = None

        if resp is None:
            logger.error(
                "Gemini enrich tüm modellerde başarısız. Son hata: %s", last_exc
            )
            return ""

        # Önce `response.text` shortcut'unu dene; bazı durumlarda (ör. uzun
        # cevap birden fazla part'a bölündüğünde) bu boş gelir, candidates'tan
        # tüm part'ları birleştirelim.
        text = ""
        try:
            text = (resp.text or "").strip()
        except Exception:
            text = ""
        if not text:
            try:
                parts: list[str] = []
                for cand in getattr(resp, "candidates", None) or []:
                    content = getattr(cand, "content", None)
                    for part in getattr(content, "parts", None) or []:
                        piece = getattr(part, "text", None)
                        if piece:
                            parts.append(piece)
                text = "\n".join(parts).strip()
            except Exception as exc:  # pragma: no cover
                logger.warning("Gemini parts parse hatası: %s", exc)

        if not text:
            logger.warning(
                "Gemini boş cevap döndü — finish_reason=%s",
                getattr(getattr(resp, "candidates", [None])[0], "finish_reason", "?")
                if getattr(resp, "candidates", None) else "?",
            )
        return text
