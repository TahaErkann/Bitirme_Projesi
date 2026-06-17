"""Enrichment modeli — "Daha Fazla Bilgi" sonuçları (§ 6.4)."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class Enrichment(Base):
    """LLM tarafından üretilen detaylı bilgi metni — yer + dil bazında tek kayıt."""

    __tablename__ = "enrichments"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    place_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("places.id", ondelete="CASCADE"),
        nullable=False,
    )
    language_code: Mapped[str] = mapped_column(String(10), nullable=False)
    enriched_text: Mapped[str] = mapped_column(Text, nullable=False)
    llm_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Grounding kaynakları — her biri {"title", "url"} olan liste.
    # NULL = kaynak hiç yakalanmadı (eski satır / üretim henüz olmadı);
    # [] = grounding denendi ama kaynak bulunamadı (artık tekrar denenmez).
    # Bu ayrım enrich endpoint'inin cache hit'te kaynakları döndürmesini ve
    # eski (NULL) satırlarda bir kez yeniden üretip kaynak yakalamasını sağlar.
    sources: Mapped[list[dict[str, str]] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("place_id", "language_code", name="uq_enrichment_place_lang"),
    )
