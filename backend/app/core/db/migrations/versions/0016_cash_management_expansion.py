"""Cash Management expansion - bank statements and reconciliation.

This migration adds:
- FundCashAccount table (canonical fund bank account)
- BankStatementUpload table (statement registry)
- BankStatementLine table (statement ledger for reconciliation)
- direction and reference_code fields to cash_transactions
- New enums: CashTransactionDirection, ReconciliationStatus
- Expanded CashTransactionType enum with new types

Revision ID: 0016_cash_management_expansion
Revises: 0015_ai_answers_audit
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0016_cash_management_expansion"
down_revision = "0015_ai_answers_audit"


def upgrade() -> None:
    # Create new enums
    op.execute(
        """
        CREATE TYPE cash_direction_enum AS ENUM ('INFLOW', 'OUTFLOW');
        """
    )
    
    op.execute(
        """
        CREATE TYPE reconciliation_status_enum AS ENUM ('UNMATCHED', 'MATCHED', 'DISCREPANCY');
        """
    )
    
    # Expand existing cash_tx_type_enum
    op.execute(
        """
        ALTER TYPE cash_tx_type_enum ADD VALUE IF NOT EXISTS 'LP_SUBSCRIPTION';
        ALTER TYPE cash_tx_type_enum ADD VALUE IF NOT EXISTS 'CAPITAL_CALL';
        ALTER TYPE cash_tx_type_enum ADD VALUE IF NOT EXISTS 'FUND_EXPENSE';
        ALTER TYPE cash_tx_type_enum ADD VALUE IF NOT EXISTS 'TRANSFER_INTERNAL';
        ALTER TYPE cash_tx_type_enum ADD VALUE IF NOT EXISTS 'BANK_FEE';
        ALTER TYPE cash_tx_type_enum ADD VALUE IF NOT EXISTS 'OTHER';
        """
    )
    
    # Create FundCashAccount table
    op.create_table(
        "fund_cash_accounts",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("bank_name", sa.String(length=200), nullable=False, server_default="Fund Bank Cayman"),
        sa.Column("administrator_name", sa.String(length=200), nullable=False, server_default="Zedra"),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="USD"),
        sa.Column("account_number", sa.String(length=100), nullable=True),
        sa.Column("swift_code", sa.String(length=32), nullable=True),
        sa.Column("notes", sa.String(length=1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
        sa.CheckConstraint("currency = 'USD'", name="ck_fund_cash_accounts_usd_only"),
    )
    op.create_index("ix_fund_cash_accounts_fund_id", "fund_cash_accounts", ["fund_id"])
    op.create_index("ix_fund_cash_accounts_access_level", "fund_cash_accounts", ["access_level"])
    op.create_index("ix_fund_cash_accounts_fund", "fund_cash_accounts", ["fund_id"], unique=True)
    
    # Create BankStatementUpload table
    op.create_table(
        "bank_statement_uploads",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("uploaded_by", sa.String(length=128), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("blob_path", sa.String(length=800), nullable=False),
        sa.Column("original_filename", sa.String(length=512), nullable=True),
        sa.Column("sha256", sa.String(length=64), nullable=True),
        sa.Column("notes", sa.String(length=2000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_bank_statement_uploads_fund_id", "bank_statement_uploads", ["fund_id"])
    op.create_index("ix_bank_statement_uploads_access_level", "bank_statement_uploads", ["access_level"])
    op.create_index("ix_bank_statements_fund_period", "bank_statement_uploads", ["fund_id", "period_start", "period_end"])
    
    # Create BankStatementLine table
    op.create_table(
        "bank_statement_lines",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("statement_id", sa.Uuid(), nullable=False),
        sa.Column("value_date", sa.Date(), nullable=False),
        sa.Column("description", sa.String(length=1000), nullable=False),
        sa.Column("amount_usd", sa.Numeric(20, 2), nullable=False),
        sa.Column("direction", sa.Enum("INFLOW", "OUTFLOW", name="cash_direction_enum"), nullable=False),
        sa.Column("matched_transaction_id", sa.Uuid(), nullable=True),
        sa.Column(
            "reconciliation_status",
            sa.Enum("UNMATCHED", "MATCHED", "DISCREPANCY", name="reconciliation_status_enum"),
            nullable=False,
            server_default="UNMATCHED",
        ),
        sa.Column("reconciled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reconciled_by", sa.String(length=128), nullable=True),
        sa.Column("reconciliation_notes", sa.String(length=2000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
        sa.ForeignKeyConstraint(["statement_id"], ["bank_statement_uploads.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["matched_transaction_id"], ["cash_transactions.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_bank_statement_lines_fund_id", "bank_statement_lines", ["fund_id"])
    op.create_index("ix_bank_statement_lines_access_level", "bank_statement_lines", ["access_level"])
    op.create_index("ix_bank_statement_lines_statement_id", "bank_statement_lines", ["statement_id"])
    op.create_index("ix_bank_statement_lines_matched_transaction_id", "bank_statement_lines", ["matched_transaction_id"])
    op.create_index("ix_bank_statement_lines_reconciliation_status", "bank_statement_lines", ["reconciliation_status"])
    op.create_index("ix_bank_lines_statement_date", "bank_statement_lines", ["statement_id", "value_date"])
    op.create_index("ix_bank_lines_reconciliation", "bank_statement_lines", ["reconciliation_status", "matched_transaction_id"])
    
    # Add new columns to cash_transactions
    op.add_column("cash_transactions", sa.Column("direction", sa.Enum("INFLOW", "OUTFLOW", name="cash_direction_enum"), nullable=True))
    op.add_column("cash_transactions", sa.Column("reference_code", sa.String(length=64), nullable=True))
    
    # Set default direction based on type (for existing records)
    op.execute(
        """
        UPDATE cash_transactions
        SET direction = CASE
            WHEN type IN ('LP_SUBSCRIPTION', 'CAPITAL_CALL') THEN 'INFLOW'::cash_direction_enum
            ELSE 'OUTFLOW'::cash_direction_enum
        END
        WHERE direction IS NULL;
        """
    )
    
    # Make direction NOT NULL after setting defaults
    op.alter_column("cash_transactions", "direction", nullable=False)
    
    # Create index on reference_code
    op.create_index("ix_cash_transactions_reference_code", "cash_transactions", ["reference_code"], unique=True)


def downgrade() -> None:
    # Drop indexes
    op.drop_index("ix_cash_transactions_reference_code", table_name="cash_transactions")
    op.drop_index("ix_bank_lines_reconciliation", table_name="bank_statement_lines")
    op.drop_index("ix_bank_lines_statement_date", table_name="bank_statement_lines")
    op.drop_index("ix_bank_statement_lines_reconciliation_status", table_name="bank_statement_lines")
    op.drop_index("ix_bank_statement_lines_matched_transaction_id", table_name="bank_statement_lines")
    op.drop_index("ix_bank_statement_lines_statement_id", table_name="bank_statement_lines")
    op.drop_index("ix_bank_statement_lines_access_level", table_name="bank_statement_lines")
    op.drop_index("ix_bank_statement_lines_fund_id", table_name="bank_statement_lines")
    op.drop_index("ix_bank_statements_fund_period", table_name="bank_statement_uploads")
    op.drop_index("ix_bank_statement_uploads_access_level", table_name="bank_statement_uploads")
    op.drop_index("ix_bank_statement_uploads_fund_id", table_name="bank_statement_uploads")
    op.drop_index("ix_fund_cash_accounts_fund", table_name="fund_cash_accounts")
    op.drop_index("ix_fund_cash_accounts_access_level", table_name="fund_cash_accounts")
    op.drop_index("ix_fund_cash_accounts_fund_id", table_name="fund_cash_accounts")
    
    # Drop new columns from cash_transactions
    op.drop_column("cash_transactions", "reference_code")
    op.drop_column("cash_transactions", "direction")
    
    # Drop tables
    op.drop_table("bank_statement_lines")
    op.drop_table("bank_statement_uploads")
    op.drop_table("fund_cash_accounts")
    
    # Drop enums
    op.execute("DROP TYPE IF EXISTS reconciliation_status_enum")
    op.execute("DROP TYPE IF EXISTS cash_direction_enum")
    
    # Note: Cannot remove values from existing enum, would require full enum replacement
    # New CashTransactionType values will remain in the enum
