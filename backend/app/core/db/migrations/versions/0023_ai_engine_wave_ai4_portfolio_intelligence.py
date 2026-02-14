"""Wave AI-4 active portfolio intelligence institutional layer.

Revision ID: 0023_ai_engine_wave_ai4_portfolio_intelligence
Revises: 0022_ai_engine_wave_ai3_pipeline_intelligence
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0023_ai_engine_wave_ai4_portfolio_intelligence"
down_revision = "0022_ai_engine_wave_ai3_pipeline_intelligence"


def upgrade() -> None:
    op.create_table(
        "active_investments",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("deal_id", sa.Uuid(), sa.ForeignKey("pipeline_deals.id", ondelete="SET NULL"), nullable=True),
        sa.Column("primary_document_id", sa.Uuid(), sa.ForeignKey("document_registry.id", ondelete="SET NULL"), nullable=True),
        sa.Column("investment_name", sa.String(length=300), nullable=False),
        sa.Column("manager_name", sa.String(length=300), nullable=True),
        sa.Column("lifecycle_status", sa.String(length=40), nullable=False),
        sa.Column("source_container", sa.String(length=120), nullable=False),
        sa.Column("source_folder", sa.String(length=400), nullable=False),
        sa.Column("strategy_type", sa.String(length=120), nullable=True),
        sa.Column("target_return", sa.String(length=60), nullable=True),
        sa.Column("committed_capital_usd", sa.Float(), nullable=True),
        sa.Column("deployed_capital_usd", sa.Float(), nullable=True),
        sa.Column("current_nav_usd", sa.Float(), nullable=True),
        sa.Column("last_monitoring_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("transition_log", sa.JSON(), nullable=True),
        sa.Column("as_of", sa.DateTime(timezone=True), nullable=False),
        sa.Column("data_latency", sa.Integer(), nullable=True),
        sa.Column("data_quality", sa.String(length=16), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_active_investments_fund_id", "active_investments", ["fund_id"])
    op.create_index("ix_active_investments_access_level", "active_investments", ["access_level"])
    op.create_index("ix_active_investments_deal_id", "active_investments", ["deal_id"])
    op.create_index("ix_active_investments_primary_document_id", "active_investments", ["primary_document_id"])
    op.create_index("ix_active_investments_investment_name", "active_investments", ["investment_name"])
    op.create_index("ix_active_investments_manager_name", "active_investments", ["manager_name"])
    op.create_index("ix_active_investments_lifecycle_status", "active_investments", ["lifecycle_status"])
    op.create_index("ix_active_investments_source_container", "active_investments", ["source_container"])
    op.create_index("ix_active_investments_source_folder", "active_investments", ["source_folder"])
    op.create_index("ix_active_investments_last_monitoring_at", "active_investments", ["last_monitoring_at"])
    op.create_index("ix_active_investments_as_of", "active_investments", ["as_of"])
    op.create_index("ix_active_investments_fund_name", "active_investments", ["fund_id", "investment_name"])
    op.create_index("ix_active_investments_fund_source_folder", "active_investments", ["fund_id", "source_folder"], unique=True)

    op.create_table(
        "performance_drift_flags",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("investment_id", sa.Uuid(), sa.ForeignKey("active_investments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("metric_name", sa.String(length=120), nullable=False),
        sa.Column("baseline_value", sa.Float(), nullable=True),
        sa.Column("current_value", sa.Float(), nullable=True),
        sa.Column("drift_pct", sa.Float(), nullable=True),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("reasoning", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="OPEN"),
        sa.Column("as_of", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_performance_drift_flags_fund_id", "performance_drift_flags", ["fund_id"])
    op.create_index("ix_performance_drift_flags_access_level", "performance_drift_flags", ["access_level"])
    op.create_index("ix_performance_drift_flags_investment_id", "performance_drift_flags", ["investment_id"])
    op.create_index("ix_performance_drift_flags_metric_name", "performance_drift_flags", ["metric_name"])
    op.create_index("ix_performance_drift_flags_severity", "performance_drift_flags", ["severity"])
    op.create_index("ix_performance_drift_flags_status", "performance_drift_flags", ["status"])
    op.create_index("ix_performance_drift_flags_as_of", "performance_drift_flags", ["as_of"])
    op.create_index("ix_performance_drift_flags_fund_investment", "performance_drift_flags", ["fund_id", "investment_id"])

    op.create_table(
        "covenant_status_register",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("investment_id", sa.Uuid(), sa.ForeignKey("active_investments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("covenant_id", sa.Uuid(), sa.ForeignKey("covenants.id", ondelete="SET NULL"), nullable=True),
        sa.Column("covenant_test_id", sa.Uuid(), sa.ForeignKey("covenant_tests.id", ondelete="SET NULL"), nullable=True),
        sa.Column("breach_id", sa.Uuid(), sa.ForeignKey("covenant_breaches.id", ondelete="SET NULL"), nullable=True),
        sa.Column("covenant_name", sa.String(length=200), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("last_tested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_test_due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("as_of", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_covenant_status_register_fund_id", "covenant_status_register", ["fund_id"])
    op.create_index("ix_covenant_status_register_access_level", "covenant_status_register", ["access_level"])
    op.create_index("ix_covenant_status_register_investment_id", "covenant_status_register", ["investment_id"])
    op.create_index("ix_covenant_status_register_covenant_id", "covenant_status_register", ["covenant_id"])
    op.create_index("ix_covenant_status_register_covenant_test_id", "covenant_status_register", ["covenant_test_id"])
    op.create_index("ix_covenant_status_register_breach_id", "covenant_status_register", ["breach_id"])
    op.create_index("ix_covenant_status_register_covenant_name", "covenant_status_register", ["covenant_name"])
    op.create_index("ix_covenant_status_register_status", "covenant_status_register", ["status"])
    op.create_index("ix_covenant_status_register_severity", "covenant_status_register", ["severity"])
    op.create_index("ix_covenant_status_register_as_of", "covenant_status_register", ["as_of"])
    op.create_index("ix_covenant_status_register_fund_investment", "covenant_status_register", ["fund_id", "investment_id"])

    op.create_table(
        "cash_impact_flags",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("investment_id", sa.Uuid(), sa.ForeignKey("active_investments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("transaction_id", sa.Uuid(), sa.ForeignKey("cash_transactions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("impact_type", sa.String(length=80), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("estimated_impact_usd", sa.Float(), nullable=True),
        sa.Column("liquidity_days", sa.Integer(), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("resolved_flag", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("as_of", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_cash_impact_flags_fund_id", "cash_impact_flags", ["fund_id"])
    op.create_index("ix_cash_impact_flags_access_level", "cash_impact_flags", ["access_level"])
    op.create_index("ix_cash_impact_flags_investment_id", "cash_impact_flags", ["investment_id"])
    op.create_index("ix_cash_impact_flags_transaction_id", "cash_impact_flags", ["transaction_id"])
    op.create_index("ix_cash_impact_flags_impact_type", "cash_impact_flags", ["impact_type"])
    op.create_index("ix_cash_impact_flags_severity", "cash_impact_flags", ["severity"])
    op.create_index("ix_cash_impact_flags_resolved_flag", "cash_impact_flags", ["resolved_flag"])
    op.create_index("ix_cash_impact_flags_as_of", "cash_impact_flags", ["as_of"])
    op.create_index("ix_cash_impact_flags_fund_investment", "cash_impact_flags", ["fund_id", "investment_id"])

    op.create_table(
        "investment_risk_registry",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("investment_id", sa.Uuid(), sa.ForeignKey("active_investments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("risk_type", sa.String(length=80), nullable=False),
        sa.Column("risk_level", sa.String(length=20), nullable=False),
        sa.Column("trend", sa.String(length=20), nullable=True),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column("source_evidence", sa.JSON(), nullable=True),
        sa.Column("as_of", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_investment_risk_registry_fund_id", "investment_risk_registry", ["fund_id"])
    op.create_index("ix_investment_risk_registry_access_level", "investment_risk_registry", ["access_level"])
    op.create_index("ix_investment_risk_registry_investment_id", "investment_risk_registry", ["investment_id"])
    op.create_index("ix_investment_risk_registry_risk_type", "investment_risk_registry", ["risk_type"])
    op.create_index("ix_investment_risk_registry_risk_level", "investment_risk_registry", ["risk_level"])
    op.create_index("ix_investment_risk_registry_as_of", "investment_risk_registry", ["as_of"])
    op.create_index("ix_investment_risk_registry_fund_investment", "investment_risk_registry", ["fund_id", "investment_id"])

    op.create_table(
        "board_monitoring_briefs",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("investment_id", sa.Uuid(), sa.ForeignKey("active_investments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("executive_summary", sa.Text(), nullable=False),
        sa.Column("performance_view", sa.Text(), nullable=False),
        sa.Column("covenant_view", sa.Text(), nullable=False),
        sa.Column("liquidity_view", sa.Text(), nullable=False),
        sa.Column("risk_reclassification_view", sa.Text(), nullable=False),
        sa.Column("recommended_actions", sa.JSON(), nullable=True),
        sa.Column("last_generated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("as_of", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_board_monitoring_briefs_fund_id", "board_monitoring_briefs", ["fund_id"])
    op.create_index("ix_board_monitoring_briefs_access_level", "board_monitoring_briefs", ["access_level"])
    op.create_index("ix_board_monitoring_briefs_investment_id", "board_monitoring_briefs", ["investment_id"])
    op.create_index("ix_board_monitoring_briefs_last_generated_at", "board_monitoring_briefs", ["last_generated_at"])
    op.create_index("ix_board_monitoring_briefs_as_of", "board_monitoring_briefs", ["as_of"])
    op.create_index("ix_board_monitoring_briefs_fund_investment", "board_monitoring_briefs", ["fund_id", "investment_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_board_monitoring_briefs_fund_investment", table_name="board_monitoring_briefs")
    op.drop_index("ix_board_monitoring_briefs_as_of", table_name="board_monitoring_briefs")
    op.drop_index("ix_board_monitoring_briefs_last_generated_at", table_name="board_monitoring_briefs")
    op.drop_index("ix_board_monitoring_briefs_investment_id", table_name="board_monitoring_briefs")
    op.drop_index("ix_board_monitoring_briefs_access_level", table_name="board_monitoring_briefs")
    op.drop_index("ix_board_monitoring_briefs_fund_id", table_name="board_monitoring_briefs")
    op.drop_table("board_monitoring_briefs")

    op.drop_index("ix_investment_risk_registry_fund_investment", table_name="investment_risk_registry")
    op.drop_index("ix_investment_risk_registry_as_of", table_name="investment_risk_registry")
    op.drop_index("ix_investment_risk_registry_risk_level", table_name="investment_risk_registry")
    op.drop_index("ix_investment_risk_registry_risk_type", table_name="investment_risk_registry")
    op.drop_index("ix_investment_risk_registry_investment_id", table_name="investment_risk_registry")
    op.drop_index("ix_investment_risk_registry_access_level", table_name="investment_risk_registry")
    op.drop_index("ix_investment_risk_registry_fund_id", table_name="investment_risk_registry")
    op.drop_table("investment_risk_registry")

    op.drop_index("ix_cash_impact_flags_fund_investment", table_name="cash_impact_flags")
    op.drop_index("ix_cash_impact_flags_as_of", table_name="cash_impact_flags")
    op.drop_index("ix_cash_impact_flags_resolved_flag", table_name="cash_impact_flags")
    op.drop_index("ix_cash_impact_flags_severity", table_name="cash_impact_flags")
    op.drop_index("ix_cash_impact_flags_impact_type", table_name="cash_impact_flags")
    op.drop_index("ix_cash_impact_flags_transaction_id", table_name="cash_impact_flags")
    op.drop_index("ix_cash_impact_flags_investment_id", table_name="cash_impact_flags")
    op.drop_index("ix_cash_impact_flags_access_level", table_name="cash_impact_flags")
    op.drop_index("ix_cash_impact_flags_fund_id", table_name="cash_impact_flags")
    op.drop_table("cash_impact_flags")

    op.drop_index("ix_covenant_status_register_fund_investment", table_name="covenant_status_register")
    op.drop_index("ix_covenant_status_register_as_of", table_name="covenant_status_register")
    op.drop_index("ix_covenant_status_register_severity", table_name="covenant_status_register")
    op.drop_index("ix_covenant_status_register_status", table_name="covenant_status_register")
    op.drop_index("ix_covenant_status_register_covenant_name", table_name="covenant_status_register")
    op.drop_index("ix_covenant_status_register_breach_id", table_name="covenant_status_register")
    op.drop_index("ix_covenant_status_register_covenant_test_id", table_name="covenant_status_register")
    op.drop_index("ix_covenant_status_register_covenant_id", table_name="covenant_status_register")
    op.drop_index("ix_covenant_status_register_investment_id", table_name="covenant_status_register")
    op.drop_index("ix_covenant_status_register_access_level", table_name="covenant_status_register")
    op.drop_index("ix_covenant_status_register_fund_id", table_name="covenant_status_register")
    op.drop_table("covenant_status_register")

    op.drop_index("ix_performance_drift_flags_fund_investment", table_name="performance_drift_flags")
    op.drop_index("ix_performance_drift_flags_as_of", table_name="performance_drift_flags")
    op.drop_index("ix_performance_drift_flags_status", table_name="performance_drift_flags")
    op.drop_index("ix_performance_drift_flags_severity", table_name="performance_drift_flags")
    op.drop_index("ix_performance_drift_flags_metric_name", table_name="performance_drift_flags")
    op.drop_index("ix_performance_drift_flags_investment_id", table_name="performance_drift_flags")
    op.drop_index("ix_performance_drift_flags_access_level", table_name="performance_drift_flags")
    op.drop_index("ix_performance_drift_flags_fund_id", table_name="performance_drift_flags")
    op.drop_table("performance_drift_flags")

    op.drop_index("ix_active_investments_fund_source_folder", table_name="active_investments")
    op.drop_index("ix_active_investments_fund_name", table_name="active_investments")
    op.drop_index("ix_active_investments_as_of", table_name="active_investments")
    op.drop_index("ix_active_investments_last_monitoring_at", table_name="active_investments")
    op.drop_index("ix_active_investments_source_folder", table_name="active_investments")
    op.drop_index("ix_active_investments_source_container", table_name="active_investments")
    op.drop_index("ix_active_investments_lifecycle_status", table_name="active_investments")
    op.drop_index("ix_active_investments_manager_name", table_name="active_investments")
    op.drop_index("ix_active_investments_investment_name", table_name="active_investments")
    op.drop_index("ix_active_investments_primary_document_id", table_name="active_investments")
    op.drop_index("ix_active_investments_deal_id", table_name="active_investments")
    op.drop_index("ix_active_investments_access_level", table_name="active_investments")
    op.drop_index("ix_active_investments_fund_id", table_name="active_investments")
    op.drop_table("active_investments")
