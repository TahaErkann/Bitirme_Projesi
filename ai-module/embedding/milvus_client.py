"""Milvus istemcisi — vektör arama ve insert (§ 4.2 + § 6.3).

Collection: place_embeddings
Schema:
  - id: INT64 (auto pk)
  - place_id: VARCHAR(36)
  - embedding: FLOAT_VECTOR(384)
  - text_hash: VARCHAR(64)
Index: IVF_FLAT, metric_type=COSINE
"""
from __future__ import annotations

import hashlib
import logging
from functools import lru_cache
from typing import Any

import numpy as np

logger = logging.getLogger("tourlens.milvus")


@lru_cache(maxsize=1)
def _connect_and_ensure_collection():
    """Milvus'a bağlan ve koleksiyonun varlığını garanti et."""
    from app.core.config import settings  # type: ignore
    from pymilvus import (  # type: ignore
        Collection,
        CollectionSchema,
        DataType,
        FieldSchema,
        connections,
        utility,
    )

    connections.connect(alias="default", host=settings.milvus_host, port=str(settings.milvus_port))

    if not utility.has_collection(settings.milvus_collection_name):
        fields = [
            FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
            FieldSchema(name="place_id", dtype=DataType.VARCHAR, max_length=36),
            FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=settings.embedding_dim),
            FieldSchema(name="text_hash", dtype=DataType.VARCHAR, max_length=64),
        ]
        schema = CollectionSchema(fields, description="TourLens place embeddings")
        coll = Collection(name=settings.milvus_collection_name, schema=schema)
        coll.create_index(
            field_name="embedding",
            index_params={"index_type": "IVF_FLAT", "metric_type": "COSINE", "params": {"nlist": 1024}},
        )
    else:
        coll = Collection(settings.milvus_collection_name)

    coll.load()
    return coll


class MilvusClient:
    """Milvus üst seviye sarmalayıcı."""

    def __init__(self) -> None:
        self.collection = _connect_and_ensure_collection()

    @staticmethod
    def text_hash(text: str) -> str:
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    def insert(self, *, place_id: str, embedding: np.ndarray, source_text: str) -> int:
        """Yeni bir embedding'i Milvus'a yazar."""
        rows = [
            [place_id],
            [embedding.tolist() if hasattr(embedding, "tolist") else list(embedding)],
            [self.text_hash(source_text)],
        ]
        result = self.collection.insert(rows)
        self.collection.flush()
        return int(result.primary_keys[0]) if result.primary_keys else -1

    def search(self, embedding: np.ndarray, *, top_k: int = 5) -> list[dict[str, Any]]:
        """Cosine similarity ile en yakın `top_k` kaydı döner."""
        params = {"metric_type": "COSINE", "params": {"nprobe": 16}}
        results = self.collection.search(
            data=[embedding.tolist() if hasattr(embedding, "tolist") else list(embedding)],
            anns_field="embedding",
            param=params,
            limit=top_k,
            output_fields=["place_id", "text_hash"],
        )

        hits = results[0] if results else []
        out: list[dict[str, Any]] = []
        for h in hits:
            out.append(
                {
                    "place_id": h.entity.get("place_id"),
                    "text_hash": h.entity.get("text_hash"),
                    "score": float(h.score),  # COSINE: 1.0 = aynı
                }
            )
        return out
