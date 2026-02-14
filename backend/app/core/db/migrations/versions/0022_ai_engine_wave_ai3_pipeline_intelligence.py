"""Wave AI-3 pipeline intelligence institutional layer.

Revision ID: 0022_ai_engine_wave_ai3_pipeline_intelligence
Revises: 0021_ai_engine_wave_ai2
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0022_ai_engine_wave_ai3_pipeline_intelligence"
down_revision = "0021_ai_engine_wave_ai2"


def upgrade() -> None:
    op.add_column("pipeline_deals", sa.Column("deal_name", sa.String(length=300), nullable=True))
    op.add_column("pipeline_deals", sa.Column("sponsor_name", sa.String(length=300), nullable=True))
    op.add_column("pipeline_deals", sa.Column("lifecycle_stage", sa.String(length=32), nullable=True))
    op.add_column("pipeline_deals", sa.Column("first_detected_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("pipeline_deals", sa.Column("last_updated_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("pipeline_deals", sa.Column("deal_folder_path", sa.String(length=800), nullable=True))
    op.add_column("pipeline_deals", sa.Column("transition_target_container", sa.String(length=120), nullable=True))
    op.add_column("pipeline_deals", sa.Column("intelligence_history", sa.JSON(), nullable=True))

    op.execute("UPDATE pipeline_deals SET lifecycle_stage = COALESCE(stage, 'SCREENING') WHERE lifecycle_stage IS NULL")
    op.execute("UPDATE pipeline_deals SET deal_name = COALESCE(title, borrower_name, 'Unnamed Deal') WHERE deal_name IS NULL")
    op.execute("UPDATE pipeline_deals SET sponsor_name = COALESCE(borrower_name, title) WHERE sponsor_name IS NULL")
    op.execute("UPDATE pipeline_deals SET first_detected_at = COALESCE(created_at, now()) WHERE first_detected_at IS NULL")
    op.execute("UPDATE pipeline_deals SET last_updated_at = COALESCE(updated_at, now()) WHERE last_updated_at IS NULL")
    op.execute("UPDATE pipeline_deals SET transition_target_container = 'portfolio-active-investments' WHERE transition_target_container IS NULL")

    op.create_index("ix_pipeline_deals_deal_name", "pipeline_deals", ["deal_name"])
    op.create_index("ix_pipeline_deals_sponsor_name", "pipeline_deals", ["sponsor_name"])
    op.create_index("ix_pipeline_deals_lifecycle_stage", "pipeline_deals", ["lifecycle_stage"])
    op.create_index("ix_pipeline_deals_first_detected_at", "pipeline_deals", ["first_detected_at"])
    op.create_index("ix_pipeline_deals_last_updated_at", "pipeline_deals", ["last_updated_at"])
    op.create_index("ix_pipeline_deals_deal_folder_path", "pipeline_deals", ["deal_folder_path"])

    op.create_table(
        "deal_documents",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("deal_id", sa.Uuid(), sa.ForeignKey("pipeline_deals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("doc_id", sa.Uuid(), sa.ForeignKey("document_registry.id", ondelete="CASCADE"), nullable=False),
        sa.Column("doc_type", sa.String(length=64), nullable=False),
        sa.Column("confidence_score", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_deal_documents_fund_id", "deal_documents", ["fund_id"])
    op.create_index("ix_deal_documents_access_level", "deal_documents", ["access_level"])
    op.create_index("ix_deal_documents_deal_id", "deal_documents", ["deal_id"])
    op.create_index("ix_deal_documents_doc_id", "deal_documents", ["doc_id"])
    op.create_index("ix_deal_documents_doc_type", "deal_documents", ["doc_type"])
    op.create_index("ix_deal_documents_fund_deal_doc", "deal_documents", ["fund_id", "deal_id", "doc_id"], unique=True)

    op.create_table(
        "deal_intelligence_profiles",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("deal_id", sa.Uuid(), sa.ForeignKey("pipeline_deals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("strategy_type", sa.String(length=80), nullable=False),
        sa.Column("geography", sa.String(length=120), nullable=True),
        sa.Column("sector_focus", sa.String(length=160), nullable=True),
        sa.Column("target_return", sa.String(length=60), nullable=True),
        sa.Column("risk_band", sa.String(length=20), nullable=False),
        sa.Column("liquidity_profile", sa.String(length=80), nullable=True),
        sa.Column("capital_structure_type", sa.String(length=80), nullable=True),
        sa.Column("key_risks", sa.JSON(), nullable=True),
        sa.Column("differentiators", sa.JSON(), nullable=True),
        sa.Column("summary_ic_ready", sa.Text(), nullable=False),
        sa.Column("last_ai_refresh", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_deal_intelligence_profiles_fund_id", "deal_intelligence_profiles", ["fund_id"])
    op.create_index("ix_deal_intelligence_profiles_access_level", "deal_intelligence_profiles", ["access_level"])
    op.create_index("ix_deal_intelligence_profiles_deal_id", "deal_intelligence_profiles", ["deal_id"])
    op.create_index("ix_deal_intelligence_profiles_strategy_type", "deal_intelligence_profiles", ["strategy_type"])
    op.create_index("ix_deal_intelligence_profiles_risk_band", "deal_intelligence_profiles", ["risk_band"])
    op.create_index("ix_deal_intelligence_profiles_last_ai_refresh", "deal_intelligence_profiles", ["last_ai_refresh"])
    op.create_index("ix_deal_intelligence_profiles_fund_deal", "deal_intelligence_profiles", ["fund_id", "deal_id"], unique=True)

    op.create_table(
        "deal_risk_flags",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("deal_id", sa.Uuid(), sa.ForeignKey("pipeline_deals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("risk_type", sa.String(length=40), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("reasoning", sa.Text(), nullable=False),
        sa.Column("source_document", sa.String(length=800), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_deal_risk_flags_fund_id", "deal_risk_flags", ["fund_id"])
    op.create_index("ix_deal_risk_flags_access_level", "deal_risk_flags", ["access_level"])
    op.create_index("ix_deal_risk_flags_deal_id", "deal_risk_flags", ["deal_id"])
    op.create_index("ix_deal_risk_flags_risk_type", "deal_risk_flags", ["risk_type"])
    op.create_index("ix_deal_risk_flags_severity", "deal_risk_flags", ["severity"])
    op.create_index("ix_deal_risk_flags_fund_deal", "deal_risk_flags", ["fund_id", "deal_id"])

    op.create_table(
        "deal_ic_briefs",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("deal_id", sa.Uuid(), sa.ForeignKey("pipeline_deals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("executive_summary", sa.Text(), nullable=False),
        sa.Column("opportunity_overview", sa.Text(), nullable=False),
        sa.Column("return_profile", sa.Text(), nullable=False),
        sa.Column("downside_case", sa.Text(), nullable=False),
        sa.Column("risk_summary", sa.Text(), nullable=False),
        sa.Column("comparison_peer_funds", sa.Text(), nullable=False),
        sa.Column("recommendation_signal", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_deal_ic_briefs_fund_id", "deal_ic_briefs", ["fund_id"])
    op.create_index("ix_deal_ic_briefs_access_level", "deal_ic_briefs", ["access_level"])
    op.create_index("ix_deal_ic_briefs_deal_id", "deal_ic_briefs", ["deal_id"])
    op.create_index("ix_deal_ic_briefs_recommendation_signal", "deal_ic_briefs", ["recommendation_signal"])
    op.create_index("ix_deal_ic_briefs_fund_deal", "deal_ic_briefs", ["fund_id", "deal_id"], unique=True)

    op.create_table(
        "pipeline_alerts",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("deal_id", sa.Uuid(), sa.ForeignKey("pipeline_deals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("alert_type", sa.String(length=64), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("resolved_flag", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_pipeline_alerts_fund_id", "pipeline_alerts", ["fund_id"])
    op.create_index("ix_pipeline_alerts_access_level", "pipeline_alerts", ["access_level"])
    op.create_index("ix_pipeline_alerts_deal_id", "pipeline_alerts", ["deal_id"])
    op.create_index("ix_pipeline_alerts_alert_type", "pipeline_alerts", ["alert_type"])
    op.create_index("ix_pipeline_alerts_severity", "pipeline_alerts", ["severity"])
    op.create_index("ix_pipeline_alerts_resolved_flag", "pipeline_alerts", ["resolved_flag"])
    op.create_index("ix_pipeline_alerts_fund_deal", "pipeline_alerts", ["fund_id", "deal_id"])


def downgrade() -> None:
    op.drop_index("ix_pipeline_alerts_fund_deal", table_name="pipeline_alerts")
    op.drop_index("ix_pipeline_alerts_resolved_flag", table_name="pipeline_alerts")
    op.drop_index("ix_pipeline_alerts_severity", table_name="pipeline_alerts")
    op.drop_index("ix_pipeline_alerts_alert_type", table_name="pipeline_alerts")
    op.drop_index("ix_pipeline_alerts_deal_id", table_name="pipeline_alerts")
    op.drop_index("ix_pipeline_alerts_access_level", table_name="pipeline_alerts")
    op.drop_index("ix_pipeline_alerts_fund_id", table_name="pipeline_alerts")
    op.drop_table("pipeline_alerts")

    op.drop_index("ix_deal_ic_briefs_fund_deal", table_name="deal_ic_briefs")
    op.drop_index("ix_deal_ic_briefs_recommendation_signal", table_name="deal_ic_briefs")
    op.drop_index("ix_deal_ic_briefs_deal_id", table_name="deal_ic_briefs")
    op.drop_index("ix_deal_ic_briefs_access_level", table_name="deal_ic_briefs")
    op.drop_index("ix_deal_ic_briefs_fund_id", table_name="deal_ic_briefs")
    op.drop_table("deal_ic_briefs")

    op.drop_index("ix_deal_risk_flags_fund_deal", table_name="deal_risk_flags")
    op.drop_index("ix_deal_risk_flags_severity", table_name="deal_risk_flags")
    op.drop_index("ix_deal_risk_flags_risk_type", table_name="deal_risk_flags")
    op.drop_index("ix_deal_risk_flags_deal_id", table_name="deal_risk_flags")
    op.drop_index("ix_deal_risk_flags_access_level", table_name="deal_risk_flags")
    op.drop_index("ix_deal_risk_flags_fund_id", table_name="deal_risk_flags")
    op.drop_table("deal_risk_flags")

    op.drop_index("ix_deal_intelligence_profiles_fund_deal", table_name="deal_intelligence_profiles")
    op.drop_index("ix_deal_intelligence_profiles_last_ai_refresh", table_name="deal_intelligence_profiles")
    op.drop_index("ix_deal_intelligence_profiles_risk_band", table_name="deal_intelligence_profiles")
    op.drop_index("ix_deal_intelligence_profiles_strategy_type", table_name="deal_intelligence_profiles")
    op.drop_index("ix_deal_intelligence_profiles_deal_id", table_name="deal_intelligence_profiles")
    op.drop_index("ix_deal_intelligence_profiles_access_level", table_name="deal_intelligence_profiles")
    op.drop_index("ix_deal_intelligence_profiles_fund_id", table_name="deal_intelligence_profiles")
    op.drop_table("deal_intelligence_profiles")

    op.drop_index("ix_deal_documents_fund_deal_doc", table_name="deal_documents")
    op.drop_index("ix_deal_documents_doc_type", table_name="deal_documents")
    op.drop_index("ix_deal_documents_doc_id", table_name="deal_documents")
    op.drop_index("ix_deal_documents_deal_id", table_name="deal_documents")
    op.drop_index("ix_deal_documents_access_level", table_name="deal_documents")
    op.drop_index("ix_deal_documents_fund_id", table_name="deal_documents")
    op.drop_table("deal_documents")

    op.drop_index("ix_pipeline_deals_deal_folder_path", table_name="pipeline_deals")
    op.drop_index("ix_pipeline_deals_last_updated_at", table_name="pipeline_deals")
    op.drop_index("ix_pipeline_deals_first_detected_at", table_name="pipeline_deals")
    op.drop_index("ix_pipeline_deals_lifecycle_stage", table_name="pipeline_deals")
    op.drop_index("ix_pipeline_deals_sponsor_name", table_name="pipeline_deals")
    op.drop_index("ix_pipeline_deals_deal_name", table_name="pipeline_deals")

    op.drop_column("pipeline_deals", "intelligence_history")
    op.drop_column("pipeline_deals", "transition_target_container")
    op.drop_column("pipeline_deals", "deal_folder_path")
    op.drop_column("pipeline_deals", "last_updated_at")
    op.drop_column("pipeline_deals", "first_detected_at")
    op.drop_column("pipeline_deals", "lifecycle_stage")
    op.drop_column("pipeline_deals", "sponsor_name")
    op.drop_column("pipeline_deals", "deal_name")
