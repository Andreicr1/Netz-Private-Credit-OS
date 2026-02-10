"""Add value_date to cash_transactions.

Revision ID: 0017_cash_transaction_value_date
Revises: 0016_cash_management_expansion
Create Date: 2026-02-10
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0017_cash_transaction_value_date"
down_revision = "0016_cash_management_expansion"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("cash_transactions", sa.Column("value_date", sa.Date(), nullable=True))
    op.create_index("ix_cash_transactions_fund_value_date", "cash_transactions", ["fund_id", "value_date"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_cash_transactions_fund_value_date", table_name="cash_transactions")
    op.drop_column("cash_transactions", "value_date")
