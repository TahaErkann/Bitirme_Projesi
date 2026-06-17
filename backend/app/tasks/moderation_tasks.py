"""Pipeline ara adımı: içerik moderasyonu (yükleme kontrol mekanizması).

`run_ocr` ile `check_duplicate` arasında çalışır. OCR metni + Google Vision
sinyalleri (etiket + SafeSearch) ile yüklenen görselin uygulamanın amacıyla
(tarihi/turistik tabela) bağdaşıp bağdaşmadığına karar verir.

Karar `prev["moderation"]` içine yazılır:
    {"rejected": bool, "reason_code": str|None, "reason": str, ...}

Reddedilirse downstream task'lar (check_duplicate / categorize / save) kısa
devre yapar; yeni Place YARATILMAZ → görsel DB'ye/Keşfet'e kaydedilmez.
"""
from __future__ import annotations

import logging
from typing import Any

from app.tasks.celery_app import celery_app

logger = logging.getLogger("jourex.tasks.moderation")


@celery_app.task(bind=True, name="tasks.moderate_content")
def moderate_content(self, prev: dict[str, Any]) -> dict[str, Any]:
    """OCR metni + Vision sinyalleriyle içerik uygunluğunu denetler."""
    self.update_state(state="MODERATING", meta={"progress": 56})

    from app.core.config import settings

    # Moderasyon kapalıysa hiçbir şeyi engelleme (eski davranış).
    if not settings.moderation_enabled:
        return {
            **prev,
            "moderation": {"rejected": False, "reason_code": None, "reason": ""},
            "progress": 59,
        }

    from ai_module.llm.moderation import (  # type: ignore
        _meaningful_len,
        decide_moderation,
        moderate_text,
    )

    cleaned_text: str = prev.get("cleaned_text") or ""
    labels: list[dict] = prev.get("labels") or []
    safe_search: dict = prev.get("safe_search") or {}

    # LLM'i yalnızca anlamlı metin varsa çağır — metinsiz görsel (doğa/hayvan)
    # zaten "no_text" ile elenecek, gereksiz LLM çağrısı yapma.
    self.update_state(state="MODERATING", meta={"progress": 57})
    text_result = None
    if _meaningful_len(cleaned_text) >= settings.moderation_min_text_chars:
        text_result = moderate_text(cleaned_text)

    decision = decide_moderation(
        text_result=text_result,
        cleaned_text=cleaned_text,
        labels=labels,
        safe_search=safe_search,
        min_text_chars=settings.moderation_min_text_chars,
        safe_search_block=settings.moderation_safe_search_block,
        fail_open=settings.moderation_fail_open,
    )

    if decision.get("rejected"):
        logger.info(
            "İçerik REDDEDİLDİ: code=%s reason=%r content_type=%s text_len=%d",
            decision.get("reason_code"),
            decision.get("reason"),
            decision.get("content_type"),
            _meaningful_len(cleaned_text),
        )
    else:
        logger.info(
            "İçerik kabul edildi: content_type=%s confidence=%.2f",
            decision.get("content_type"),
            float(decision.get("confidence") or 0.0),
        )

    self.update_state(state="MODERATING", meta={"progress": 59})
    return {**prev, "moderation": decision, "progress": 59}
