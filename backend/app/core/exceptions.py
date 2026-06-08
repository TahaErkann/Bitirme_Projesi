"""Domain seviyesi özel hatalar.

Tüm servis katmanı bu sınıfları fırlatır; main.py'deki global handler
bunları standart JSON cevabına çevirir.
"""
from __future__ import annotations

from typing import Any


class TourLensException(Exception):
    """TourLens domain hatalarının üst sınıfı."""

    code: str = "tourlens_error"
    status_code: int = 500
    message: str = "Beklenmeyen bir hata oluştu."

    def __init__(
        self,
        message: str | None = None,
        *,
        details: dict[str, Any] | None = None,
        status_code: int | None = None,
    ) -> None:
        super().__init__(message or self.message)
        self.message = message or self.message
        self.details = details or {}
        if status_code is not None:
            self.status_code = status_code


# ------------------- Auth -------------------
class AuthenticationException(TourLensException):
    code = "authentication_failed"
    status_code = 401
    message = "Kimlik doğrulama başarısız."


class AuthorizationException(TourLensException):
    code = "authorization_failed"
    status_code = 403
    message = "Bu işlem için yetkiniz yok."


class UserAlreadyExistsException(TourLensException):
    code = "user_already_exists"
    status_code = 409
    message = "Bu e-posta ile zaten bir kullanıcı kayıtlı."


class InvalidCredentialsException(TourLensException):
    code = "invalid_credentials"
    status_code = 401
    message = "E-posta veya şifre hatalı."


# ------------------- Upload / Görsel -------------------
class InvalidImageException(TourLensException):
    code = "invalid_image"
    status_code = 400
    message = "Geçersiz veya desteklenmeyen görsel."


class FileTooLargeException(TourLensException):
    code = "file_too_large"
    status_code = 413
    message = "Yüklenen dosya boyut sınırını aştı."


# ------------------- OCR / AI Pipeline -------------------
class OCRException(TourLensException):
    code = "ocr_failed"
    status_code = 502
    message = "OCR işlemi başarısız oldu."


class LLMException(TourLensException):
    code = "llm_failed"
    status_code = 502
    message = "LLM çağrısı başarısız oldu."


class TranslationException(TourLensException):
    code = "translation_failed"
    status_code = 502
    message = "Çeviri başarısız oldu."


class EmbeddingException(TourLensException):
    code = "embedding_failed"
    status_code = 502
    message = "Embedding üretilemedi."


class DuplicateDetectedException(TourLensException):
    """Mükerrer kayıt tespit edildiğinde fırlatılır.

    Bu bir hata DEĞİL, kontrollü bir akış işaretidir; ama HTTP 409 ile
    uyumlu davranır.
    """

    code = "duplicate_detected"
    status_code = 409
    message = "Bu yer zaten sistemde kayıtlı."


# ------------------- Kaynak -------------------
class ResourceNotFoundException(TourLensException):
    code = "resource_not_found"
    status_code = 404
    message = "İstenen kaynak bulunamadı."
