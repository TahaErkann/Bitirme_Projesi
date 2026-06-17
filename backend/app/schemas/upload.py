"""Upload şemaları — multipart yanıtları ve task durumu."""
from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel

# Master prompt § 11: Celery task durumları
TaskStatus = Literal[
    "PENDING",
    "PREPROCESSING",
    "OCR_PROCESSING",
    "MODERATING",
    "CHECKING_DUPLICATE",
    "CATEGORIZING",
    "COMPLETED",
    "DUPLICATE",
    "REJECTED",
    "FAILED",
]


class UploadResponse(BaseModel):
    """POST /upload/image cevabı — task_id polling için kullanılır."""

    task_id: str
    status: TaskStatus
    image_id: UUID | None = None


class UploadStatusResponse(BaseModel):
    """GET /upload/status/{task_id} cevabı."""

    task_id: str
    status: TaskStatus
    progress: int = 0  # 0..100
    place_id: UUID | None = None
    duplicate_of: UUID | None = None
    # İçerik moderasyonu reddinde doldurulur: reason_code frontend i18n anahtarına
    # eşlenir, reason ise sunucudan gelen (Türkçe) açıklama/loglama metnidir.
    reason_code: str | None = None
    reason: str | None = None
    error: str | None = None
