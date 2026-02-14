"""Wave AI-2 document intelligence governance layer.

Revision ID: 0021_ai_engine_wave_ai2
Revises: 0020_ai_engine_wave_ai1
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0021_ai_engine_wave_ai2"
down_revision = "0020_ai_engine_wave_ai1"


def upgrade() -> None:
    op.alter_column("document_registry", "document_id", existing_type=sa.Uuid(), nullable=True)
    op.alter_column("document_registry", "version_id", existing_type=sa.Uuid(), nullable=True)

    op.add_column("document_registry", sa.Column("container_name", sa.String(length=120), nullable=True))
    op.add_column("document_registry", sa.Column("domain_tag", sa.String(length=80), nullable=True))
    op.add_column("document_registry", sa.Column("authority", sa.String(length=20), nullable=True))
    op.add_column("document_registry", sa.Column("shareability", sa.String(length=40), nullable=True))
    op.add_column("document_registry", sa.Column("detected_doc_type", sa.String(length=64), nullable=True))
    op.add_column("document_registry", sa.Column("lifecycle_stage", sa.String(length=20), nullable=True))
    op.add_column("document_registry", sa.Column("last_ingested_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("document_registry", sa.Column("checksum", sa.String(length=128), nullable=True))
    op.add_column("document_registry", sa.Column("etag", sa.String(length=200), nullable=True))
    op.add_column("document_registry", sa.Column("last_modified_utc", sa.DateTime(timezone=True), nullable=True))

    op.execute("UPDATE document_registry SET container_name = 'dataroom' WHERE container_name IS NULL")
    op.execute("UPDATE document_registry SET domain_tag = 'DATAROOM' WHERE domain_tag IS NULL")
    op.execute("UPDATE document_registry SET authority = 'EVIDENCE' WHERE authority IS NULL")
    op.execute("UPDATE document_registry SET shareability = 'INTERNAL' WHERE shareability IS NULL")
    op.execute("UPDATE document_registry SET lifecycle_stage = 'GOVERNANCE' WHERE lifecycle_stage IS NULL")
    op.execute("UPDATE document_registry SET last_ingested_at = COALESCE(as_of, created_at, now()) WHERE last_ingested_at IS NULL")

    op.alter_column("document_registry", "container_name", existing_type=sa.String(length=120), nullable=False)
    op.alter_column("document_registry", "domain_tag", existing_type=sa.String(length=80), nullable=False)
    op.alter_column("document_registry", "authority", existing_type=sa.String(length=20), nullable=False)
    op.alter_column("document_registry", "shareability", existing_type=sa.String(length=40), nullable=False)
    op.alter_column("document_registry", "lifecycle_stage", existing_type=sa.String(length=20), nullable=False)
    op.alter_column("document_registry", "last_ingested_at", existing_type=sa.DateTime(timezone=True), nullable=False)

    op.create_index("ix_document_registry_container_name", "document_registry", ["container_name"])
    op.create_index("ix_document_registry_domain_tag", "document_registry", ["domain_tag"])
    op.create_index("ix_document_registry_authority", "document_registry", ["authority"])
    op.create_index("ix_document_registry_shareability", "document_registry", ["shareability"])
    op.create_index("ix_document_registry_detected_doc_type", "document_registry", ["detected_doc_type"])
    op.create_index("ix_document_registry_lifecycle_stage", "document_registry", ["lifecycle_stage"])
    op.create_index("ix_document_registry_last_ingested_at", "document_registry", ["last_ingested_at"])
    op.create_index("ix_document_registry_fund_container_blob", "document_registry", ["fund_id", "container_name", "blob_path"], unique=True)

    op.create_table(
        "document_classifications",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("doc_id", sa.Uuid(), sa.ForeignKey("document_registry.id", ondelete="CASCADE"), nullable=False),
        sa.Column("doc_type", sa.String(length=64), nullable=False),
        sa.Column("confidence_score", sa.Integer(), nullable=False),
        sa.Column("classification_basis", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_document_classifications_fund_id", "document_classifications", ["fund_id"])
    op.create_index("ix_document_classifications_access_level", "document_classifications", ["access_level"])
    op.create_index("ix_document_classifications_doc_id", "document_classifications", ["doc_id"])
    op.create_index("ix_document_classifications_doc_type", "document_classifications", ["doc_type"])
    op.create_index("ix_document_classifications_fund_doc", "document_classifications", ["fund_id", "doc_id"], unique=True)

    op.create_table(
        "document_governance_profile",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("doc_id", sa.Uuid(), sa.ForeignKey("document_registry.id", ondelete="CASCADE"), nullable=False),
        sa.Column("resolved_authority", sa.String(length=20), nullable=False),
        sa.Column("binding_scope", sa.String(length=40), nullable=False),
        sa.Column("shareability_final", sa.String(length=40), nullable=False),
        sa.Column("jurisdiction", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_document_governance_profile_fund_id", "document_governance_profile", ["fund_id"])
    op.create_index("ix_document_governance_profile_access_level", "document_governance_profile", ["access_level"])
    op.create_index("ix_document_governance_profile_doc_id", "document_governance_profile", ["doc_id"])
    op.create_index("ix_document_governance_profile_resolved_authority", "document_governance_profile", ["resolved_authority"])
    op.create_index("ix_document_governance_profile_binding_scope", "document_governance_profile", ["binding_scope"])
    op.create_index("ix_document_governance_profile_fund_doc", "document_governance_profile", ["fund_id", "doc_id"], unique=True)

    op.create_table(
        "knowledge_anchors",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("doc_id", sa.Uuid(), sa.ForeignKey("document_registry.id", ondelete="CASCADE"), nullable=False),
        sa.Column("anchor_type", sa.String(length=80), nullable=False),
        sa.Column("anchor_value", sa.String(length=500), nullable=False),
        sa.Column("source_snippet", sa.Text(), nullable=True),
        sa.Column("page_reference", sa.String(length=80), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_knowledge_anchors_fund_id", "knowledge_anchors", ["fund_id"])
    op.create_index("ix_knowledge_anchors_access_level", "knowledge_anchors", ["access_level"])
    op.create_index("ix_knowledge_anchors_doc_id", "knowledge_anchors", ["doc_id"])
    op.create_index("ix_knowledge_anchors_anchor_type", "knowledge_anchors", ["anchor_type"])
    op.create_index("ix_knowledge_anchors_fund_doc", "knowledge_anchors", ["fund_id", "doc_id"])


def downgrade() -> None:
    op.drop_index("ix_knowledge_anchors_fund_doc", table_name="knowledge_anchors")
    op.drop_index("ix_knowledge_anchors_anchor_type", table_name="knowledge_anchors")
    op.drop_index("ix_knowledge_anchors_doc_id", table_name="knowledge_anchors")
    op.drop_index("ix_knowledge_anchors_access_level", table_name="knowledge_anchors")
    op.drop_index("ix_knowledge_anchors_fund_id", table_name="knowledge_anchors")
    op.drop_table("knowledge_anchors")

    op.drop_index("ix_document_governance_profile_fund_doc", table_name="document_governance_profile")
    op.drop_index("ix_document_governance_profile_binding_scope", table_name="document_governance_profile")
    op.drop_index("ix_document_governance_profile_resolved_authority", table_name="document_governance_profile")
    op.drop_index("ix_document_governance_profile_doc_id", table_name="document_governance_profile")
    op.drop_index("ix_document_governance_profile_access_level", table_name="document_governance_profile")
    op.drop_index("ix_document_governance_profile_fund_id", table_name="document_governance_profile")
    op.drop_table("document_governance_profile")

    op.drop_index("ix_document_classifications_fund_doc", table_name="document_classifications")
    op.drop_index("ix_document_classifications_doc_type", table_name="document_classifications")
    op.drop_index("ix_document_classifications_doc_id", table_name="document_classifications")
    op.drop_index("ix_document_classifications_access_level", table_name="document_classifications")
    op.drop_index("ix_document_classifications_fund_id", table_name="document_classifications")
    op.drop_table("document_classifications")

    op.drop_index("ix_document_registry_fund_container_blob", table_name="document_registry")
    op.drop_index("ix_document_registry_last_ingested_at", table_name="document_registry")
    op.drop_index("ix_document_registry_lifecycle_stage", table_name="document_registry")
    op.drop_index("ix_document_registry_detected_doc_type", table_name="document_registry")
    op.drop_index("ix_document_registry_shareability", table_name="document_registry")
    op.drop_index("ix_document_registry_authority", table_name="document_registry")
    op.drop_index("ix_document_registry_domain_tag", table_name="document_registry")
    op.drop_index("ix_document_registry_container_name", table_name="document_registry")

    op.drop_column("document_registry", "last_modified_utc")
    op.drop_column("document_registry", "etag")
    op.drop_column("document_registry", "checksum")
    op.drop_column("document_registry", "last_ingested_at")
    op.drop_column("document_registry", "lifecycle_stage")
    op.drop_column("document_registry", "detected_doc_type")
    op.drop_column("document_registry", "shareability")
    op.drop_column("document_registry", "authority")
    op.drop_column("document_registry", "domain_tag")
    op.drop_column("document_registry", "container_name")

    op.alter_column("document_registry", "version_id", existing_type=sa.Uuid(), nullable=False)
    op.alter_column("document_registry", "document_id", existing_type=sa.Uuid(), nullable=False)
