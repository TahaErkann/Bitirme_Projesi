"""Google Cloud Translation API v2 sağlayıcısı."""
from __future__ import annotations

import logging

import httpx

from ai_module.translation.base_provider import BaseTranslationProvider

logger = logging.getLogger("jourex.translation.google")

GOOGLE_V2_URL = "https://translation.googleapis.com/language/translate/v2"


class GoogleTranslateProvider(BaseTranslationProvider):
    name = "google_translate"

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    async def translate(
        self, *, text: str, target_lang: str, source_lang: str | None = None
    ) -> str:
        params = {
            "q": text,
            "target": target_lang,
            "format": "text",
            "key": self.api_key,
        }
        if source_lang:
            params["source"] = source_lang

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(GOOGLE_V2_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
        try:
            return data["data"]["translations"][0]["translatedText"]
        except (KeyError, IndexError) as exc:
            logger.error("Google Translate yanıt formatı beklenmedik: %s", data)
            raise RuntimeError("Translation provider yanıtı parse edilemedi.") from exc
