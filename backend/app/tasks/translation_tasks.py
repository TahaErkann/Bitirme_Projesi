"""Opsiyonel: arka plan çeviri ısıtma task'ları (warm-up)."""
from __future__ import annotations

from app.tasks.celery_app import celery_app


@celery_app.task(name="tasks.precompute_translation")
def precompute_translation(place_id: str, lang: str) -> dict:
    """Belirli bir yer ve dil için çeviriyi önceden üretir (opsiyonel)."""
    # Master prompt § 6.5: "Önceden çeviri YAPILMAZ".
    # Bu task yalnızca operatörün manuel ısıtmak istemesi için ayrılmıştır.
    return {"place_id": place_id, "lang": lang, "skipped": True}
