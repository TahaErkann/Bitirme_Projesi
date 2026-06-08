"""Keşfet (Discover) şemaları — feed, kategori, yakındakiler."""
from __future__ import annotations

from pydantic import BaseModel

from app.schemas.place import PlaceListItem


class DiscoverFeedResponse(BaseModel):
    """Cursor tabanlı keşfet feed'i."""

    places: list[PlaceListItem]
    next_cursor: str | None = None


class CategoriesResponse(BaseModel):
    categories: list[str]


class NearbyResponse(BaseModel):
    places: list[PlaceListItem]
