"""Google Geocoding yardımcısı — il/ilçe/ülke metnini koordinata çevirir.

Kullanım: PlaceService.get_detail bir yeri açarken latitude/longitude NULL ise
(LLM kategorizasyonu koordinat döndürmez) buradan il/ilçe merkezini çözer ve
Place'e yazar. Böylece "Haritada Gör" o noktayı kırmızı işaretle gösterebilir.

Not: Birebir konum şart değil; en spesifik adresten (ilçe, il, ülke) başlanır,
sonuç çıkmazsa kademeli olarak daha genel sorguya (il+ülke → ülke) düşülür.
Geocoding API + billing kapalıysa veya hata olursa None döner; çağıran taraf
sessizce koordinatsız devam eder.
"""
from __future__ import annotations

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger("jourex.geocoding")

_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"


def _candidate_queries(
    district: str | None, city: str | None, country: str | None
) -> list[str]:
    """En spesifikten en genele doğru aday adresler (boşlar atlanır, tekilleştirilir)."""
    parts = [p.strip() for p in (district, city, country) if p and p.strip()]
    candidates: list[str] = []
    # ilçe, il, ülke → il, ülke → ülke
    for start in range(len(parts)):
        q = ", ".join(parts[start:])
        if q and q not in candidates:
            candidates.append(q)
    return candidates


async def geocode_place(
    *,
    district: str | None,
    city: str | None,
    country: str | None,
) -> tuple[float, float] | None:
    """İl/ilçe/ülke metnini (lat, lng) ikilisine çevirir; bulunamazsa None."""
    api_key = settings.google_geocoding_api_key or settings.google_maps_api_key
    if not api_key:
        logger.warning("Geocoding atlandı: GOOGLE_GEOCODING_API_KEY tanımlı değil.")
        return None

    queries = _candidate_queries(district, city, country)
    if not queries:
        return None

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            for query in queries:
                resp = await client.get(
                    _GEOCODE_URL,
                    params={"address": query, "key": api_key, "language": "tr"},
                )
                data = resp.json()
                status = data.get("status")
                if status == "OK" and data.get("results"):
                    loc = data["results"][0]["geometry"]["location"]
                    lat, lng = float(loc["lat"]), float(loc["lng"])
                    logger.info("Geocode başarılı: %r → (%.5f, %.5f)", query, lat, lng)
                    return lat, lng
                if status not in ("OK", "ZERO_RESULTS"):
                    # REQUEST_DENIED / OVER_QUERY_LIMIT vb. → daha genel sorgu da
                    # büyük ihtimalle aynı hatayı verir, döngüden çık.
                    logger.warning(
                        "Geocoding API durumu %s (%r): %s",
                        status, query, data.get("error_message", ""),
                    )
                    break
    except Exception as exc:  # pragma: no cover
        logger.warning("Geocoding isteği başarısız: %s", exc)

    return None
