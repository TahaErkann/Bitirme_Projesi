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
    "CHECKING_DUPLICATE",
    "CATEGORIZING",
    "COMPLETED",
    "DUPLICATE",
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
    error: str | None = None
