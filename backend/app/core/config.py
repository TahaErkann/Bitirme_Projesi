"""Uygulama konfigürasyonu — Pydantic Settings.

Tüm environment variable'lar burada tek tip olarak okunur.
.env dosyasından otomatik yüklenir.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """TourLens uygulama ayarları.

    Tüm değerler .env veya OS environment'tan okunur.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ---------------- Genel ----------------
    app_name: str = Field(default="TourLens")
    app_env: str = Field(default="development")
    app_debug: bool = Field(default=True)
    api_v1_prefix: str = Field(default="/api/v1")
    cors_origins: str = Field(default="*")

    # ---------------- PostgreSQL ----------------
    database_url: str = Field(
        default="postgresql+asyncpg://tourlens_user:tourlens_pass@localhost:5432/tourlens"
    )

    # ---------------- Redis / Celery ----------------
    redis_url: str = Field(default="redis://localhost:6379/0")
    redis_cache_db: int = 1
    redis_rate_limit_db: int = 2
    celery_broker_url: str = Field(default="redis://localhost:6379/0")
    celery_result_backend: str = Field(default="redis://localhost:6379/0")
    celery_worker_concurrency: int = 4

    # ---------------- Milvus ----------------
    milvus_host: str = "localhost"
    milvus_port: int = 19530
    milvus_collection_name: str = "place_embeddings"
    embedding_dim: int = 384

    # ---------------- MinIO ----------------
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "tourlens-images"
    minio_use_ssl: bool = False
    minio_public_url: str = "http://localhost:9000"

    # ---------------- JWT ----------------
    jwt_secret_key: str = Field(default="change_me_min_64_chars" + "x" * 50)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # ---------------- OAuth (Google) ----------------
    google_oauth_client_id: str = ""
    google_oauth_client_secret: str = ""

    # ---------------- Harici API'ler ----------------
    google_vision_api_key: str = ""
    google_translate_api_key: str = ""
    google_maps_api_key: str = ""
    google_geocoding_api_key: str = ""
    gemini_api_key: str = ""
    groq_api_key: str = ""
    youtube_api_key: str = ""

    # ---------------- AI Provider seçimi (Strategy) ----------------
    ocr_provider: str = "google_vision"
    llm_categorization_provider: str = "groq"
    llm_enrichment_provider: str = "gemini"
    llm_moderation_provider: str = "groq"
    translation_provider: str = "google_translate"

    embedding_model: str = "all-MiniLM-L6-v2"
    # Mükerrer tespiti — hibrit (OCR metni embedding'i tek başına kırılgan: aynı
    # tabela farklı kırpılınca/ışıkta metin değişir, cosine eşiğin altına düşer).
    #   score >= similarity_threshold                 → güçlü sinyal, tek başına mükerrer.
    #   score >= duplicate_relaxed_threshold  VE
    #     place_name bulanık eşleşiyor VE şehir uyumlu → mükerrer.
    # Böylece "Gebze Belediyesi" kırpma farkı gibi metin oynamaları yakalanır,
    # ama farklı yerler (düşük isim benzerliği) yanlışlıkla birleştirilmez.
    similarity_threshold: float = 0.85
    duplicate_relaxed_threshold: float = 0.62
    duplicate_name_ratio: float = 0.80

    # ---------------- İçerik moderasyonu (yükleme kontrolü) ----------------
    # Yüklenen görselin uygulamanın amacıyla (tarihi/turistik tabela) bağdaşıp
    # bağdaşmadığını OCR sonrası iki sinyalle denetler:
    #   1) LLM metin sınıflandırması (alaka + güvenlik)  → reklam/küfür/e-posta/alakasız
    #   2) Google Vision SafeSearch + Label (aynı OCR çağrısı) → uygunsuz görsel + metinsiz doğa/hayvan
    # Reddedilen görsel DB'ye/Keşfet'e KAYDEDİLMEZ (REJECTED durumu).
    moderation_enabled: bool = True
    # OCR metni bu eşikten kısaysa "okunabilir tabela metni yok" sayılır
    # (doğa/hayvan fotoğrafları gibi metinsiz görseller burada elenir).
    moderation_min_text_chars: int = 6
    # Vision SafeSearch bu seviye ve üstündeyse uygunsuz kabul edilir.
    # Geçerli sıralama: VERY_UNLIKELY < UNLIKELY < POSSIBLE < LIKELY < VERY_LIKELY
    moderation_safe_search_block: str = "LIKELY"
    # LLM moderasyon çağrısı başarısızsa (kota/ağ): True → metin VARSA kabul et
    # (yumuşak iniş; metinsiz/uygunsuz kontrolleri yine de çalışır), False → reddet.
    moderation_fail_open: bool = True

    groq_model: str = "openai/gpt-oss-120b"
    gemini_categorization_model: str = "gemini-2.5-flash"
    gemini_enrichment_model: str = "gemini-2.5-pro"

    # ---------------- Rate limit ----------------
    rate_limit_general: int = 100
    rate_limit_auth: int = 5
    rate_limit_upload: int = 10
    rate_limit_enrich: int = 5

    # ---------------- Upload ----------------
    max_upload_size_mb: int = 10
    allowed_image_mime: str = "image/jpeg,image/png,image/webp"

    # ---------------- Cache TTL ----------------
    translation_cache_ttl: int = 86_400
    youtube_cache_ttl: int = 3_600
    enrichment_cache_ttl: int = 604_800

    # ---------------- Türetilmiş özellikler ----------------
    @property
    def cors_origins_list(self) -> list[str]:
        """`*` özel durumunu, virgülle ayrılmış listeyi destekler."""
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def allowed_mime_set(self) -> set[str]:
        return {m.strip() for m in self.allowed_image_mime.split(",") if m.strip()}

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    """Tek-instance Settings — uygulama yaşam döngüsü boyunca cache'lenir."""
    return Settings()


# Modül seviyesinde kolay erişim
settings = get_settings()
