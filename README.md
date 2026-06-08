# TourLens

**AI Destekli Turist Bilgi & Keşif Platformu**

> Bitirme Projesi — Fırat Üniversitesi / Teknoloji Fakültesi / Yazılım Mühendisliği

TourLens, turistlerin **tarihi/turistik tabela, anıt, yapı ve şahsiyet
fotoğraflarını** yükleyerek; **OCR → akıllı kategorizasyon (LLM) → vektör
tabanlı mükerrer tespiti → 12 dilde çeviri → "Daha Fazla Bilgi"
zenginleştirmesi → keşfet feed'i** akışıyla bilgiye anlık erişim sağladığı
yapay zekâ destekli bir Android uygulamasıdır.

---

## ✨ Öne Çıkan Özellikler

- 📷 **Tek tıkla tabela tanıma** — Google Vision OCR (DOCUMENT_TEXT_DETECTION)
- 🏛️ **Akıllı kategorizasyon** — 22 kategori (Tarihi Yapı, Şahsiyet, Olay, Cami, Köprü, Türbe…) Groq LLM ile
- 🌍 **12 dilde anında çeviri** — Google Translate (tr, en, de, fr, es, ar, ru, zh, ja, ko, pt, it)
- 🔊 **Sesli okuma** — cihaz yerel TTS motoru (offline; uzun metinler otomatik parçalanıp kesintisiz okunur)
- 🤖 **"Daha Fazla Bilgi"** — Gemini ile seçili dilde 500–1000 kelimelik akıcı anlatım
- 🔁 **Mükerrer tespiti** — sentence-transformers + Milvus 2.4 (cosine, eşik 0.85)
- 🗺️ **Açık tema harita** — Google Maps SDK + özel "parşömen" stil
- ❤️ **Beğeni & katkı** — Keşfet'te beğen; Profil'de **Beğendiklerim** ve **Yüklediklerim** (katkıların)
- 🎨 **"Tarihi Doku" arayüz** — açık parşömen krem zemin, zeytin-orman yeşili + antik altın vurgu, serif başlıklar, ornamental ayraçlar, akıcı animasyonlar
- 🌐 **Canlı dil değiştirme** — uygulama arayüzü TR/EN/DE/FR/ES/AR'da tam çevrili (diğerleri EN'e fallback)

---

## 🏗️ Mimari

```
   Mobil İstemci (React Native CLI 0.76 / TypeScript)
                     │
                     ▼  HTTPS (Nginx reverse proxy)
              ┌──────────────┐
              │   FastAPI    │  ◀── JWT (HS256), Rate Limit, Pydantic v2
              └──────┬───────┘
                     │
       ┌─────────────┼──────────────┐
       ▼             ▼              ▼
   PostgreSQL     Celery (Redis)   MinIO (S3 uyumlu)
   (Meta+kullanıcı)│                (orijinal görseller)
                  ▼
            ai-module/
            (OCR / LLM / Embedding / Translation / YouTube)
                  │
                  ▼
           Milvus 2.4 (Vektör DB — mükerrer tespiti)
```

**Pipeline (Celery chain):**
`upload → preprocess_image → run_ocr → check_duplicate → categorize_with_llm → save_results`

---

## 🧰 Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Mobil | **React Native CLI 0.76.5** (Bare + New Architecture/Fabric), TypeScript, React Navigation 7, react-native-paper (MD3 Light), react-native-maps (Google Provider), react-native-image-picker, react-native-keychain, react-native-tts, react-native-config |
| API | FastAPI 0.115, Pydantic v2, SQLAlchemy 2 (async), Alembic |
| Async | Celery 5.4 + Redis 7 |
| Veri | PostgreSQL 16, Milvus 2.4 (vektör), Redis 7 (cache) |
| Depo | MinIO (S3 uyumlu) |
| AI / ML | Google Cloud Vision (REST + API key, OCR), Groq `openai/gpt-oss-120b` (kategorizasyon, JSON-mode), Gemini `gemini-2.5-flash` (zenginleştirme), Google Translate v2 (12 dil), `all-MiniLM-L6-v2` (embedding, 384-dim) |
| DevOps | Docker, Docker Compose, Nginx, GitHub Actions |

