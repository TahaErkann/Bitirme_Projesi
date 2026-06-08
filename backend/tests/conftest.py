"""Pytest fixtures.

Şimdilik temel app fixture'ı ve TestClient sağlar.
DB testleri için ayrı bir test database hazırlamak gerekir; CI'da
docker-compose'un postgres servisi kullanılır.
"""
from __future__ import annotations

import asyncio

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def client():
    """ASGI üzerinden async HTTP client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c
