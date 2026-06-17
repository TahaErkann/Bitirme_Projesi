"""YouTube Data API v3 — yer hakkında video önerisi (§ 6.6)."""
from __future__ import annotations

import json
import logging

import httpx
import redis.asyncio as redis

from app.core.config import settings  # type: ignore

logger = logging.getLogger("jourex.youtube")

SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"


class YouTubeService:
    def __init__(self) -> None:
        self.api_key = settings.youtube_api_key
        self._redis: redis.Redis | None = None

    async def _get_redis(self) -> redis.Redis:
        if self._redis is None:
            self._redis = redis.from_url(settings.redis_url, decode_responses=True)
        return self._redis

    async def search(self, query: str, *, max_results: int = 5) -> list[dict]:
        if not query.strip() or not self.api_key:
            return []

        cache_key = f"yt:{query.lower()}:{max_results}"
        try:
            r = await self._get_redis()
            cached = await r.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:  # pragma: no cover
            pass

        params = {
            "part": "snippet",
            "type": "video",
            "q": query,
            "maxResults": max_results,
            "safeSearch": "moderate",
            "key": self.api_key,
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(SEARCH_URL, params=params)
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPError as exc:
            logger.warning("YouTube API hatası: %s", exc)
            return []

        out: list[dict] = []
        for item in data.get("items", []):
            vid = item.get("id", {}).get("videoId")
            sn = item.get("snippet", {})
            if not vid:
                continue
            thumbs = sn.get("thumbnails", {})
            thumb = (
                thumbs.get("high") or thumbs.get("medium") or thumbs.get("default") or {}
            ).get("url", "")
            out.append(
                {
                    "video_id": vid,
                    "title": sn.get("title", ""),
                    "thumbnail_url": thumb,
                    "channel_title": sn.get("channelTitle", ""),
                    "deeplink": f"vnd.youtube://{vid}",
                    "web_url": f"https://www.youtube.com/watch?v={vid}",
                }
            )

        try:
            r = await self._get_redis()
            await r.setex(cache_key, settings.youtube_cache_ttl, json.dumps(out))
        except Exception:  # pragma: no cover
            pass
        return out
