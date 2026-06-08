# ==========================================================
# TourLens Backend — Dockerfile (FastAPI + Celery worker ortak)
# ==========================================================

FROM python:3.11-slim AS base

# Sistem bağımlılıkları (OpenCV/Pillow ve sertifikalar için)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app

WORKDIR /app

# Bağımlılıkları önce kur (Docker cache verimliliği)
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# --------------------------------------------------------------------------
# Embedding modelini image'a GÖM (build-time download)
# --------------------------------------------------------------------------
# Sebep: Aksi halde sentence-transformers modeli ilk kullanımda (Celery
# `check_duplicate` task'ı) runtime'da HuggingFace'ten indirir. Yavaş indirme
# `task_soft_time_limit` (240s) eşiğini aşınca task öldürülür ve
# `task_acks_late=True` nedeniyle SONSUZ yeniden denenir → worker kilitlenir →
# yeni yüklemeler kuyrukta bekler ve uygulamada "Görsel yükleniyor" aşamasında
# takılır (bkz. celery_app.py time-limit ayarları).
#
# Modeli build sırasında indirip katmana gömerek runtime indirmesini TAMAMEN
# ortadan kaldırıyoruz. Bu RUN, `COPY . .`'dan ÖNCE olduğu için uygulama kodu
# değişince yeniden çalışmaz (katman cache'lenir).
#
# ⚠ UYARI: Bu ARG, runtime'daki EMBEDDING_MODEL (.env) ile AYNI olmalı. Modeli
# değiştirirseniz hem .env'i hem bu ARG'ı güncelleyip image'ı yeniden build edin;
# aksi halde offline mod cache'te olmayan modeli arar ve hata verir.
ARG EMBEDDING_MODEL=all-MiniLM-L6-v2
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('${EMBEDDING_MODEL}')"

# Model artık image'da kayıtlı → runtime'da HuggingFace'e ASLA çıkma.
# (Offline env'leri indirme RUN'INDAN SONRA set ediyoruz; önce set etseydik
#  yukarıdaki build-time indirme de offline'a takılırdı.)
ENV HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1

# Uygulama kodunu kopyala
COPY . .

EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
