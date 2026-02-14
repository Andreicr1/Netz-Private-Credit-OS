"""Wave AI-5 cross-container semantic linking institutional layer.

Revision ID: 0024_ai_engine_wave_ai5_cross_container_linking
Revises: 70a79686336c
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0024_ai_engine_wave_ai5_cross_container_linking"
down_revision = "70a79686336c"


def upgrade() -> None:
    op.create_table(
        "knowledge_entities",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("entity_type", sa.String(length=32), nullable=False),
        sa.Column("canonical_name", sa.String(length=300), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_knowledge_entities_fund_id", "knowledge_entities", ["fund_id"])
    op.create_index("ix_knowledge_entities_access_level", "knowledge_entities", ["access_level"])
    op.create_index("ix_knowledge_entities_entity_type", "knowledge_entities", ["entity_type"])
    op.create_index("ix_knowledge_entities_canonical_name", "knowledge_entities", ["canonical_name"])
    op.create_index(
        "ix_knowledge_entities_fund_type_name",
        "knowledge_entities",
        ["fund_id", "entity_type", "canonical_name"],
        unique=True,
    )

    op.create_table(
        "knowledge_links",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("source_document_id", sa.Uuid(), sa.ForeignKey("document_registry.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_entity_id", sa.Uuid(), sa.ForeignKey("knowledge_entities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("link_type", sa.String(length=40), nullable=False),
        sa.Column("authority_tier", sa.String(length=20), nullable=False),
        sa.Column("confidence_score", sa.Float(), nullable=False),
        sa.Column("evidence_snippet", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_knowledge_links_fund_id", "knowledge_links", ["fund_id"])
    op.create_index("ix_knowledge_links_access_level", "knowledge_links", ["access_level"])
    op.create_index("ix_knowledge_links_source_document_id", "knowledge_links", ["source_document_id"])
    op.create_index("ix_knowledge_links_target_entity_id", "knowledge_links", ["target_entity_id"])
    op.create_index("ix_knowledge_links_link_type", "knowledge_links", ["link_type"])
    op.create_index("ix_knowledge_links_authority_tier", "knowledge_links", ["authority_tier"])
    op.create_index(
        "ix_knowledge_links_fund_source_target_type",
        "knowledge_links",
        ["fund_id", "source_document_id", "target_entity_id", "link_type"],
        unique=True,
    )

    op.create_table(
        "obligation_evidence_map",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("obligation_id", sa.Uuid(), sa.ForeignKey("knowledge_entities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("evidence_document_id", sa.Uuid(), sa.ForeignKey("document_registry.id", ondelete="SET NULL"), nullable=True),
        sa.Column("satisfaction_status", sa.String(length=20), nullable=False),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_obligation_evidence_map_fund_id", "obligation_evidence_map", ["fund_id"])
    op.create_index("ix_obligation_evidence_map_access_level", "obligation_evidence_map", ["access_level"])
    op.create_index("ix_obligation_evidence_map_obligation_id", "obligation_evidence_map", ["obligation_id"])
    op.create_index("ix_obligation_evidence_map_evidence_document_id", "obligation_evidence_map", ["evidence_document_id"])
    op.create_index("ix_obligation_evidence_map_satisfaction_status", "obligation_evidence_map", ["satisfaction_status"])
    op.create_index("ix_obligation_evidence_map_last_checked_at", "obligation_evidence_map", ["last_checked_at"])
    op.create_index("ix_obligation_evidence_map_fund_obligation", "obligation_evidence_map", ["fund_id", "obligation_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_obligation_evidence_map_fund_obligation", table_name="obligation_evidence_map")
    op.drop_index("ix_obligation_evidence_map_last_checked_at", table_name="obligation_evidence_map")
    op.drop_index("ix_obligation_evidence_map_satisfaction_status", table_name="obligation_evidence_map")
    op.drop_index("ix_obligation_evidence_map_evidence_document_id", table_name="obligation_evidence_map")
    op.drop_index("ix_obligation_evidence_map_obligation_id", table_name="obligation_evidence_map")
    op.drop_index("ix_obligation_evidence_map_access_level", table_name="obligation_evidence_map")
    op.drop_index("ix_obligation_evidence_map_fund_id", table_name="obligation_evidence_map")
    op.drop_table("obligation_evidence_map")

    op.drop_index("ix_knowledge_links_fund_source_target_type", table_name="knowledge_links")
    op.drop_index("ix_knowledge_links_authority_tier", table_name="knowledge_links")
    op.drop_index("ix_knowledge_links_link_type", table_name="knowledge_links")
    op.drop_index("ix_knowledge_links_target_entity_id", table_name="knowledge_links")
    op.drop_index("ix_knowledge_links_source_document_id", table_name="knowledge_links")
    op.drop_index("ix_knowledge_links_access_level", table_name="knowledge_links")
    op.drop_index("ix_knowledge_links_fund_id", table_name="knowledge_links")
    op.drop_table("knowledge_links")

    op.drop_index("ix_knowledge_entities_fund_type_name", table_name="knowledge_entities")
    op.drop_index("ix_knowledge_entities_canonical_name", table_name="knowledge_entities")
    op.drop_index("ix_knowledge_entities_entity_type", table_name="knowledge_entities")
    op.drop_index("ix_knowledge_entities_access_level", table_name="knowledge_entities")
    op.drop_index("ix_knowledge_entities_fund_id", table_name="knowledge_entities")
    op.drop_table("knowledge_entities")
