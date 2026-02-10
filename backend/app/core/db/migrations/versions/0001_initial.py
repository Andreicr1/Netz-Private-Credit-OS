"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-02-07
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def _audit_columns() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    ]


def _fund_columns() -> list[sa.Column]:
    return [
        sa.Column("fund_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal", index=True),
    ]


def upgrade() -> None:
    # --- Core
    op.create_table(
        "funds",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        *_audit_columns(),
    )
    op.create_index("ix_funds_name", "funds", ["name"], unique=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("external_id", sa.String(length=200), nullable=True),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("display_name", sa.String(length=200), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        *_audit_columns(),
    )
    op.create_index("ix_users_external_id", "users", ["external_id"], unique=True)
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "user_fund_roles",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("fund_id", sa.Uuid(), sa.ForeignKey("funds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("role", sa.String(length=32), nullable=False),
        *_audit_columns(),
        sa.UniqueConstraint("user_id", "fund_id", "role", name="uq_user_fund_role"),
    )
    op.create_index("ix_user_fund_roles_user_id", "user_fund_roles", ["user_id"])
    op.create_index("ix_user_fund_roles_fund_id", "user_fund_roles", ["fund_id"])
    op.create_index("ix_user_fund_roles_role", "user_fund_roles", ["role"])

    op.create_table(
        "audit_events",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("actor_id", sa.String(length=200), nullable=False),
        sa.Column("actor_roles", sa.JSON(), nullable=False),
        sa.Column("action", sa.String(length=200), nullable=False),
        sa.Column("entity_type", sa.String(length=100), nullable=False),
        sa.Column("entity_id", sa.String(length=200), nullable=False),
        sa.Column("before", sa.JSON(), nullable=True),
        sa.Column("after", sa.JSON(), nullable=True),
        sa.Column("request_id", sa.String(length=64), nullable=False),
        *_audit_columns(),
    )
    op.create_index("ix_audit_events_fund_id", "audit_events", ["fund_id"])
    op.create_index("ix_audit_events_actor_id", "audit_events", ["actor_id"])
    op.create_index("ix_audit_events_action", "audit_events", ["action"])
    op.create_index("ix_audit_events_entity_type", "audit_events", ["entity_type"])
    op.create_index("ix_audit_events_entity_id", "audit_events", ["entity_id"])
    op.create_index("ix_audit_events_request_id", "audit_events", ["request_id"])
    op.create_index("ix_audit_events_fund_entity", "audit_events", ["fund_id", "entity_type", "entity_id"])

    # --- Portfolio Monitoring
    op.create_table(
        "borrowers",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("legal_name", sa.String(length=300), nullable=False),
        sa.Column("tax_id", sa.String(length=64), nullable=True),
        sa.Column("country", sa.String(length=2), nullable=True),
        sa.Column("industry", sa.String(length=120), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        *_audit_columns(),
    )
    op.create_index("ix_borrowers_fund_id", "borrowers", ["fund_id"])
    op.create_index("ix_borrowers_access_level", "borrowers", ["access_level"])
    op.create_index("ix_borrowers_legal_name", "borrowers", ["legal_name"])
    op.create_index("ix_borrowers_tax_id", "borrowers", ["tax_id"])

    op.create_table(
        "loans",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("borrower_id", sa.Uuid(), sa.ForeignKey("borrowers.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("external_reference", sa.String(length=120), nullable=True),
        sa.Column("principal_amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="USD"),
        sa.Column("interest_rate_bps", sa.Integer(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("maturity_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        *_audit_columns(),
    )
    op.create_index("ix_loans_fund_id", "loans", ["fund_id"])
    op.create_index("ix_loans_access_level", "loans", ["access_level"])
    op.create_index("ix_loans_borrower_id", "loans", ["borrower_id"])
    op.create_index("ix_loans_external_reference", "loans", ["external_reference"])
    op.create_index("ix_loans_maturity_date", "loans", ["maturity_date"])
    op.create_index("ix_loans_status", "loans", ["status"])

    op.create_table(
        "cashflows",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("loan_id", sa.Uuid(), sa.ForeignKey("loans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("flow_date", sa.Date(), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("flow_type", sa.String(length=32), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=True),
        *_audit_columns(),
    )
    op.create_index("ix_cashflows_fund_id", "cashflows", ["fund_id"])
    op.create_index("ix_cashflows_access_level", "cashflows", ["access_level"])
    op.create_index("ix_cashflows_loan_id", "cashflows", ["loan_id"])
    op.create_index("ix_cashflows_flow_date", "cashflows", ["flow_date"])
    op.create_index("ix_cashflows_flow_type", "cashflows", ["flow_type"])

    op.create_table(
        "covenants",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("loan_id", sa.Uuid(), sa.ForeignKey("loans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("covenant_type", sa.String(length=64), nullable=False),
        sa.Column("threshold", sa.Numeric(18, 6), nullable=True),
        sa.Column("comparator", sa.String(length=8), nullable=False, server_default=">="),
        sa.Column("frequency", sa.String(length=32), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        *_audit_columns(),
    )
    op.create_index("ix_covenants_fund_id", "covenants", ["fund_id"])
    op.create_index("ix_covenants_access_level", "covenants", ["access_level"])
    op.create_index("ix_covenants_loan_id", "covenants", ["loan_id"])
    op.create_index("ix_covenants_name", "covenants", ["name"])
    op.create_index("ix_covenants_covenant_type", "covenants", ["covenant_type"])

    op.create_table(
        "covenant_tests",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("covenant_id", sa.Uuid(), sa.ForeignKey("covenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tested_at", sa.Date(), nullable=False),
        sa.Column("value", sa.Numeric(18, 6), nullable=True),
        sa.Column("passed", sa.Boolean(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("inputs", sa.JSON(), nullable=True),
        *_audit_columns(),
    )
    op.create_index("ix_covenant_tests_fund_id", "covenant_tests", ["fund_id"])
    op.create_index("ix_covenant_tests_access_level", "covenant_tests", ["access_level"])
    op.create_index("ix_covenant_tests_covenant_id", "covenant_tests", ["covenant_id"])
    op.create_index("ix_covenant_tests_tested_at", "covenant_tests", ["tested_at"])
    op.create_index("ix_covenant_tests_passed", "covenant_tests", ["passed"])

    op.create_table(
        "covenant_breaches",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column(
            "covenant_test_id",
            sa.Uuid(),
            sa.ForeignKey("covenant_tests.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("breach_detected_at", sa.Date(), nullable=False),
        sa.Column("severity", sa.String(length=32), nullable=False, server_default="warning"),
        sa.Column("details", sa.JSON(), nullable=True),
        *_audit_columns(),
        sa.UniqueConstraint("covenant_test_id", name="uq_breach_test"),
    )
    op.create_index("ix_covenant_breaches_fund_id", "covenant_breaches", ["fund_id"])
    op.create_index("ix_covenant_breaches_access_level", "covenant_breaches", ["access_level"])
    op.create_index("ix_covenant_breaches_covenant_test_id", "covenant_breaches", ["covenant_test_id"])
    op.create_index("ix_covenant_breaches_breach_detected_at", "covenant_breaches", ["breach_detected_at"])
    op.create_index("ix_covenant_breaches_severity", "covenant_breaches", ["severity"])

    op.create_table(
        "exposures",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("loan_id", sa.Uuid(), sa.ForeignKey("loans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("as_of", sa.Date(), nullable=False),
        sa.Column("exposure_amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("exposure_type", sa.String(length=64), nullable=False, server_default="principal"),
        sa.Column("metadata", sa.JSON(), nullable=True),
        *_audit_columns(),
    )
    op.create_index("ix_exposures_fund_id", "exposures", ["fund_id"])
    op.create_index("ix_exposures_access_level", "exposures", ["access_level"])
    op.create_index("ix_exposures_loan_id", "exposures", ["loan_id"])
    op.create_index("ix_exposures_as_of", "exposures", ["as_of"])
    op.create_index("ix_exposures_exposure_type", "exposures", ["exposure_type"])

    op.create_table(
        "alerts",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("alert_type", sa.String(length=32), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False, server_default="info"),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("entity_type", sa.String(length=64), nullable=True),
        sa.Column("entity_id", sa.String(length=200), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="open"),
        sa.Column("data", sa.JSON(), nullable=True),
        *_audit_columns(),
    )
    op.create_index("ix_alerts_fund_id", "alerts", ["fund_id"])
    op.create_index("ix_alerts_access_level", "alerts", ["access_level"])
    op.create_index("ix_alerts_alert_type", "alerts", ["alert_type"])
    op.create_index("ix_alerts_severity", "alerts", ["severity"])
    op.create_index("ix_alerts_entity_type", "alerts", ["entity_type"])
    op.create_index("ix_alerts_entity_id", "alerts", ["entity_id"])
    op.create_index("ix_alerts_status", "alerts", ["status"])
    op.create_index("ix_alerts_fund_status", "alerts", ["fund_id", "status"])

    op.create_table(
        "portfolio_metrics",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("as_of", sa.Date(), nullable=False),
        sa.Column("metric_name", sa.String(length=120), nullable=False),
        sa.Column("metric_value", sa.Numeric(18, 6), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=True),
        *_audit_columns(),
    )
    op.create_index("ix_portfolio_metrics_fund_id", "portfolio_metrics", ["fund_id"])
    op.create_index("ix_portfolio_metrics_access_level", "portfolio_metrics", ["access_level"])
    op.create_index("ix_portfolio_metrics_as_of", "portfolio_metrics", ["as_of"])
    op.create_index("ix_portfolio_metrics_metric_name", "portfolio_metrics", ["metric_name"])

    # --- Deals
    op.create_table(
        "deals",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("borrower_name", sa.String(length=300), nullable=True),
        sa.Column("requested_amount", sa.Numeric(18, 2), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="USD"),
        sa.Column("stage", sa.String(length=64), nullable=False),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("rejection_reason_code", sa.String(length=64), nullable=True),
        sa.Column("rejection_rationale", sa.Text(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        *_audit_columns(),
    )
    op.create_index("ix_deals_fund_id", "deals", ["fund_id"])
    op.create_index("ix_deals_access_level", "deals", ["access_level"])
    op.create_index("ix_deals_title", "deals", ["title"])
    op.create_index("ix_deals_borrower_name", "deals", ["borrower_name"])
    op.create_index("ix_deals_stage", "deals", ["stage"])
    op.create_index("ix_deals_is_archived", "deals", ["is_archived"])
    op.create_index("ix_deals_rejection_reason_code", "deals", ["rejection_reason_code"])
    op.create_index("ix_deals_fund_stage", "deals", ["fund_id", "stage"])

    op.create_table(
        "deal_documents",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("deal_id", sa.Uuid(), sa.ForeignKey("deals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_type", sa.String(length=64), nullable=False),
        sa.Column("filename", sa.String(length=300), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="registered"),
        sa.Column("metadata", sa.JSON(), nullable=True),
        *_audit_columns(),
    )
    op.create_index("ix_deal_documents_fund_id", "deal_documents", ["fund_id"])
    op.create_index("ix_deal_documents_access_level", "deal_documents", ["access_level"])
    op.create_index("ix_deal_documents_deal_id", "deal_documents", ["deal_id"])
    op.create_index("ix_deal_documents_document_type", "deal_documents", ["document_type"])
    op.create_index("ix_deal_documents_status", "deal_documents", ["status"])

    op.create_table(
        "deal_stage_history",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("deal_id", sa.Uuid(), sa.ForeignKey("deals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("from_stage", sa.String(length=64), nullable=True),
        sa.Column("to_stage", sa.String(length=64), nullable=False),
        sa.Column("changed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=True),
        *_audit_columns(),
    )
    op.create_index("ix_deal_stage_history_fund_id", "deal_stage_history", ["fund_id"])
    op.create_index("ix_deal_stage_history_access_level", "deal_stage_history", ["access_level"])
    op.create_index("ix_deal_stage_history_deal_id", "deal_stage_history", ["deal_id"])
    op.create_index("ix_deal_stage_history_to_stage", "deal_stage_history", ["to_stage"])
    op.create_index("ix_deal_stage_history_changed_at", "deal_stage_history", ["changed_at"])

    op.create_table(
        "deal_decisions",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("deal_id", sa.Uuid(), sa.ForeignKey("deals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("outcome", sa.String(length=32), nullable=False),
        sa.Column("reason_code", sa.String(length=64), nullable=True),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        *_audit_columns(),
    )
    op.create_index("ix_deal_decisions_fund_id", "deal_decisions", ["fund_id"])
    op.create_index("ix_deal_decisions_access_level", "deal_decisions", ["access_level"])
    op.create_index("ix_deal_decisions_deal_id", "deal_decisions", ["deal_id"])
    op.create_index("ix_deal_decisions_outcome", "deal_decisions", ["outcome"])
    op.create_index("ix_deal_decisions_reason_code", "deal_decisions", ["reason_code"])
    op.create_index("ix_deal_decisions_decided_at", "deal_decisions", ["decided_at"])

    op.create_table(
        "qualification_rules",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("version", sa.String(length=32), nullable=False, server_default="v1"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("rule_config", sa.JSON(), nullable=False),
        *_audit_columns(),
    )
    op.create_index("ix_qualification_rules_fund_id", "qualification_rules", ["fund_id"])
    op.create_index("ix_qualification_rules_access_level", "qualification_rules", ["access_level"])
    op.create_index("ix_qualification_rules_name", "qualification_rules", ["name"])
    op.create_index("ix_qualification_rules_version", "qualification_rules", ["version"])
    op.create_index("ix_qualification_rules_is_active", "qualification_rules", ["is_active"])

    op.create_table(
        "qualification_results",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("deal_id", sa.Uuid(), sa.ForeignKey("deals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rule_id", sa.Uuid(), sa.ForeignKey("qualification_rules.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("result", sa.String(length=16), nullable=False),
        sa.Column("reasons", sa.JSON(), nullable=True),
        sa.Column("run_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        *_audit_columns(),
    )
    op.create_index("ix_qualification_results_fund_id", "qualification_results", ["fund_id"])
    op.create_index("ix_qualification_results_access_level", "qualification_results", ["access_level"])
    op.create_index("ix_qualification_results_deal_id", "qualification_results", ["deal_id"])
    op.create_index("ix_qualification_results_rule_id", "qualification_results", ["rule_id"])
    op.create_index("ix_qualification_results_result", "qualification_results", ["result"])
    op.create_index("ix_qualification_results_run_at", "qualification_results", ["run_at"])

    # --- Actions
    op.create_table(
        "actions",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("owner_actor_id", sa.String(length=200), nullable=True),
        sa.Column("data", sa.JSON(), nullable=True),
        *_audit_columns(),
    )
    op.create_index("ix_actions_fund_id", "actions", ["fund_id"])
    op.create_index("ix_actions_access_level", "actions", ["access_level"])
    op.create_index("ix_actions_title", "actions", ["title"])
    op.create_index("ix_actions_status", "actions", ["status"])
    op.create_index("ix_actions_due_date", "actions", ["due_date"])
    op.create_index("ix_actions_owner_actor_id", "actions", ["owner_actor_id"])
    op.create_index("ix_actions_fund_status", "actions", ["fund_id", "status"])

    op.create_table(
        "action_links",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("action_id", sa.Uuid(), sa.ForeignKey("actions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("entity_type", sa.String(length=64), nullable=False),
        sa.Column("entity_id", sa.String(length=200), nullable=False),
        *_audit_columns(),
    )
    op.create_index("ix_action_links_fund_id", "action_links", ["fund_id"])
    op.create_index("ix_action_links_access_level", "action_links", ["access_level"])
    op.create_index("ix_action_links_action_id", "action_links", ["action_id"])
    op.create_index("ix_action_links_entity_type", "action_links", ["entity_type"])
    op.create_index("ix_action_links_entity_id", "action_links", ["entity_id"])

    op.create_table(
        "action_evidence",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("action_id", sa.Uuid(), sa.ForeignKey("actions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("filename", sa.String(length=300), nullable=False),
        sa.Column("document_ref", sa.String(length=500), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending_review"),
        sa.Column("metadata", sa.JSON(), nullable=True),
        *_audit_columns(),
    )
    op.create_index("ix_action_evidence_fund_id", "action_evidence", ["fund_id"])
    op.create_index("ix_action_evidence_access_level", "action_evidence", ["access_level"])
    op.create_index("ix_action_evidence_action_id", "action_evidence", ["action_id"])
    op.create_index("ix_action_evidence_status", "action_evidence", ["status"])

    op.create_table(
        "action_comments",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("action_id", sa.Uuid(), sa.ForeignKey("actions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("comment", sa.Text(), nullable=False),
        sa.Column("author_actor_id", sa.String(length=200), nullable=False),
        sa.Column("commented_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        *_audit_columns(),
    )
    op.create_index("ix_action_comments_fund_id", "action_comments", ["fund_id"])
    op.create_index("ix_action_comments_access_level", "action_comments", ["access_level"])
    op.create_index("ix_action_comments_action_id", "action_comments", ["action_id"])
    op.create_index("ix_action_comments_author_actor_id", "action_comments", ["author_actor_id"])
    op.create_index("ix_action_comments_commented_at", "action_comments", ["commented_at"])

    op.create_table(
        "action_reviews",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("action_id", sa.Uuid(), sa.ForeignKey("actions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reviewer_actor_id", sa.String(length=200), nullable=False),
        sa.Column("decision", sa.String(length=32), nullable=False),
        sa.Column("comments", sa.Text(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        *_audit_columns(),
    )
    op.create_index("ix_action_reviews_fund_id", "action_reviews", ["fund_id"])
    op.create_index("ix_action_reviews_access_level", "action_reviews", ["access_level"])
    op.create_index("ix_action_reviews_action_id", "action_reviews", ["action_id"])
    op.create_index("ix_action_reviews_reviewer_actor_id", "action_reviews", ["reviewer_actor_id"])
    op.create_index("ix_action_reviews_decision", "action_reviews", ["decision"])
    op.create_index("ix_action_reviews_reviewed_at", "action_reviews", ["reviewed_at"])

    # --- Compliance foundations
    op.create_table(
        "obligations",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("regulator", sa.String(length=64), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        *_audit_columns(),
    )
    op.create_index("ix_obligations_fund_id", "obligations", ["fund_id"])
    op.create_index("ix_obligations_access_level", "obligations", ["access_level"])
    op.create_index("ix_obligations_name", "obligations", ["name"])
    op.create_index("ix_obligations_regulator", "obligations", ["regulator"])
    op.create_index("ix_obligations_is_active", "obligations", ["is_active"])

    op.create_table(
        "obligation_requirements",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("obligation_id", sa.Uuid(), sa.ForeignKey("obligations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("doc_type", sa.String(length=100), nullable=False),
        sa.Column("periodicity", sa.String(length=32), nullable=True),
        sa.Column("expiry_days", sa.Integer(), nullable=True),
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("metadata", sa.JSON(), nullable=True),
        *_audit_columns(),
    )
    op.create_index("ix_obligation_requirements_fund_id", "obligation_requirements", ["fund_id"])
    op.create_index("ix_obligation_requirements_access_level", "obligation_requirements", ["access_level"])
    op.create_index("ix_obligation_requirements_obligation_id", "obligation_requirements", ["obligation_id"])
    op.create_index("ix_obligation_requirements_doc_type", "obligation_requirements", ["doc_type"])

    op.create_table(
        "obligation_status",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("obligation_id", sa.Uuid(), sa.ForeignKey("obligations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("last_computed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("details", sa.JSON(), nullable=True),
        *_audit_columns(),
    )
    op.create_index("ix_obligation_status_fund_id", "obligation_status", ["fund_id"])
    op.create_index("ix_obligation_status_access_level", "obligation_status", ["access_level"])
    op.create_index("ix_obligation_status_obligation_id", "obligation_status", ["obligation_id"])
    op.create_index("ix_obligation_status_status", "obligation_status", ["status"])
    op.create_index("ix_obligation_status_last_computed_at", "obligation_status", ["last_computed_at"])
    op.create_index("ix_obligation_status_fund_obligation", "obligation_status", ["fund_id", "obligation_id"])

    # --- Documents registry
    op.create_table(
        "documents",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("document_type", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"),
        sa.Column("current_version", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("metadata", sa.JSON(), nullable=True),
        *_audit_columns(),
    )
    op.create_index("ix_documents_fund_id", "documents", ["fund_id"])
    op.create_index("ix_documents_access_level", "documents", ["access_level"])
    op.create_index("ix_documents_document_type", "documents", ["document_type"])
    op.create_index("ix_documents_title", "documents", ["title"])
    op.create_index("ix_documents_status", "documents", ["status"])
    op.create_index("ix_documents_fund_type", "documents", ["fund_id", "document_type"])

    op.create_table(
        "document_versions",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("document_id", sa.Uuid(), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("blob_uri", sa.String(length=800), nullable=True),
        sa.Column("checksum", sa.String(length=128), nullable=True),
        sa.Column("file_size_bytes", sa.Numeric(20, 0), nullable=True),
        sa.Column("is_final", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("metadata", sa.JSON(), nullable=True),
        *_audit_columns(),
    )
    op.create_index("ix_document_versions_fund_id", "document_versions", ["fund_id"])
    op.create_index("ix_document_versions_access_level", "document_versions", ["access_level"])
    op.create_index("ix_document_versions_document_id", "document_versions", ["document_id"])
    op.create_index("ix_document_versions_version_number", "document_versions", ["version_number"])
    op.create_index("ix_document_versions_is_final", "document_versions", ["is_final"])
    op.create_index(
        "ix_doc_versions_doc_ver",
        "document_versions",
        ["document_id", "version_number"],
        unique=True,
    )

    op.create_table(
        "document_access_policies",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("document_id", sa.Uuid(), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("rules", sa.JSON(), nullable=True),
        *_audit_columns(),
    )
    op.create_index("ix_document_access_policies_fund_id", "document_access_policies", ["fund_id"])
    op.create_index("ix_document_access_policies_access_level", "document_access_policies", ["access_level"])
    op.create_index("ix_document_access_policies_document_id", "document_access_policies", ["document_id"])
    op.create_index("ix_document_access_policies_role", "document_access_policies", ["role"])
    op.create_index("ix_document_access_policies_is_active", "document_access_policies", ["is_active"])

    # --- AI skeleton persistence
    op.create_table(
        "ai_queries",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("actor_id", sa.String(length=200), nullable=False),
        sa.Column("query_text", sa.Text(), nullable=False),
        sa.Column("request_id", sa.String(length=64), nullable=False),
        sa.Column("created_at_utc", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        *_audit_columns(),
    )
    op.create_index("ix_ai_queries_fund_id", "ai_queries", ["fund_id"])
    op.create_index("ix_ai_queries_access_level", "ai_queries", ["access_level"])
    op.create_index("ix_ai_queries_actor_id", "ai_queries", ["actor_id"])
    op.create_index("ix_ai_queries_request_id", "ai_queries", ["request_id"])
    op.create_index("ix_ai_queries_created_at_utc", "ai_queries", ["created_at_utc"])

    op.create_table(
        "ai_responses",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("query_id", sa.Uuid(), sa.ForeignKey("ai_queries.id", ondelete="CASCADE"), nullable=False),
        sa.Column("model_version", sa.String(length=80), nullable=False),
        sa.Column("prompt", sa.JSON(), nullable=False),
        sa.Column("retrieval_sources", sa.JSON(), nullable=True),
        sa.Column("citations", sa.JSON(), nullable=True),
        sa.Column("response_text", sa.Text(), nullable=True),
        sa.Column("created_at_utc", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        *_audit_columns(),
    )
    op.create_index("ix_ai_responses_fund_id", "ai_responses", ["fund_id"])
    op.create_index("ix_ai_responses_access_level", "ai_responses", ["access_level"])
    op.create_index("ix_ai_responses_query_id", "ai_responses", ["query_id"])
    op.create_index("ix_ai_responses_model_version", "ai_responses", ["model_version"])
    op.create_index("ix_ai_responses_created_at_utc", "ai_responses", ["created_at_utc"])
    op.create_index("ix_ai_responses_fund_query", "ai_responses", ["fund_id", "query_id"])


def downgrade() -> None:
    op.drop_index("ix_ai_responses_fund_query", table_name="ai_responses")
    op.drop_table("ai_responses")
    op.drop_table("ai_queries")
    op.drop_table("document_access_policies")
    op.drop_index("ix_doc_versions_doc_ver", table_name="document_versions")
    op.drop_table("document_versions")
    op.drop_index("ix_documents_fund_type", table_name="documents")
    op.drop_table("documents")
    op.drop_table("obligation_status")
    op.drop_table("obligation_requirements")
    op.drop_table("obligations")
    op.drop_table("action_reviews")
    op.drop_table("action_comments")
    op.drop_table("action_evidence")
    op.drop_table("action_links")
    op.drop_table("actions")
    op.drop_table("qualification_results")
    op.drop_table("qualification_rules")
    op.drop_table("deal_decisions")
    op.drop_table("deal_stage_history")
    op.drop_table("deal_documents")
    op.drop_table("deals")
    op.drop_table("portfolio_metrics")
    op.drop_table("alerts")
    op.drop_table("exposures")
    op.drop_table("covenant_breaches")
    op.drop_table("covenant_tests")
    op.drop_table("covenants")
    op.drop_table("cashflows")
    op.drop_table("loans")
    op.drop_table("borrowers")
    op.drop_table("audit_events")
    op.drop_table("user_fund_roles")
    op.drop_table("users")
    op.drop_table("funds")

