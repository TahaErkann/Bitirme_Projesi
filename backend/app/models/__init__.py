"""SQLAlchemy ORM modelleri.

Bu paket import edildiğinde tüm modeller Base.metadata'ya bağlanır,
böylece Alembic autogenerate doğru çalışır.
"""
from app.models.audit_log import AuditLog
from app.models.enrichment import Enrichment
from app.models.ocr_result import OCRResult
from app.models.place import Place
from app.models.place_image import PlaceImage
from app.models.translation import Translation
from app.models.user import User
from app.models.user_interaction import UserInteraction

__all__ = [
    "AuditLog",
    "Enrichment",
    "OCRResult",
    "Place",
    "PlaceImage",
    "Translation",
    "User",
    "UserInteraction",
]
