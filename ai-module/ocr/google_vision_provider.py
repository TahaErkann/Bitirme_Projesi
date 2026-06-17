"""Google Cloud Vision OCR sağlayıcısı (§ 6.1).

Bu sağlayıcı, ``google-cloud-vision`` SDK'sı yerine doğrudan REST API'yi
kullanır. Sebep: SDK Application Default Credentials (servis hesabı JSON)
gerektirir; biz proje genelinde tek-anahtar ``GOOGLE_VISION_API_KEY`` ile
ilerliyoruz. REST endpoint:

    POST https://vision.googleapis.com/v1/images:annotate?key=API_KEY
"""
from __future__ import annotations

import base64
import logging
from typing import Any

import requests

from ai_module.ocr.base_provider import BaseOCRProvider, OCRResultDict

logger = logging.getLogger("jourex.ocr.google_vision")

VISION_ENDPOINT = "https://vision.googleapis.com/v1/images:annotate"


class GoogleVisionProvider(BaseOCRProvider):
    name = "google_vision"

    def __init__(self, api_key: str | None = None) -> None:
        if not api_key:
            logger.warning(
                "GOOGLE_VISION_API_KEY boş — OCR çağrıları başarısız olacak."
            )
        self.api_key = api_key or ""

    def run(self, image_bytes: bytes) -> OCRResultDict:
        """REST API ile DOCUMENT_TEXT_DETECTION + içerik moderasyon sinyalleri.

        Tabela ve yoğun metin için DOCUMENT_TEXT_DETECTION daha iyi sonuç
        verir; metin algılama + bloklara ayırma + dil tespiti yapar.

        İçerik moderasyonu (yükleme kontrolü) için AYNI çağrıda iki ek özellik
        daha istenir — böylece ekstra API turu/maliyeti olmadan:
          - SAFE_SEARCH_DETECTION → uygunsuz (adult/violence/racy) görsel tespiti
          - LABEL_DETECTION       → sahne etiketleri. NOT: metinsiz görsel ELEME
            kararı tamamen METNE dayalıdır (OCR metni yoksa reddedilir); etiketler
            kararı DEĞİŞTİRMEZ, yalnızca red gerekçesini zenginleştirir (örn.
            "algılanan içerik: Cat, Wildlife").
        """
        if not self.api_key:
            return {"text": "", "language": "", "confidence": 0.0, "labels": [], "safe_search": {}}

        payload: dict[str, Any] = {
            "requests": [
                {
                    "image": {
                        "content": base64.b64encode(image_bytes).decode("ascii"),
                    },
                    "features": [
                        {"type": "DOCUMENT_TEXT_DETECTION", "maxResults": 1},
                        {"type": "SAFE_SEARCH_DETECTION"},
                        {"type": "LABEL_DETECTION", "maxResults": 10},
                    ],
                }
            ]
        }

        try:
            resp = requests.post(
                VISION_ENDPOINT,
                params={"key": self.api_key},
                json=payload,
                timeout=30,
            )
        except requests.RequestException as exc:
            logger.error("Google Vision REST isteği başarısız: %s", exc)
            return {"text": "", "language": "", "confidence": 0.0, "labels": [], "safe_search": {}}

        if resp.status_code != 200:
            logger.error(
                "Google Vision %s döndü: %s",
                resp.status_code,
                resp.text[:500],
            )
            return {"text": "", "language": "", "confidence": 0.0, "labels": [], "safe_search": {}}

        body = resp.json()
        responses = body.get("responses") or []
        if not responses:
            return {"text": "", "language": "", "confidence": 0.0, "labels": [], "safe_search": {}}

        first = responses[0]
        if "error" in first:
            logger.error("Google Vision hata: %s", first["error"])
            return {"text": "", "language": "", "confidence": 0.0, "labels": [], "safe_search": {}}

        full = first.get("fullTextAnnotation") or {}
        full_text = full.get("text", "") or ""

        # Confidence — sayfa-blok ortalaması
        confidences: list[float] = []
        language = ""
        for page in full.get("pages") or []:
            for block in page.get("blocks") or []:
                conf = block.get("confidence")
                if isinstance(conf, (int, float)):
                    confidences.append(float(conf))
            if not language:
                detected = (page.get("property") or {}).get(
                    "detectedLanguages"
                ) or []
                if detected:
                    language = detected[0].get("languageCode", "") or ""

        avg_conf = (
            sum(confidences) / len(confidences) if confidences else 0.0
        )

        # İçerik moderasyon sinyalleri — SafeSearch + etiketler.
        safe_raw = first.get("safeSearchAnnotation") or {}
        safe_search = {
            key: safe_raw.get(key)
            for key in ("adult", "spoof", "medical", "violence", "racy")
            if safe_raw.get(key)
        }
        labels = [
            {
                "description": lbl.get("description") or "",
                "score": float(lbl.get("score") or 0.0),
            }
            for lbl in (first.get("labelAnnotations") or [])
            if lbl.get("description")
        ]

        return {
            "text": full_text,
            "language": language,
            "confidence": float(avg_conf),
            "labels": labels,
            "safe_search": safe_search,
        }
