"""Pipeline 3. adım: embedding + duplicate detection (master prompt § 6.3)."""
from __future__ import annotations

import logging
from typing import Any

from app.tasks.celery_app import celery_app

logger = logging.getLogger("tourlens.tasks.embedding")


@celery_app.task(bind=True, name="tasks.check_duplicate")
def check_duplicate(self, prev: dict[str, Any]) -> dict[str, Any]:
    """Embedding üret → Milvus'ta benzerleri ara → place_name+city kontrolü.

    İKİ KOŞUL aynı anda sağlanırsa MÜKERRER kabul edilir.
    """
    self.update_state(state="CHECKING_DUPLICATE", meta={"progress": 60})

    from ai_module.embedding.embedding_service import EmbeddingService  # type: ignore
    from ai_module.embedding.milvus_client import MilvusClient  # type: ignore

    cleaned_text = prev["cleaned_text"]
    if not cleaned_text.strip():
        return {**prev, "duplicate_of": None, "embedding": None, "progress": 70}

    self.update_state(state="CHECKING_DUPLICATE", meta={"progress": 65})
    emb = EmbeddingService().encode(cleaned_text)
    self.update_state(state="CHECKING_DUPLICATE", meta={"progress": 70})
    candidates = MilvusClient().search(emb, top_k=5)
    self.update_state(state="CHECKING_DUPLICATE", meta={"progress": 73})

    return {
        **prev,
        "embedding": emb.tolist() if hasattr(emb, "tolist") else list(emb),
        "candidates": candidates,
        "progress": 75,
    }
