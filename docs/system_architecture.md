# TourLens — Sistem Mimarisi

> `system_architecture.png` ileride üretilecektir; bu dosya geçici metinsel diyagramdır.

```
┌──────────────────────────────────────────────────────────┐
│              React Native CLI (TypeScript)                │
│  Camera, Vision-Camera, Maps, TTS, Paper, Navigation 7    │
└──────────────────────────┬───────────────────────────────┘
                           │ HTTPS
                           ▼
                   ┌──────────────┐
                   │   Nginx      │  rate limit, ssl
                   └──────┬───────┘
                          │
                   ┌──────▼───────┐
                   │   FastAPI    │  JWT, Pydantic, SOLID
                   └──┬────┬──────┘
                      │    │
            ┌─────────┘    └─────────┐
            ▼                        ▼
       PostgreSQL                  Celery (Redis)
       Meta + auth                 OCR/LLM/Embedding pipeline
                                     │
                  ┌──────────────────┼──────────────────┐
                  ▼                  ▼                  ▼
         Google Vision           Sentence-Trans.     Groq / Gemini
         (OCR API)               (Embedding 384)     (LLM)
                  │                  │
                  ▼                  ▼
                MinIO              Milvus
                Görseller          Vektör DB (cosine)
```

Detaylar için master prompt § 1.4 ve § 11'e bakın.