> **Sürüm kilitleri (RN 0.76 uyumu için):** `react-native-maps@1.20.1`,
> `react-native-gesture-handler@2.21.2`, `react-native-screens@4.4.0`.
> **Reanimated kullanılmaz** — animasyonlar RN `Animated` API ile yapılır.

---

## 🚀 Sıfırdan Kurulum

### 0) Ön Gereksinimler
- **Docker Desktop** 24+
- **Node.js** 20+
- **JDK 17**
- **Android Studio** (emülatör — Google Play içeren image) veya USB hata ayıklamalı fiziksel Android telefon
- Aşağıdaki harici servislerden alınacak **API anahtarları** (ücretsiz katmanlar yeterli)

### 1) Repoyu klonla
```bash
git clone https://github.com/TahaErkann/Bitirme_Projesi.git
cd Bitirme_Projesi
```

### 2) Ortam değişkenlerini hazırla
Bu repoda **gerçek `.env` dosyaları yoktur** (sırlar commit edilmez). Şablonları
kopyalayıp kendi değerlerinle doldur:

```bash
# Kök (backend + altyapı için ana .env)
cp .env.example .env

# Frontend
cp frontend/.env.example frontend/.env
```

Ardından **`.env`** içindeki şu değerleri doldur:

| Değişken | Nereden alınır |
|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Sen belirle (örn. `tourlens_user` / güçlü bir şifre / `tourlens`) |
| `DATABASE_URL` | Yukarıdaki kullanıcı/şifre/db ile aynı olmalı: `postgresql+asyncpg://<user>:<pass>@postgres:5432/<db>` |
| `JWT_SECRET_KEY` | `openssl rand -hex 64` |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | Sen belirle |
| `GOOGLE_VISION_API_KEY` | Google Cloud → **Cloud Vision API** |
| `GOOGLE_TRANSLATE_API_KEY` | Google Cloud → **Cloud Translation API** |
| `GOOGLE_MAPS_API_KEY` | Google Cloud → **Maps SDK for Android** (backend tarafı) |
| `GEMINI_API_KEY` | **Google AI Studio** (aistudio.google.com) |
| `GROQ_API_KEY` | **Groq Console** (console.groq.com) |
| `YOUTUBE_API_KEY` | Google Cloud → **YouTube Data API v3** |
| `GOOGLE_OAUTH_CLIENT_ID` / `SECRET` | (Opsiyonel) Google Sign-In için OAuth istemcisi |

Ve **`frontend/.env`** içinde:

