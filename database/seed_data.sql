-- ==========================================================
-- TourLens — Başlangıç (seed) verileri
-- ==========================================================
-- docker-compose: bu dosya postgres servisinin /docker-entrypoint-initdb.d/
-- klasörüne mount edilir; tablolar Alembic tarafından üretilir, bu dosya
-- yalnızca eklentileri ve örnek verileri yükler.
-- ==========================================================

-- gen_random_uuid() için pgcrypto eklentisi
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- (Opsiyonel) PostGIS — coğrafi sorgular için. Image yoksa devre dışıdır.
-- CREATE EXTENSION IF NOT EXISTS postgis;
