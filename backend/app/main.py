"""JourEx FastAPI uygulamasının giriş noktası.

Bu dosya:
- FastAPI app instance'ını oluşturur
- Middleware'leri yapılandırır (CORS, rate limit, request id, hata yakalama)
- API v1 router'ını bağlar
- Startup/shutdown event'leri ile dış kaynak bağlantılarını başlatır/sonlandırır
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import JourExException

logger = logging.getLogger("jourex")
logging.basicConfig(level=logging.DEBUG if settings.app_debug else logging.INFO)


# ----------------------------------------------------------
# Lifespan: startup / shutdown
# ----------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Servis başlatma ve kapatma.

    Burada DB engine kontrolü, Milvus bağlantısı, MinIO bucket
    hazırlama gibi tek seferlik kurulumlar yapılır.
    """
    logger.info("JourEx API başlıyor — env=%s", settings.app_env)
    # Burada uygulamaya özel ısıtma adımları çağrılabilir.
    # Örn: await ensure_minio_bucket(), milvus.ensure_collection()
    yield
    logger.info("JourEx API kapanıyor.")


# ----------------------------------------------------------
# FastAPI uygulama instance'ı
# ----------------------------------------------------------
limiter = Limiter(key_func=get_remote_address, default_limits=[f"{settings.rate_limit_general}/minute"])

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="JourEx — AI destekli turist bilgi platformu (Bitirme Projesi)",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.api_v1_prefix}/openapi.json",
    lifespan=lifespan,
)

# Rate limit
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------------------------------------------------
# Hata yakalama
# ----------------------------------------------------------
@app.exception_handler(JourExException)
async def jourex_exception_handler(request: Request, exc: JourExException):
    """Tüm domain hatalarını standart formatta JSON'a çevirir."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.code,
            "message": exc.message,
            "details": exc.details,
        },
    )


# ----------------------------------------------------------
# Sağlık kontrolü
# ----------------------------------------------------------
@app.get("/health", tags=["health"])
async def health_check() -> dict:
    """Container orchestration için sağlık kontrolü."""
    return {"status": "ok", "service": settings.app_name, "env": settings.app_env}


# ----------------------------------------------------------
# Router'ları bağla
# ----------------------------------------------------------
app.include_router(api_router, prefix=settings.api_v1_prefix)
