"""MinIO yardımcıları — temp + originals + thumbnails (§ 4.3).

Bucket: tourlens-images
Path:
  - originals/{place_id}/{image_id}.jpg
  - thumbnails/{place_id}/{image_id}.jpg
  - temp/{upload_id}.jpg
"""
from __future__ import annotations

import io
import logging
from functools import lru_cache

from minio import Minio  # type: ignore
from minio.error import S3Error  # type: ignore

from app.core.config import settings  # type: ignore

logger = logging.getLogger("tourlens.storage.minio")


@lru_cache(maxsize=1)
def _get_client() -> Minio:
    client = Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_use_ssl,
    )
    # Bucket varlığını garanti et (idempotent)
    try:
        if not client.bucket_exists(settings.minio_bucket):
            client.make_bucket(settings.minio_bucket)
    except S3Error as exc:  # pragma: no cover
        logger.warning("MinIO bucket kontrolü başarısız: %s", exc)
    return client


def put_temp_object(*, upload_id: str, content: bytes, content_type: str) -> str:
    """temp/{upload_id} altına yaz; object adı döner."""
    client = _get_client()
    object_name = f"temp/{upload_id}"
    client.put_object(
        bucket_name=settings.minio_bucket,
        object_name=object_name,
        data=io.BytesIO(content),
        length=len(content),
        content_type=content_type,
    )
    return object_name


def get_temp_object(upload_id: str) -> bytes:
    client = _get_client()
    object_name = f"temp/{upload_id}"
    resp = client.get_object(settings.minio_bucket, object_name)
    try:
        return resp.read()
    finally:
        resp.close()
        resp.release_conn()


def put_original(*, place_id: str, image_id: str, content: bytes, content_type: str) -> str:
    client = _get_client()
    object_name = f"originals/{place_id}/{image_id}.jpg"
    client.put_object(
        bucket_name=settings.minio_bucket,
        object_name=object_name,
        data=io.BytesIO(content),
        length=len(content),
        content_type=content_type,
    )
    return object_name


def public_url(object_name: str) -> str:
    """Dış erişim URL'si (Nginx veya MinIO console üzerinden)."""
    base = settings.minio_public_url.rstrip("/")
    return f"{base}/{settings.minio_bucket}/{object_name}"
