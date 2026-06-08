"""Sentence-Transformers ile embedding servisi (§ 6.3)."""
from __future__ import annotations

import logging
import threading
from functools import lru_cache

import numpy as np

logger = logging.getLogger("tourlens.embedding")

_LOAD_LOCK = threading.Lock()


@lru_cache(maxsize=1)
def _load_model(model_name: str):
    """Modeli ilk çağrıda yükle, ardından cache'le.

    `all-MiniLM-L6-v2` 384 boyutlu — CPU üzerinde rahat çalışır (master prompt § 14).
    """
    from sentence_transformers import SentenceTransformer  # type: ignore

    with _LOAD_LOCK:
        logger.info("Sentence-Transformers modeli yükleniyor: %s", model_name)
        return SentenceTransformer(model_name)


class EmbeddingService:
    def __init__(self, model_name: str | None = None) -> None:
        from app.core.config import settings  # type: ignore
        self.model_name = model_name or settings.embedding_model

    def encode(self, text: str) -> np.ndarray:
        """Tek metin için 384 boyutlu vektör döner."""
        model = _load_model(self.model_name)
        vec = model.encode(text, normalize_embeddings=True)
        return np.asarray(vec, dtype="float32")
