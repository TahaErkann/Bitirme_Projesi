"""Pipeline 4. ve 5. adım: LLM kategorizasyon + DB persist."""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.tasks.celery_app import celery_app

logger = logging.getLogger("tourlens.tasks.categorization")


@celery_app.task(bind=True, name="tasks.categorize_with_llm")
def categorize_with_llm(self, prev: dict[str, Any]) -> dict[str, Any]:
    """Groq (Llama 3.3 70B) ile JSON kategorizasyon."""
    self.update_state(state="CATEGORIZING", meta={"progress": 78})

    from ai_module.llm.factory import get_categorization_provider  # type: ignore

    provider = get_categorization_provider()
    self.update_state(state="CATEGORIZING", meta={"progress": 82})
    cat = provider.categorize(prev["cleaned_text"])
    self.update_state(state="CATEGORIZING", meta={"progress": 88})
    return {**prev, "categorization": cat, "progress": 90}


@celery_app.task(bind=True, name="tasks.save_results")
def save_results(self, prev: dict[str, Any]) -> dict[str, Any]:
    """Pipeline çıktılarını PostgreSQL + Milvus + MinIO'ya kalıcı yazar.

    Mükerrer tespit edildiyse `DUPLICATE` durumu döner; aksi halde `COMPLETED`.

    Senkron Celery task'ı içinde async DB yardımcısı çalıştırmak için her
    çağrıda **yeni bir event loop** açıyoruz; loop'u açıp finally'da
    kapatmak `asyncio.run()`'ın kendi davranışıdır ama biz async kaynakları
    (engine, asyncpg connection) loop ömrü içinde tüketip dispose ettiğimiz
    için `asyncio.run` yeterli. Yine de ardışık iki task'ın aynı modülün
    cache'lediği bir Future'ı paylaşmaması adına persist tarafında engine
    her seferinde sıfırdan yaratılır (bkz. persistence.py).
    """
    self.update_state(state="CATEGORIZING", meta={"progress": 93})

    from ai_module.storage.persistence import persist_pipeline_result  # type: ignore

    from app.core.config import settings

    place_id, duplicate_of = asyncio.run(
        persist_pipeline_result(prev, similarity_threshold=settings.similarity_threshold)
    )

    if duplicate_of is not None:
        return {"status": "DUPLICATE", "duplicate_of": str(duplicate_of), "progress": 100}
    return {"status": "COMPLETED", "place_id": str(place_id), "progress": 100}
