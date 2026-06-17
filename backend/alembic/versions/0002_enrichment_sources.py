"""enrichment.sources — grounding kaynaklarını kalıcılaştır

Sorun 1 (Daha Fazla Bilgi kaynak tutarsızlığı): kaynaklar yalnızca yanıt
nesnesinde dönüyor, DB'de saklanmıyordu. Cache hit'te bu yüzden kaynaklar
kayboluyordu. Bu migration `enrichments` tablosuna nullable JSONB `sources`
kolonu ekler.

Anlam:
  - NULL  → kaynak hiç yakalanmadı (eski satır)  → enrich endpoint bir kez
            yeniden üretip kaynak yakalar.
  - []    → grounding denendi, kaynak bulunamadı → tekrar denenmez.
  - [...] → {"title","url"} kaynaklar → cache hit'te aynen döndürülür.

Revision ID: 0002_enrichment_sources
Revises: 0001_initial_schema
Create Date: 2026-06-15
"""
from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_enrichment_sources"
down_revision: str | None = "0001_initial_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "enrichments",
        sa.Column("sources", postgresql.JSONB(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("enrichments", "sources")
