"""/upload/* — görsel yükleme + task durumu."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.core.dependencies import get_optional_user
from app.models.user import User
from app.schemas.upload import UploadResponse, UploadStatusResponse
from app.services.upload_service import UploadService

router = APIRouter()


@router.post("/image", response_model=UploadResponse)
async def upload_image(
    image: UploadFile = File(...),
    crop_x: float | None = Form(default=None),
    crop_y: float | None = Form(default=None),
    crop_w: float | None = Form(default=None),
    crop_h: float | None = Form(default=None),
    current_user: User | None = Depends(get_optional_user),
) -> UploadResponse:
    """Tabela fotoğrafını yükler, Celery pipeline'ını tetikler.

    `crop_x/y/w/h` alanları opsiyonel; verilirse 0..1 arası normalize bir
    bölge bekler ve OCR sadece bu bölgeyi görür (preprocess'in en başında
    kırpılır). Dördü birden gelmezse crop yoksayılır.
    """
    user_id = current_user.id if current_user else None
    crop: list[float] | None = None
    if all(v is not None for v in (crop_x, crop_y, crop_w, crop_h)):
        crop = [float(crop_x), float(crop_y), float(crop_w), float(crop_h)]
    return await UploadService().handle_upload(image, user_id=user_id, crop=crop)


@router.get("/status/{task_id}", response_model=UploadStatusResponse)
async def upload_status(task_id: str) -> UploadStatusResponse:
    """Pipeline durumunu döner — frontend bu endpoint'i poll'lar."""
    # Celery AsyncResult ile durum okunur. Worker kurulduğunda buraya bağlanır.
    try:
        from app.tasks.celery_app import get_pipeline_status
        return get_pipeline_status(task_id)
    except Exception:  # pragma: no cover
        return UploadStatusResponse(task_id=task_id, status="PENDING")
