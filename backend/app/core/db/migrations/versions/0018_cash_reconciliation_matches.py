"""Add reconciliation matches and reconciliation confirmation fields.

Revision ID: 0018_cash_reconciliation_matches
Revises: 0017_cash_transaction_value_date
Create Date: 2026-02-11
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0018_cash_reconciliation_matches"
down_revision = "0017_cash_transaction_value_date"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("cash_transactions", sa.Column("reconciled_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("cash_transactions", sa.Column("reconciled_by", sa.String(length=128), nullable=True))

    op.create_table(
        "reconciliation_matches",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
        sa.Column("bank_line_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("cash_transaction_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("matched_by", sa.String(length=128), nullable=False),
        sa.Column("matched_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["bank_line_id"], ["bank_statement_lines.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["cash_transaction_id"], ["cash_transactions.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("bank_line_id", name="uq_reconciliation_matches_bank_line"),
    )

    op.create_index(
        "ix_reconciliation_matches_fund_tx",
        "reconciliation_matches",
        ["fund_id", "cash_transaction_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_reconciliation_matches_fund_tx", table_name="reconciliation_matches")
    op.drop_table("reconciliation_matches")

    op.drop_column("cash_transactions", "reconciled_by")
    op.drop_column("cash_transactions", "reconciled_at")
