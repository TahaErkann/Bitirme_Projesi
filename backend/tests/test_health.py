"""Sağlık kontrolü testi — minimum smoke test."""
import pytest


@pytest.mark.asyncio
async def test_healthcheck(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "service" in body
