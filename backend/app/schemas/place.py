"""Place şemaları — listeleme, detay, like, save, enrich, video."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class PlaceImagePublic(BaseModel):
    id: UUID
    image_url: str
    thumbnail_url: str | None = None
    is_primary: bool

    model_config = {"from_attributes": True}


class OCRResultPublic(BaseModel):
    raw_text: str
    cleaned_text: str
    detected_language: str | None = None
    confidence: Decimal | None = None

    model_config = {"from_attributes": True}


class PlaceListItem(BaseModel):
    """Keşfet feed'i ve listeleme için hafif kart modeli."""

    id: UUID
    place_name: str
    country: str | None = None
    city: str | None = None
    category: str | None = None
    primary_image_url: str | None = None
    like_count: int
    view_count: int
    liked: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class PlaceDetail(BaseModel):
    """Tek bir yer için tam detay (ResultScreen ve PlaceDetailScreen)."""

    id: UUID
    place_name: str
    country: str | None
    city: str | None
    district: str | None
    category: str | None
    original_text: str
    summary: str | None
    tags: list[str] | None
    latitude: Decimal | None
    longitude: Decimal | None
    confidence_score: Decimal | None
    view_count: int
    like_count: int
    is_verified: bool
    images: list[PlaceImagePublic] = Field(default_factory=list)
    ocr_results: list[OCRResultPublic] = Field(default_factory=list)
    created_at: datetime

    model_config = {"from_attributes": True}


class PlaceListResponse(BaseModel):
    places: list[PlaceListItem]
    total: int
    page: int = 1
    page_size: int = 20


class TranslationResponse(BaseModel):
    place_id: UUID
    language_code: str
    translated_text: str
    translated_summary: str | None = None
    cached: bool = False


class EnrichRequest(BaseModel):
    language_code: str = Field(default="en", min_length=2, max_length=10)


class EnrichResponse(BaseModel):
    place_id: UUID
    language_code: str
    enriched_text: str
    llm_provider: str
    cached: bool = False


class YouTubeVideo(BaseModel):
    video_id: str
    title: str
    thumbnail_url: str
    channel_title: str
    deeplink: str       # vnd.youtube://...
    web_url: str        # https://youtube.com/watch?v=...


class VideosResponse(BaseModel):
    place_id: UUID
    videos: list[YouTubeVideo]


class LikeResponse(BaseModel):
    liked: bool
    like_count: int


class SaveResponse(BaseModel):
    saved: bool