| Değişken | Açıklama |
|---|---|
| `API_BASE_URL` | Emülatör: `http://10.0.2.2:8000/api/v1` · Fiziksel telefon (adb reverse): `http://localhost:8000/api/v1` · LAN: `http://<PC-IP>:8000/api/v1` |
| `GOOGLE_MAPS_API_KEY_ANDROID` | Maps SDK for Android anahtarı (manifest'e build sırasında gömülür) |
| `GOOGLE_OAUTH_WEB_CLIENT_ID` | (Opsiyonel) Google Sign-In |

> ⚠️ `docker-compose.yml` tüm gizli değerleri `${...}` ile **`.env`'den okur**;
> içinde hardcoded sır yoktur. `.env`'i doldurman doğrudan çalışır hale getirir.
> `.env` değişince container'ları **`docker compose up -d`** ile yeniden oluştur
> (`restart` env'i yeniden okumaz).

### 3) Backend + altyapıyı başlat
```bash
make up        # docker compose up -d (api, celery, postgres, redis, milvus, minio, nginx)
make migrate   # alembic upgrade head
```
- API → http://localhost:8000 · Swagger → http://localhost:8000/docs
- MinIO Console → http://localhost:9001

### 4) Frontend'i çalıştır
```bash
cd frontend
npm install

# Fiziksel telefon (USB hata ayıklama açık):
adb devices
adb reverse tcp:8081 tcp:8081   # Metro
adb reverse tcp:8000 tcp:8000   # Backend

npx react-native start          # terminal 1 (Metro)
npx react-native run-android    # terminal 2 (build + install)
```

### 5) Google Maps'i çalışır hale getir (önemli)
Harita gri kalıp sadece "Google" logosu görünüyorsa sorun **her zaman Google
Cloud Console** tarafındadır. Şunları yap:
1. **Maps SDK for Android** API'sini etkinleştir.
2. Projeye **Billing (faturalandırma)** bağla — Maps ücretsiz kotada bile zorunlu kılar.
3. API anahtarını **Android apps** kısıtlamasına al: paket adı `com.tourlens`
   + uygulamanın imza **SHA-1** parmak izi.

> 🔑 **SHA-1 tuzağı:** Bu proje, debug imzası için **kendi** keystore'unu
> (`frontend/android/app/debug.keystore`, repoda dahil) kullanır — sistemdeki
> varsayılan `~/.android/debug.keystore`'u DEĞİL. Doğru SHA-1'i şu komutla al:
> ```bash
> cd frontend/android && ./gradlew signingReport
> ```
> ve **`:app` modülünün `Store: .../app/debug.keystore`** satırındaki SHA-1'i
> Console'a ekle. (Bu repodaki keystore için SHA-1:
> `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`.)
> Ayarın yayılması ~5 dk sürebilir. Emülatörde test ediyorsan image **Google
> Play Services** içermelidir (`PROVIDER_GOOGLE` bunu gerektirir).

### Komut özeti
```bash
make help      # tüm komutlar
make up        # servisleri başlat
make down      # servisleri durdur
make logs      # api + celery logları
make migrate   # DB migration uygula
make test      # backend testleri
make lint      # ruff lint
```

---

## 📁 Dizin Yapısı

```
.
├─ ai-module/              # OCR / LLM / Embedding / Translation / YouTube (Strategy Pattern)
├─ backend/                # FastAPI uygulaması
│  ├─ app/
│  │  ├─ api/v1/           # auth, users, places, discover, upload
│  │  ├─ core/             # config, security, exceptions, dependencies
│  │  ├─ models/           # SQLAlchemy ORM
│  │  ├─ repositories/     # Veri erişim katmanı
│  │  ├─ schemas/          # Pydantic DTO'lar
│  │  ├─ services/         # İş mantığı
│  │  └─ tasks/            # Celery (chain pipeline)
│  ├─ alembic/             # Versiyonlu migration'lar
│  └─ Dockerfile           # Embedding modeli image'a gömülü (offline)
├─ frontend/               # React Native CLI uygulaması
│  ├─ android/             # Native Android (debug.keystore dahil)
│  ├─ src/
│  │  ├─ components/       # ScreenHeader, SectionTitle, OrnamentalDivider, AppButton/Card/Input, PlaceCard, TTSButton, …
│  │  ├─ context/          # AuthContext, LanguageContext
│  │  ├─ hooks/            # useAuth, useTTS, useUploadStatus
│  │  ├─ navigation/       # AppNavigator (özel tab bar)
│  │  ├─ screens/          # auth, home, discover, upload, profile
│  │  ├─ services/         # axios + endpoint istemcileri
│  │  ├─ types/            # Backend DTO TS karşılıkları
│  │  └─ utils/            # theme (Tarihi Doku paleti), i18n (6 dil), constants, helpers
│  ├─ App.tsx
│  └─ react-native.config.js
├─ database/seed_data.sql  # pgcrypto eklentisi
├─ nginx/nginx.conf
├─ docs/
├─ docker-compose.yml + override
├─ Makefile
├─ .env.example            # ana ortam şablonu (sırsız)
└─ README.md
```

---

## 🔌 API Sözleşmesi (özet)

Tam doküman: Swagger UI (`/docs`) veya `docs/api_documentation.md`.

| Modül | Örnek endpoint |
|---|---|
| Auth | `POST /api/v1/auth/register · /login · /refresh · /google · /logout` |
| Users | `GET/PUT /api/v1/users/me · POST /users/me/change-password · GET /users/me/uploads · /me/liked · /me/saved · DELETE /users/me` |
| Upload | `POST /api/v1/upload/image (multipart + opsiyonel crop_x/y/w/h) · GET /upload/status/{task_id}` |
| Places | `GET /places · /places/{id} · /places/{id}/translate/{lang} · POST /places/{id}/enrich · GET /places/{id}/videos · POST /places/{id}/like · /save` |
| Discover | `GET /discover (cursor feed) · /categories · /nearby` |

---

## 🎨 Tasarım Sistemi — "Tarihi Doku"

Tarihi yer ve şahsiyetleri tanıtan bir uygulamaya yakışan **müze/arşiv hissi**
veren açık tema. Tasarım token'ları [`frontend/src/utils/theme.ts`](frontend/src/utils/theme.ts):

- **Renk:** parşömen krem zemin (`#F3EDDD`), sıcak beyaz yüzey, **zeytin-orman
  yeşili** ana vurgu (`#3F6B4F`), **antik altın/bronz** ikincil vurgu (`#B0833A`),
  sepya metin.
- **Tipografi:** serif başlıklar (kitabe estetiği) + sans-serif gövde.
- **Bileşenler:** `ScreenHeader` (altın overline + serif başlık), `SectionTitle`,
  `OrnamentalDivider` (altın hat + elmas motifi), altın "kitabe kenarlı"
  (`accentEdge`) kartlar, 5 varyantlı `AppButton`.
- **Animasyon:** RN `Animated` ile giriş (fade+lift), press scale, shimmer, nabız.

---

## 🔐 Güvenlik

- Tüm API anahtarları **`.env`** üzerinden okunur, **asla kaynağa gömülmez**;
  gerçek `.env` dosyaları repoya dahil DEĞİLDİR (yalnızca `*.env.example` şablonları).
- JWT HS256 (15 dk access + 7 gün refresh) + bcrypt (rounds=12).
- Rate limit: genel 100/dk, auth 5/dk, upload 10/dk, enrich 5/dk.
- Upload: `image/jpeg|png|webp` + Pillow magic-byte kontrolü + 10 MB limit.
- Frontend token'ları **react-native-keychain** ile şifrelenmiş Keystore'da.
- Hesap silme: yer kayıtları `created_by = NULL` ile anonimleştirilir.

---

## 🛠️ Sık Karşılaşılan Sorunlar

| Belirti | Çözüm |
|---|---|
| Harita gri / sadece "Google" logosu | Maps SDK + Billing etkin mi? API key kısıtlamasına `com.tourlens` + **proje** keystore SHA-1 eklendi mi? (Kurulum §5) |
| "Daha Fazla Bilgi" 502 | Gemini kotası bitmiş olabilir; provider Groq'a düşer. `.env` değişikliğinden sonra `docker compose up -d` (recreate) gerekir. |
| Tab/ikon yerine garip karakter | `react-native-vector-icons` fontları için temiz build: `cd frontend/android && ./gradlew clean` |
| Pipeline "Görsel yükleniyor"da takılı | `docker logs tourlens_celery_worker` — embedding modeli image'a gömülüdür; sorun sürerse worker'ı yeniden başlat. |
| `.env` değişikliği yansımıyor | `docker compose up -d` (gerekirse `--force-recreate`). `restart` env'i yeniden okumaz. |

---

## 📄 Lisans / Kullanım

Bu proje akademik bir bitirme çalışması olarak hazırlanmıştır.
