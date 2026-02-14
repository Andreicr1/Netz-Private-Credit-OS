"""Wave AI-1 institutional persistence layer.

Revision ID: 0020_ai_engine_wave_ai1
Revises: 0019_nav_snapshots_and_investor_statements
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0020_ai_engine_wave_ai1"
down_revision = "0019_nav_snapshots_and_investor_statements"


def upgrade() -> None:
    op.create_table(
        "document_registry",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("document_id", sa.Uuid(), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_id", sa.Uuid(), sa.ForeignKey("document_versions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("blob_path", sa.String(length=800), nullable=True),
        sa.Column("root_folder", sa.String(length=200), nullable=True),
        sa.Column("folder_path", sa.String(length=800), nullable=True),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("institutional_type", sa.String(length=64), nullable=False),
        sa.Column("source_signals", sa.JSON(), nullable=True),
        sa.Column("classifier_version", sa.String(length=80), nullable=False, server_default="wave-ai1-v1"),
        sa.Column("as_of", sa.DateTime(timezone=True), nullable=False),
        sa.Column("data_latency", sa.Integer(), nullable=True),
        sa.Column("data_quality", sa.String(length=16), nullable=True, server_default="OK"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_document_registry_fund_id", "document_registry", ["fund_id"])
    op.create_index("ix_document_registry_access_level", "document_registry", ["access_level"])
    op.create_index("ix_document_registry_document_id", "document_registry", ["document_id"])
    op.create_index("ix_document_registry_version_id", "document_registry", ["version_id"])
    op.create_index("ix_document_registry_root_folder", "document_registry", ["root_folder"])
    op.create_index("ix_document_registry_folder_path", "document_registry", ["folder_path"])
    op.create_index("ix_document_registry_title", "document_registry", ["title"])
    op.create_index("ix_document_registry_institutional_type", "document_registry", ["institutional_type"])
    op.create_index("ix_document_registry_as_of", "document_registry", ["as_of"])
    op.create_index("ix_document_registry_fund_type", "document_registry", ["fund_id", "institutional_type"])
    op.create_index("ix_document_registry_fund_version", "document_registry", ["fund_id", "version_id"], unique=True)

    op.create_table(
        "manager_profiles",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("strategy", sa.String(length=200), nullable=False),
        sa.Column("region", sa.String(length=120), nullable=False),
        sa.Column("vehicle_type", sa.String(length=120), nullable=False),
        sa.Column("declared_target_return", sa.String(length=40), nullable=True),
        sa.Column("reporting_cadence", sa.String(length=80), nullable=False),
        sa.Column("key_risks_declared", sa.JSON(), nullable=True),
        sa.Column("last_document_update", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source_documents", sa.JSON(), nullable=True),
        sa.Column("as_of", sa.DateTime(timezone=True), nullable=False),
        sa.Column("data_latency", sa.Integer(), nullable=True),
        sa.Column("data_quality", sa.String(length=16), nullable=True, server_default="OK"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_manager_profiles_fund_id", "manager_profiles", ["fund_id"])
    op.create_index("ix_manager_profiles_access_level", "manager_profiles", ["access_level"])
    op.create_index("ix_manager_profiles_name", "manager_profiles", ["name"])
    op.create_index("ix_manager_profiles_as_of", "manager_profiles", ["as_of"])
    op.create_index("ix_manager_profiles_fund_name", "manager_profiles", ["fund_id", "name"], unique=True)

    op.create_table(
        "obligation_register",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("obligation_id", sa.String(length=64), nullable=False),
        sa.Column("source", sa.String(length=40), nullable=False),
        sa.Column("obligation_text", sa.Text(), nullable=False),
        sa.Column("frequency", sa.String(length=40), nullable=False),
        sa.Column("due_rule", sa.String(length=300), nullable=False),
        sa.Column("responsible_party", sa.String(length=120), nullable=False),
        sa.Column("evidence_expected", sa.String(length=300), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("source_documents", sa.JSON(), nullable=True),
        sa.Column("as_of", sa.DateTime(timezone=True), nullable=False),
        sa.Column("data_latency", sa.Integer(), nullable=True),
        sa.Column("data_quality", sa.String(length=16), nullable=True, server_default="OK"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_obligation_register_fund_id", "obligation_register", ["fund_id"])
    op.create_index("ix_obligation_register_access_level", "obligation_register", ["access_level"])
    op.create_index("ix_obligation_register_obligation_id", "obligation_register", ["obligation_id"])
    op.create_index("ix_obligation_register_source", "obligation_register", ["source"])
    op.create_index("ix_obligation_register_frequency", "obligation_register", ["frequency"])
    op.create_index("ix_obligation_register_status", "obligation_register", ["status"])
    op.create_index("ix_obligation_register_as_of", "obligation_register", ["as_of"])
    op.create_index("ix_obligation_register_fund_obligation_id", "obligation_register", ["fund_id", "obligation_id"], unique=True)

    op.create_table(
        "governance_alerts",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("alert_id", sa.String(length=80), nullable=False),
        sa.Column("domain", sa.String(length=40), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("entity_ref", sa.String(length=200), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("actionable_next_step", sa.Text(), nullable=False),
        sa.Column("as_of", sa.DateTime(timezone=True), nullable=False),
        sa.Column("data_latency", sa.Integer(), nullable=True),
        sa.Column("data_quality", sa.String(length=16), nullable=True, server_default="OK"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_governance_alerts_fund_id", "governance_alerts", ["fund_id"])
    op.create_index("ix_governance_alerts_access_level", "governance_alerts", ["access_level"])
    op.create_index("ix_governance_alerts_alert_id", "governance_alerts", ["alert_id"])
    op.create_index("ix_governance_alerts_domain", "governance_alerts", ["domain"])
    op.create_index("ix_governance_alerts_severity", "governance_alerts", ["severity"])
    op.create_index("ix_governance_alerts_as_of", "governance_alerts", ["as_of"])
    op.create_index("ix_governance_alerts_fund_alert_id", "governance_alerts", ["fund_id", "alert_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_governance_alerts_fund_alert_id", table_name="governance_alerts")
    op.drop_index("ix_governance_alerts_as_of", table_name="governance_alerts")
    op.drop_index("ix_governance_alerts_severity", table_name="governance_alerts")
    op.drop_index("ix_governance_alerts_domain", table_name="governance_alerts")
    op.drop_index("ix_governance_alerts_alert_id", table_name="governance_alerts")
    op.drop_index("ix_governance_alerts_access_level", table_name="governance_alerts")
    op.drop_index("ix_governance_alerts_fund_id", table_name="governance_alerts")
    op.drop_table("governance_alerts")

    op.drop_index("ix_obligation_register_fund_obligation_id", table_name="obligation_register")
    op.drop_index("ix_obligation_register_as_of", table_name="obligation_register")
    op.drop_index("ix_obligation_register_status", table_name="obligation_register")
    op.drop_index("ix_obligation_register_frequency", table_name="obligation_register")
    op.drop_index("ix_obligation_register_source", table_name="obligation_register")
    op.drop_index("ix_obligation_register_obligation_id", table_name="obligation_register")
    op.drop_index("ix_obligation_register_access_level", table_name="obligation_register")
    op.drop_index("ix_obligation_register_fund_id", table_name="obligation_register")
    op.drop_table("obligation_register")

    op.drop_index("ix_manager_profiles_fund_name", table_name="manager_profiles")
    op.drop_index("ix_manager_profiles_as_of", table_name="manager_profiles")
    op.drop_index("ix_manager_profiles_name", table_name="manager_profiles")
    op.drop_index("ix_manager_profiles_access_level", table_name="manager_profiles")
    op.drop_index("ix_manager_profiles_fund_id", table_name="manager_profiles")
    op.drop_table("manager_profiles")

    op.drop_index("ix_document_registry_fund_version", table_name="document_registry")
    op.drop_index("ix_document_registry_fund_type", table_name="document_registry")
    op.drop_index("ix_document_registry_as_of", table_name="document_registry")
    op.drop_index("ix_document_registry_institutional_type", table_name="document_registry")
    op.drop_index("ix_document_registry_title", table_name="document_registry")
    op.drop_index("ix_document_registry_folder_path", table_name="document_registry")
    op.drop_index("ix_document_registry_root_folder", table_name="document_registry")
    op.drop_index("ix_document_registry_version_id", table_name="document_registry")
    op.drop_index("ix_document_registry_document_id", table_name="document_registry")
    op.drop_index("ix_document_registry_access_level", table_name="document_registry")
    op.drop_index("ix_document_registry_fund_id", table_name="document_registry")
    op.drop_table("document_registry")
