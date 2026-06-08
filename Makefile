# ==========================================================
# TourLens — Makefile (kısayol komutları)
# ==========================================================

.PHONY: help up down build logs restart ps \
        migrate makemigration shell-api shell-db \
        test lint format \
        frontend-install frontend-android \
        clean

help: ## Bu yardımı göster
	@echo "TourLens — Kullanılabilir komutlar:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

# --------------------- Docker Compose ---------------------
up: ## Tüm servisleri arka planda başlat
	docker compose up -d

down: ## Tüm servisleri durdur
	docker compose down

build: ## Image'ları yeniden build et
	docker compose build --no-cache

logs: ## Logları takip et (api + celery)
	docker compose logs -f api celery-worker

restart: ## Servisleri yeniden başlat
	docker compose restart

ps: ## Çalışan servisleri listele
	docker compose ps

# --------------------- Database ---------------------------
migrate: ## Alembic migration'larını uygula
	docker compose exec api alembic upgrade head

makemigration: ## Yeni migration oluştur (m="mesaj")
	docker compose exec api alembic revision --autogenerate -m "$(m)"

shell-api: ## API container'ında bash aç
	docker compose exec api bash

shell-db: ## PostgreSQL psql shell
	docker compose exec postgres psql -U $${POSTGRES_USER:-tourlens_user} -d $${POSTGRES_DB:-tourlens}

# --------------------- Test & Kalite ----------------------
test: ## Backend testlerini çalıştır
	docker compose exec api pytest -v

lint: ## Ruff ile lint kontrolü
	docker compose exec api ruff check app

format: ## Ruff ile kod formatla
	docker compose exec api ruff format app

# --------------------- Frontend ---------------------------
frontend-install: ## Frontend bağımlılıklarını yükle
	cd frontend && npm install

frontend-android: ## Android emülatöre uygulamayı yükle
	cd frontend && npx react-native run-android

frontend-start: ## Metro bundler başlat
	cd frontend && npx react-native start

# --------------------- Temizlik ---------------------------
clean: ## Cache, log ve __pycache__ temizliği
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null || true
