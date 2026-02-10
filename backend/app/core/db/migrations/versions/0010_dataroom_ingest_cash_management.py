import sqlalchemy as sa
from alembic import op

revision = "0010_dataroom_ingest_cash_management"
down_revision = "0009_monthly_reporting_packs"


def upgrade():
    # --- Extend documents registry for dataroom ingest
    op.add_column("documents", sa.Column("source", sa.String(length=32), nullable=True))
    op.add_column("documents", sa.Column("blob_uri", sa.String(length=800), nullable=True))
    op.add_column("documents", sa.Column("content_type", sa.String(length=200), nullable=True))
    op.add_column("documents", sa.Column("original_filename", sa.String(length=512), nullable=True))
    op.add_column("documents", sa.Column("sha256", sa.String(length=64), nullable=True))
    op.create_index("ix_documents_source", "documents", ["source"])
    op.create_index("ix_documents_sha256", "documents", ["sha256"])
    op.create_unique_constraint("uq_documents_fund_source_sha256", "documents", ["fund_id", "source", "sha256"])

    op.add_column("document_versions", sa.Column("content_type", sa.String(length=200), nullable=True))
    op.add_column("document_versions", sa.Column("extracted_text_blob_uri", sa.String(length=800), nullable=True))
    op.add_column(
        "document_versions",
        sa.Column("ingest_status", sa.String(length=32), nullable=False, server_default="PENDING"),
    )
    op.add_column("document_versions", sa.Column("indexed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("document_versions", sa.Column("ingest_error", sa.JSON(), nullable=True))
    op.create_index("ix_document_versions_ingest_status", "document_versions", ["ingest_status"])

    # --- Cash Management (USD-only)
    op.create_table(
        "cash_accounts",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="USD"),
        sa.Column("bank_name", sa.String(length=200), nullable=True),
        sa.Column("account_ref", sa.String(length=200), nullable=True),
        sa.Column("notes", sa.String(length=1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
        sa.CheckConstraint("currency = 'USD'", name="ck_cash_accounts_usd_only"),
    )
    op.create_index("ix_cash_accounts_fund_id", "cash_accounts", ["fund_id"])
    op.create_index("ix_cash_accounts_access_level", "cash_accounts", ["access_level"])
    op.create_index("ix_cash_accounts_fund_currency", "cash_accounts", ["fund_id", "currency"])

    op.create_table(
        "cash_transactions",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("type", sa.Enum("EXPENSE", "INVESTMENT", "CASH_MANAGEMENT", name="cash_tx_type_enum"), nullable=False),
        sa.Column("amount", sa.Numeric(20, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="USD"),
        sa.Column(
            "status",
            sa.Enum(
                "DRAFT",
                "PENDING_APPROVAL",
                "APPROVED",
                "SENT_TO_ADMIN",
                "EXECUTED",
                "REJECTED",
                "CANCELLED",
                name="cash_tx_status_enum",
            ),
            nullable=False,
            server_default="DRAFT",
        ),
        sa.Column("beneficiary_name", sa.String(length=255), nullable=True),
        sa.Column("beneficiary_bank", sa.String(length=255), nullable=True),
        sa.Column("beneficiary_account", sa.String(length=255), nullable=True),
        sa.Column("intermediary_bank", sa.String(length=255), nullable=True),
        sa.Column("intermediary_swift", sa.String(length=32), nullable=True),
        sa.Column("beneficiary_swift", sa.String(length=32), nullable=True),
        sa.Column("payment_reference", sa.String(length=255), nullable=True),
        sa.Column("justification_text", sa.String(length=4000), nullable=True),
        sa.Column("policy_basis", sa.JSON(), nullable=True),
        sa.Column("investment_memo_document_id", sa.Uuid(), nullable=True),
        sa.Column("ic_approvals_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ic_approval_evidence", sa.JSON(), nullable=True),
        sa.Column("sent_to_admin_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("admin_contact", sa.String(length=255), nullable=True),
        sa.Column("execution_confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("bank_reference", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.String(length=4000), nullable=True),
        sa.Column("instructions_blob_uri", sa.String(length=800), nullable=True),
        sa.Column("evidence_bundle_blob_uri", sa.String(length=800), nullable=True),
        sa.Column("evidence_bundle_sha256", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
        sa.CheckConstraint("currency = 'USD'", name="ck_cash_transactions_usd_only"),
        sa.ForeignKeyConstraint(["investment_memo_document_id"], ["documents.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_cash_transactions_fund_id", "cash_transactions", ["fund_id"])
    op.create_index("ix_cash_transactions_access_level", "cash_transactions", ["access_level"])
    op.create_index("ix_cash_transactions_status", "cash_transactions", ["status"])
    op.create_index("ix_cash_transactions_fund_status", "cash_transactions", ["fund_id", "status"])

    op.create_table(
        "cash_transaction_approvals",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("transaction_id", sa.Uuid(), nullable=False),
        sa.Column("approver_role", sa.String(length=32), nullable=False),
        sa.Column("approver_name", sa.String(length=255), nullable=False),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("evidence_blob_uri", sa.String(length=800), nullable=True),
        sa.Column("comment", sa.String(length=2000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
        sa.ForeignKeyConstraint(["transaction_id"], ["cash_transactions.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_cash_transaction_approvals_fund_id", "cash_transaction_approvals", ["fund_id"])
    op.create_index("ix_cash_transaction_approvals_access_level", "cash_transaction_approvals", ["access_level"])
    op.create_index("ix_cash_transaction_approvals_transaction_id", "cash_transaction_approvals", ["transaction_id"])
    op.create_index("ix_cash_approvals_tx_role", "cash_transaction_approvals", ["transaction_id", "approver_role"])


def downgrade():
    op.drop_index("ix_cash_approvals_tx_role", table_name="cash_transaction_approvals")
    op.drop_index("ix_cash_transaction_approvals_transaction_id", table_name="cash_transaction_approvals")
    op.drop_index("ix_cash_transaction_approvals_access_level", table_name="cash_transaction_approvals")
    op.drop_index("ix_cash_transaction_approvals_fund_id", table_name="cash_transaction_approvals")
    op.drop_table("cash_transaction_approvals")

    op.drop_index("ix_cash_transactions_fund_status", table_name="cash_transactions")
    op.drop_index("ix_cash_transactions_status", table_name="cash_transactions")
    op.drop_index("ix_cash_transactions_access_level", table_name="cash_transactions")
    op.drop_index("ix_cash_transactions_fund_id", table_name="cash_transactions")
    op.drop_table("cash_transactions")

    op.drop_index("ix_cash_accounts_fund_currency", table_name="cash_accounts")
    op.drop_index("ix_cash_accounts_access_level", table_name="cash_accounts")
    op.drop_index("ix_cash_accounts_fund_id", table_name="cash_accounts")
    op.drop_table("cash_accounts")

    op.drop_index("ix_document_versions_ingest_status", table_name="document_versions")
    op.drop_column("document_versions", "ingest_error")
    op.drop_column("document_versions", "indexed_at")
    op.drop_column("document_versions", "ingest_status")
    op.drop_column("document_versions", "extracted_text_blob_uri")
    op.drop_column("document_versions", "content_type")

    op.drop_constraint("uq_documents_fund_source_sha256", "documents", type_="unique")
    op.drop_index("ix_documents_sha256", table_name="documents")
    op.drop_index("ix_documents_source", table_name="documents")
    op.drop_column("documents", "sha256")
    op.drop_column("documents", "original_filename")
    op.drop_column("documents", "content_type")
    op.drop_column("documents", "blob_uri")
    op.drop_column("documents", "source")

    op.execute("DROP TYPE cash_tx_status_enum")
    op.execute("DROP TYPE cash_tx_type_enum")

