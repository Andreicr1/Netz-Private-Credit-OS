import sqlalchemy as sa
from alembic import op

revision = "0006_deals_intake"
down_revision = "0005_alerts_actions"


def upgrade():
    # --- Rename legacy pipeline tables to avoid collisions with domain `deals`
    op.rename_table("deals", "pipeline_deals")
    op.rename_table("deal_documents", "pipeline_deal_documents")
    op.rename_table("deal_stage_history", "pipeline_deal_stage_history")
    op.rename_table("deal_decisions", "pipeline_deal_decisions")
    op.rename_table("qualification_rules", "pipeline_qualification_rules")
    op.rename_table("qualification_results", "pipeline_qualification_results")

    # Rename legacy indexes that would collide with new domain indexes
    op.execute("ALTER INDEX ix_deals_fund_id RENAME TO ix_pipeline_deals_fund_id")
    op.execute("ALTER INDEX ix_deals_access_level RENAME TO ix_pipeline_deals_access_level")
    op.execute("ALTER INDEX ix_deals_title RENAME TO ix_pipeline_deals_title")
    op.execute("ALTER INDEX ix_deals_borrower_name RENAME TO ix_pipeline_deals_borrower_name")
    op.execute("ALTER INDEX ix_deals_stage RENAME TO ix_pipeline_deals_stage")
    op.execute("ALTER INDEX ix_deals_is_archived RENAME TO ix_pipeline_deals_is_archived")
    op.execute("ALTER INDEX ix_deals_rejection_reason_code RENAME TO ix_pipeline_deals_rejection_reason_code")
    op.execute("ALTER INDEX ix_deals_fund_stage RENAME TO ix_pipeline_deals_fund_stage")

    op.execute("ALTER INDEX ix_deal_documents_fund_id RENAME TO ix_pipeline_deal_documents_fund_id")
    op.execute("ALTER INDEX ix_deal_documents_access_level RENAME TO ix_pipeline_deal_documents_access_level")
    op.execute("ALTER INDEX ix_deal_documents_deal_id RENAME TO ix_pipeline_deal_documents_deal_id")
    op.execute("ALTER INDEX ix_deal_documents_document_type RENAME TO ix_pipeline_deal_documents_document_type")
    op.execute("ALTER INDEX ix_deal_documents_status RENAME TO ix_pipeline_deal_documents_status")

    op.execute("ALTER INDEX ix_deal_stage_history_fund_id RENAME TO ix_pipeline_deal_stage_history_fund_id")
    op.execute("ALTER INDEX ix_deal_stage_history_access_level RENAME TO ix_pipeline_deal_stage_history_access_level")
    op.execute("ALTER INDEX ix_deal_stage_history_deal_id RENAME TO ix_pipeline_deal_stage_history_deal_id")
    op.execute("ALTER INDEX ix_deal_stage_history_to_stage RENAME TO ix_pipeline_deal_stage_history_to_stage")
    op.execute("ALTER INDEX ix_deal_stage_history_changed_at RENAME TO ix_pipeline_deal_stage_history_changed_at")

    op.execute("ALTER INDEX ix_deal_decisions_fund_id RENAME TO ix_pipeline_deal_decisions_fund_id")
    op.execute("ALTER INDEX ix_deal_decisions_access_level RENAME TO ix_pipeline_deal_decisions_access_level")
    op.execute("ALTER INDEX ix_deal_decisions_deal_id RENAME TO ix_pipeline_deal_decisions_deal_id")
    op.execute("ALTER INDEX ix_deal_decisions_outcome RENAME TO ix_pipeline_deal_decisions_outcome")
    op.execute("ALTER INDEX ix_deal_decisions_reason_code RENAME TO ix_pipeline_deal_decisions_reason_code")
    op.execute("ALTER INDEX ix_deal_decisions_decided_at RENAME TO ix_pipeline_deal_decisions_decided_at")

    op.execute("ALTER INDEX ix_qualification_rules_fund_id RENAME TO ix_pipeline_qualification_rules_fund_id")
    op.execute("ALTER INDEX ix_qualification_rules_access_level RENAME TO ix_pipeline_qualification_rules_access_level")
    op.execute("ALTER INDEX ix_qualification_rules_name RENAME TO ix_pipeline_qualification_rules_name")
    op.execute("ALTER INDEX ix_qualification_rules_version RENAME TO ix_pipeline_qualification_rules_version")
    op.execute("ALTER INDEX ix_qualification_rules_is_active RENAME TO ix_pipeline_qualification_rules_is_active")

    op.execute("ALTER INDEX ix_qualification_results_fund_id RENAME TO ix_pipeline_qualification_results_fund_id")
    op.execute("ALTER INDEX ix_qualification_results_access_level RENAME TO ix_pipeline_qualification_results_access_level")
    op.execute("ALTER INDEX ix_qualification_results_deal_id RENAME TO ix_pipeline_qualification_results_deal_id")
    op.execute("ALTER INDEX ix_qualification_results_rule_id RENAME TO ix_pipeline_qualification_results_rule_id")
    op.execute("ALTER INDEX ix_qualification_results_result RENAME TO ix_pipeline_qualification_results_result")
    op.execute("ALTER INDEX ix_qualification_results_run_at RENAME TO ix_pipeline_qualification_results_run_at")

    # --- Create EPIC 5 domain tables
    op.create_table(
        "deals",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column(
            "deal_type",
            sa.Enum("DIRECT_LOAN", "FUND_INVESTMENT", "EQUITY_STAKE", "SPV_NOTE", name="deal_type_enum"),
            nullable=False,
        ),
        sa.Column(
            "stage",
            sa.Enum("INTAKE", "QUALIFIED", "IC_REVIEW", "APPROVED", "REJECTED", "CLOSED", name="deal_stage_enum"),
            nullable=False,
            server_default="INTAKE",
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("sponsor_name", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "rejection_code",
            sa.Enum(
                "OUT_OF_MANDATE",
                "TICKET_TOO_SMALL",
                "JURISDICTION_EXCLUDED",
                "INSUFFICIENT_RETURN",
                "WEAK_CREDIT_PROFILE",
                "NO_COLLATERAL",
                name="rejection_code_enum",
            ),
            nullable=True,
        ),
        sa.Column("rejection_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_deals_fund_id", "deals", ["fund_id"])

    op.create_table(
        "deal_qualifications",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("deal_id", sa.Uuid(), nullable=False),
        sa.Column("passed", sa.Boolean(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_deal_qualifications_deal_id", "deal_qualifications", ["deal_id"])


def downgrade():
    op.drop_index("ix_deal_qualifications_deal_id", table_name="deal_qualifications")
    op.drop_table("deal_qualifications")
    op.drop_index("ix_deals_fund_id", table_name="deals")
    op.drop_table("deals")

    op.execute("DROP TYPE rejection_code_enum")
    op.execute("DROP TYPE deal_stage_enum")
    op.execute("DROP TYPE deal_type_enum")

    # Index renames back (best-effort)
    op.execute("ALTER INDEX ix_pipeline_qualification_results_run_at RENAME TO ix_qualification_results_run_at")
    op.execute("ALTER INDEX ix_pipeline_qualification_results_result RENAME TO ix_qualification_results_result")
    op.execute("ALTER INDEX ix_pipeline_qualification_results_rule_id RENAME TO ix_qualification_results_rule_id")
    op.execute("ALTER INDEX ix_pipeline_qualification_results_deal_id RENAME TO ix_qualification_results_deal_id")
    op.execute("ALTER INDEX ix_pipeline_qualification_results_access_level RENAME TO ix_qualification_results_access_level")
    op.execute("ALTER INDEX ix_pipeline_qualification_results_fund_id RENAME TO ix_qualification_results_fund_id")

    op.execute("ALTER INDEX ix_pipeline_qualification_rules_is_active RENAME TO ix_qualification_rules_is_active")
    op.execute("ALTER INDEX ix_pipeline_qualification_rules_version RENAME TO ix_qualification_rules_version")
    op.execute("ALTER INDEX ix_pipeline_qualification_rules_name RENAME TO ix_qualification_rules_name")
    op.execute("ALTER INDEX ix_pipeline_qualification_rules_access_level RENAME TO ix_qualification_rules_access_level")
    op.execute("ALTER INDEX ix_pipeline_qualification_rules_fund_id RENAME TO ix_qualification_rules_fund_id")

    op.execute("ALTER INDEX ix_pipeline_deal_decisions_decided_at RENAME TO ix_deal_decisions_decided_at")
    op.execute("ALTER INDEX ix_pipeline_deal_decisions_reason_code RENAME TO ix_deal_decisions_reason_code")
    op.execute("ALTER INDEX ix_pipeline_deal_decisions_outcome RENAME TO ix_deal_decisions_outcome")
    op.execute("ALTER INDEX ix_pipeline_deal_decisions_deal_id RENAME TO ix_deal_decisions_deal_id")
    op.execute("ALTER INDEX ix_pipeline_deal_decisions_access_level RENAME TO ix_deal_decisions_access_level")
    op.execute("ALTER INDEX ix_pipeline_deal_decisions_fund_id RENAME TO ix_deal_decisions_fund_id")

    op.execute("ALTER INDEX ix_pipeline_deal_stage_history_changed_at RENAME TO ix_deal_stage_history_changed_at")
    op.execute("ALTER INDEX ix_pipeline_deal_stage_history_to_stage RENAME TO ix_deal_stage_history_to_stage")
    op.execute("ALTER INDEX ix_pipeline_deal_stage_history_deal_id RENAME TO ix_deal_stage_history_deal_id")
    op.execute("ALTER INDEX ix_pipeline_deal_stage_history_access_level RENAME TO ix_deal_stage_history_access_level")
    op.execute("ALTER INDEX ix_pipeline_deal_stage_history_fund_id RENAME TO ix_deal_stage_history_fund_id")

    op.execute("ALTER INDEX ix_pipeline_deal_documents_status RENAME TO ix_deal_documents_status")
    op.execute("ALTER INDEX ix_pipeline_deal_documents_document_type RENAME TO ix_deal_documents_document_type")
    op.execute("ALTER INDEX ix_pipeline_deal_documents_deal_id RENAME TO ix_deal_documents_deal_id")
    op.execute("ALTER INDEX ix_pipeline_deal_documents_access_level RENAME TO ix_deal_documents_access_level")
    op.execute("ALTER INDEX ix_pipeline_deal_documents_fund_id RENAME TO ix_deal_documents_fund_id")

    op.execute("ALTER INDEX ix_pipeline_deals_fund_stage RENAME TO ix_deals_fund_stage")
    op.execute("ALTER INDEX ix_pipeline_deals_rejection_reason_code RENAME TO ix_deals_rejection_reason_code")
    op.execute("ALTER INDEX ix_pipeline_deals_is_archived RENAME TO ix_deals_is_archived")
    op.execute("ALTER INDEX ix_pipeline_deals_stage RENAME TO ix_deals_stage")
    op.execute("ALTER INDEX ix_pipeline_deals_borrower_name RENAME TO ix_deals_borrower_name")
    op.execute("ALTER INDEX ix_pipeline_deals_title RENAME TO ix_deals_title")
    op.execute("ALTER INDEX ix_pipeline_deals_access_level RENAME TO ix_deals_access_level")
    op.execute("ALTER INDEX ix_pipeline_deals_fund_id RENAME TO ix_deals_fund_id")

    op.rename_table("pipeline_qualification_results", "qualification_results")
    op.rename_table("pipeline_qualification_rules", "qualification_rules")
    op.rename_table("pipeline_deal_decisions", "deal_decisions")
    op.rename_table("pipeline_deal_stage_history", "deal_stage_history")
    op.rename_table("pipeline_deal_documents", "deal_documents")
    op.rename_table("pipeline_deals", "deals")

