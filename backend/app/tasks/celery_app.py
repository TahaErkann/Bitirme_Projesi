"""Celery uygulaması ve pipeline orkestrasyonu.

Master prompt § 11:
  chain(
      preprocess_image.s(image_id),
      run_ocr.s(),
      check_duplicate.s(),
      categorize_with_llm.s(),
      save_results.s()
  ).apply_async()

Task durumları:
  PENDING, PREPROCESSING, OCR_PROCESSING,
  CHECKING_DUPLICATE, CATEGORIZING, COMPLETED, DUPLICATE, FAILED
"""
from __future__ import annotations

import logging

from celery import Celery, chain
from celery.result import AsyncResult

from app.core.config import settings
from app.schemas.upload import UploadStatusResponse

logger = logging.getLogger("jourex.celery")

# Celery instance
celery_app = Celery(
    "jourex",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=[
        "app.tasks.ocr_tasks",
        "app.tasks.moderation_tasks",
        "app.tasks.embedding_tasks",
        "app.tasks.categorization_tasks",
        "app.tasks.translation_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_track_started=True,
    task_time_limit=300,        # 5 dakika sert limit
    task_soft_time_limit=240,   # 4 dakika soft limit
    # Chain'in parent zinciri AsyncResult ile gezilebilsin diye:
    result_extended=True,
)


def enqueue_pipeline(
    *,
    upload_id: str,
    content: bytes,
    content_type: str,
    user_id: str | None,
    crop: list[float] | None = None,
) -> str:
    """Görsel pipeline'ını başlatır ve root task_id'yi döner.

    Görsel byte içeriği büyük olduğu için broker'a yollamak yerine MinIO'ya
    temp/{upload_id} olarak yazıp downstream task'lara sadece upload_id veriyoruz.

    `crop` verilirse preprocess_image task'ına `(x, y, w, h)` (hepsi 0..1)
    olarak iletilir; OCR sadece bu bölgeyi görür.
    """
    # Lazy import — döngüsel bağımlılığı kır
    from ai_module.storage.minio_client import put_temp_object  # type: ignore

    from app.tasks.categorization_tasks import categorize_with_llm, save_results
    from app.tasks.embedding_tasks import check_duplicate
    from app.tasks.moderation_tasks import moderate_content
    from app.tasks.ocr_tasks import preprocess_image, run_ocr

    # 1) MinIO temp/{upload_id} yaz
    put_temp_object(upload_id=upload_id, content=content, content_type=content_type)

    # 2) Chain — OCR'dan sonra içerik moderasyonu: alakasız/uygunsuz görseller
    # embedding/kategorizasyon/DB yazımından ÖNCE elenir (boşa iş yapılmaz).
    pipeline = chain(
        preprocess_image.s(upload_id, user_id, crop),
        run_ocr.s(),
        moderate_content.s(),
        check_duplicate.s(),
        categorize_with_llm.s(),
        save_results.s(),
    )
    result = pipeline.apply_async()
    return result.id


def get_pipeline_status(task_id: str) -> UploadStatusResponse:
    """AsyncResult'tan UploadStatusResponse türetir.

    Celery `chain` döndürdüğünde root id sondaki task'a aittir;
    önceki task'lara `parent` zinciri ile erişilir. Pipeline ilerlemesini
    doğru göstermek için zinciri baştan sona dolaşıp en güncel state'i alıyoruz.
    """
    last = AsyncResult(task_id, app=celery_app)

    # Zinciri toparla: root → ... → last
    chain_results: list[AsyncResult] = []
    walker: AsyncResult | None = last
    while walker is not None:
        chain_results.append(walker)
        walker = walker.parent
    chain_results.reverse()

    # Pipeline başarısızlık: herhangi bir task FAILURE ise hata
    for r in chain_results:
        if r.state == "FAILURE":
            return UploadStatusResponse(
                task_id=task_id,
                status="FAILED",
                progress=0,
                error=str(r.result) if r.result else "Pipeline başarısız.",
            )

    # En sondaki task SUCCESS ise final
    if last.state == "SUCCESS":
        result = last.result if isinstance(last.result, dict) else {}
        if result.get("status") == "DUPLICATE":
            return UploadStatusResponse(
                task_id=task_id,
                status="DUPLICATE",
                progress=100,
                duplicate_of=result.get("duplicate_of"),
            )
        if result.get("status") == "REJECTED":
            # İçerik moderasyonu reddetti — DB'ye kaydedilmedi.
            return UploadStatusResponse(
                task_id=task_id,
                status="REJECTED",
                progress=100,
                reason_code=result.get("reason_code"),
                reason=result.get("reason"),
            )
        return UploadStatusResponse(
            task_id=task_id,
            status="COMPLETED",
            progress=100,
            place_id=result.get("place_id"),
        )

    # Aksi halde: en yüksek progress'i ve şu an çalışan custom state'i bul
    custom_states = {
        "PREPROCESSING",
        "OCR_PROCESSING",
        "MODERATING",
        "CHECKING_DUPLICATE",
        "CATEGORIZING",
    }

    current_state: str = "PENDING"
    current_progress = 0
    for r in chain_results:
        info = r.info if isinstance(r.info, dict) else {}
        if r.state in custom_states:
            current_state = r.state
            current_progress = max(
                current_progress, int(info.get("progress", 0))
            )
        elif r.state == "STARTED":
            # Custom state henüz set edilmemiş olabilir
            current_progress = max(
                current_progress, int(info.get("progress", 0))
            )
        elif r.state == "SUCCESS":
            # Tamamlanan ara task'ın return değerinde progress olabilir
            res_dict = r.result if isinstance(r.result, dict) else {}
            current_progress = max(
                current_progress, int(res_dict.get("progress", 0))
            )

    return UploadStatusResponse(
        task_id=task_id,
        status=current_state,  # type: ignore[arg-type]
        progress=current_progress,
    )
