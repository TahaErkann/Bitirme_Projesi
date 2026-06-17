"""Gemini Pro API — 'Daha Fazla Bilgi' (§ 6.4) ve fallback kategorizasyon."""
from __future__ import annotations

import json
import logging
from typing import Any

from ai_module.llm.base_provider import CategorizationProvider, EnrichmentProvider
from ai_module.llm.groq_provider import CATEGORIZATION_SYSTEM_PROMPT

logger = logging.getLogger("jourex.llm.gemini")

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
            content = self._generate_json_rest(
                system=CATEGORIZATION_SYSTEM_PROMPT, user=ocr_text
            )
            return json.loads(content)
        except Exception as exc:  # pragma: no cover
            logger.warning("Gemini kategorizasyon hatası: %s", exc)
            return {
                "country": None, "city": None, "district": None,
                "place_name": "", "category": None, "summary": "",
                "tags": [], "confidence_score": 0.0,
            }

    def _generate_json_rest(self, *, system: str, user: str) -> str:
        """Gemini REST generateContent — JSON modu + thinking KAPALI.

        SDK yolu yerine REST kullanırız çünkü (a) google-generativeai 0.8.3
        thinkingConfig'i güvenilir geçirmez, (b) gemini-2.5-flash thinking AÇIKken
        kotayı (429) şişiriyor. thinkingBudget=0 + responseMimeType=json ile temiz,
        ucuz ve hızlı kategorizasyon elde ederiz.
        """
        import time

        import httpx  # type: ignore

        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.categorization_model}:generateContent"
        )
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {
                # temperature=0 → kategori/şehir aynı girdi için deterministik
                # olsun (aynı tabelanın farklı yüklemelerinde kategori oynamasını
                # en aza indirir). thinking KAPALI + JSON modu.
                "temperature": 0.0,
                "responseMimeType": "application/json",
                "thinkingConfig": {"thinkingBudget": 0},
            },
        }
        # Ücretsiz katmanda geçici 429/503/500 görülebilir → kısa backoff'lu retry.
        resp = None
        for attempt in range(3):
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(url, params={"key": self.api_key}, json=body)
            if resp.status_code == 200:
                break
            if resp.status_code in (429, 500, 503) and attempt < 2:
                logger.warning(
                    "Gemini kategorizasyon geçici hata %s (deneme %d) — tekrar.",
                    resp.status_code, attempt + 1,
                )
                time.sleep(3 * (attempt + 1))
                continue
            break
        if resp is None or resp.status_code != 200:
            resp.raise_for_status()  # kalıcı hata → categorize empty döndürür → fallback

        data = resp.json()
        cand = (data.get("candidates") or [{}])[0]
        parts = ((cand.get("content") or {}).get("parts")) or []
        return "".join(
            p.get("text", "")
            for p in parts
            if p.get("text") and not p.get("thought")
        )

    # Grounding (Google Search → KAYNAKLAR) için model fallback zinciri.
    # Birincil model (env: GEMINI_ENRICHMENT_MODEL) en başa konur; ardından
    # kotası AYRI olan diğer flash modelleri denenir. Böylece bir modelin
    # günlük kotası (429) dolunca grounding ve dolayısıyla kaynaklar başka
    # modelle gelmeye devam eder. (gemini-flash-latest = en güncel flash alias.)
    _ENRICH_FALLBACK_MODELS: tuple[str, ...] = (
        "gemini-3.5-flash",
        "gemini-2.5-flash",
        "gemini-flash-latest",
    )

    def _enrich_model_chain(self) -> list[str]:
        """Birincil (env) model + fallback'ler — sıra korunarak tekrarsız."""
        out: list[str] = []
        for m in (self.enrichment_model, *self._ENRICH_FALLBACK_MODELS):
            if m and m not in out:
                out.append(m)
        return out

    async def enrich(
        self,
        *,
        place_name: str,
        country: str | None,
        city: str | None,
        original_text: str,
        summary: str | None,
        target_lang: str,
    ) -> tuple[str, list[dict[str, str]], bool]:
        self._ensure_configured()

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

        # 1) Google Search grounding (GERÇEK kaynaklar) — MODEL ZİNCİRİ üzerinden
        # REST ile. İlk 200+metin dönen model kazanır; biri 429 olursa otomatik
        # bir sonraki modele geçilir (§ 7.10/7.32). grounded=True ise kaynaklar
        # "yakalanmış" sayılır (boş olsa bile); False ise grounding'e hiç
        # ulaşılamadı (kota/hata) → caller cache'te NULL bırakıp sonra tekrar
        # denemeli (kota gelince kaynaklar otomatik gelsin).
        text, sources, grounded = await self._enrich_grounded_chain(
            models=self._enrich_model_chain(),
            system=system,
            user_prompt=user_prompt,
            generation_config=generation_config,
        )
        if grounded and text:
            return text, sources, True

        # 2) Grounding zinciri tümüyle başarısız → grounding'siz düz SDK (kaynaksız).
        text = await self._enrich_plain_sdk(
            system=system,
            user_prompt=user_prompt,
            generation_config=generation_config,
        )
        return (text or "").strip(), [], False

    async def _enrich_grounded_chain(
        self,
        *,
        models: list[str],
        system: str,
        user_prompt: str,
        generation_config: dict[str, Any],
    ) -> tuple[str, list[dict[str, str]], bool]:
        """Grounding'i model zinciri üzerinde dener; ilk işe yarayan kazanır.

        Returns (text, sources, grounded). grounded=True yalnızca bir model
        200 + kullanılabilir metin döndürdüğünde olur; o noktada kaynaklar
        (boş da olsa) "yakalanmış" sayılır. Hiçbir model tutmazsa ("", [], False).
        """
        for model in models:
            text, sources, ok = await self._enrich_grounded_once(
                model=model,
                system=system,
                user_prompt=user_prompt,
                generation_config=generation_config,
            )
            if ok and text.strip():
                logger.info(
                    "Grounding başarılı: model=%s, %d kaynak", model, len(sources)
                )
                return text.strip(), sources, True
        logger.warning(
            "Grounding zinciri tümüyle başarısız (modeller: %s) — kaynaksız yola düşülüyor.",
            ", ".join(models),
        )
        return "", [], False

    async def _enrich_grounded_once(
        self,
        *,
        model: str,
        system: str,
        user_prompt: str,
        generation_config: dict[str, Any],
    ) -> tuple[str, list[dict[str, str]], bool]:
        """Tek model için REST generateContent + google_search → (metin, kaynaklar, ok).

        ok=True yalnızca HTTP 200 döndüğünde (grounding gerçekten çalıştı; kaynak
        bulunmasa bile). 429/hata/exception → ok=False (bir sonraki modele geç).
        Kaynaklar grounding_metadata.groundingChunks[].web.{uri,title}'dan gelir.
        """
        import httpx  # type: ignore

        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{model}:generateContent"
        )
        body: dict[str, Any] = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
            "tools": [{"google_search": {}}],
            "generationConfig": {
                "temperature": generation_config["temperature"],
                "maxOutputTokens": generation_config["max_output_tokens"],
                "topP": generation_config["top_p"],
                # ⚠ KRİTİK: flash modelleri "düşünen" modeldir. thinking AÇIKken
                # (a) düşünme izi cevaba sızıyor ve (b) model gerçek grounding
                # yapmak yerine aramayı düşünme metninde simüle ediyor →
                # groundingMetadata boş kalıyor. thinkingBudget=0 ile her ikisi de
                # çözülür: tek temiz cevap part'ı + gerçek kaynaklar.
                "thinkingConfig": {"thinkingBudget": 0},
            },
        }
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(url, params={"key": self.api_key}, json=body)
            data = resp.json()
            if resp.status_code != 200:
                logger.warning(
                    "Gemini grounded REST %s (model=%s): %s",
                    resp.status_code,
                    model,
                    (data.get("error") or {}).get("message", data),
                )
                return "", [], False

            candidates = data.get("candidates") or []
            if not candidates:
                # 200 ama boş — grounding çalıştı sayılır ama metin yok; üst katman
                # text.strip() ile eler ve bir sonraki modele geçer.
                return "", [], True
            cand = candidates[0]
            parts = ((cand.get("content") or {}).get("parts")) or []
            # Güvenlik kemeri: thought part'larını metne KATMA — yalnız cevap part'ları.
            text = "\n".join(
                p.get("text", "")
                for p in parts
                if p.get("text") and not p.get("thought")
            ).strip()

            sources: list[dict[str, str]] = []
            seen: set[str] = set()
            grounding = cand.get("groundingMetadata") or {}
            for chunk in grounding.get("groundingChunks") or []:
                web = chunk.get("web") or {}
                uri = web.get("uri")
                if not uri or uri in seen:
                    continue
                seen.add(uri)
                sources.append({"title": web.get("title") or uri, "url": uri})

            logger.info(
                "Gemini grounded enrich: %d karakter, %d kaynak (model=%s)",
                len(text), len(sources), model,
            )
            return text, sources, True
        except Exception as exc:  # pragma: no cover
            logger.warning("Gemini grounded REST hatası (model=%s): %s", model, exc)
            return "", [], False

    async def _enrich_plain_sdk(
        self, *, system: str, user_prompt: str, generation_config: dict[str, Any]
    ) -> str:
        """Grounding'siz düz Gemini SDK yolu (kaynaksız fallback)."""
        import google.generativeai as genai  # type: ignore

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
                    logger.info("Gemini enrich (plain) modeli kullanıldı: %s", model_name)
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
