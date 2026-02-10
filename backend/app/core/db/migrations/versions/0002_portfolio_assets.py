"""portfolio assets (canonical)

Revision ID: 0002_portfolio_assets
Revises: 0001_initial
Create Date: 2026-02-07
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0002_portfolio_assets"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "portfolio_assets",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column(
            "asset_type",
            sa.Enum("DIRECT_LOAN", "FUND_INVESTMENT", name="asset_type_enum"),
            nullable=False,
        ),
        sa.Column(
            "strategy",
            sa.Enum("CORE_DIRECT_LENDING", name="strategy_enum"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_portfolio_assets_fund_id", "portfolio_assets", ["fund_id"])
    op.create_index("ix_portfolio_assets_access_level", "portfolio_assets", ["access_level"])
    op.create_index("ix_portfolio_assets_asset_type", "portfolio_assets", ["asset_type"])
    op.create_index("ix_portfolio_assets_strategy", "portfolio_assets", ["strategy"])
    op.create_index("ix_portfolio_assets_name", "portfolio_assets", ["name"])


def downgrade() -> None:
    op.drop_table("portfolio_assets")
    op.execute("DROP TYPE asset_type_enum")
    op.execute("DROP TYPE strategy_enum")

