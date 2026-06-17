# JourEx API — Geliştirici Notları

Tam OpenAPI dokümanı: `http://localhost:8000/docs` (Swagger UI) / `http://localhost:8000/redoc`.

## Genel

- Base URL (dev): `http://localhost:8000/api/v1`
- Auth: `Authorization: Bearer <access_token>`
- Hata formatı:
  ```json
  { "error": "<code>", "message": "<TR mesaj>", "details": { ... } }
  ```

## Akış: Görsel Yükleme

1. `POST /upload/image` (multipart, alan adı `image`) → `{ task_id, status: "PENDING" }`
2. İstemci `GET /upload/status/{task_id}` ile saniyede bir poll eder.
3. Status `COMPLETED` ise `place_id` döner; `DUPLICATE` ise `duplicate_of` döner.

Pipeline durumları (master prompt § 11):
`PENDING → PREPROCESSING → OCR_PROCESSING → CHECKING_DUPLICATE → CATEGORIZING → COMPLETED|DUPLICATE|FAILED`

## Akış: Çeviri (Lazy)

`GET /places/{id}/translate/{lang}` — desteklenen 12 dil:
`tr, en, de, fr, es, ar, ru, zh, ja, ko, pt, it`

Sıra: Redis cache → PostgreSQL `translations` → Google Translate.

## Akış: Daha Fazla Bilgi

`POST /places/{id}/enrich` — body: `{ "language_code": "en" }`.

> Bu **chat değildir**. Tek istek → tek cevap (300–500 kelime). Cevap `enrichments` tablosunda place + dil bazında cache'lenir.

## Akış: YouTube

`GET /places/{id}/videos` → 5 video (1 saat Redis cache).
İstemci `deeplink` (`vnd.youtube://...`) varsa onu, yoksa `web_url`'i açar.

## Rate Limit

- Genel: 100 / dk
- Auth: 5 / dk
- Upload: 10 / dk
- Enrich: 5 / dk
Aşıldığında HTTP `429 Too Many Requests`.

## Güvenlik

- `password` ≥ 8 karakter; bcrypt rounds=12.
- JWT: `access_token` 15 dk, `refresh_token` 7 gün. HS256.
- Upload: `image/jpeg`, `image/png`, `image/webp` + 10 MB.
