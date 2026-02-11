"""EPIC 11 - NAV snapshots, asset valuations, investor statements, monthly pack metadata.

Adds:
- nav_snapshots (append-only monthly NAV records)
- asset_valuation_snapshots (evidence-backed valuations per NAV snapshot)
- investor_statements (v1 master statement export)
- Extends monthly_report_packs with nav_snapshot linkage + blob output metadata

Revision ID: 0019_nav_snapshots_and_investor_statements
Revises: 0018_cash_reconciliation_matches
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0019_nav_snapshots_and_investor_statements"
down_revision = "0018_cash_reconciliation_matches"


def upgrade() -> None:
    op.execute("CREATE TYPE nav_snapshot_status_enum AS ENUM ('DRAFT','FINALIZED','PUBLISHED');")
    op.execute(
        "CREATE TYPE valuation_method_enum AS ENUM ('AMORTIZED_COST','FAIR_VALUE','EXTERNAL_MARK','ADMIN_ESTIMATE');"
    )
    op.execute("CREATE TYPE monthly_pack_type_enum AS ENUM ('INVESTOR_REPORT','AUDITOR_PACK','ADMIN_PACKAGE');")

    op.create_table(
        "nav_snapshots",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("period_month", sa.String(length=7), nullable=False),
        sa.Column("nav_total_usd", sa.Numeric(20, 2), nullable=False),
        sa.Column("cash_balance_usd", sa.Numeric(20, 2), nullable=False),
        sa.Column("assets_value_usd", sa.Numeric(20, 2), nullable=False),
        sa.Column("liabilities_usd", sa.Numeric(20, 2), nullable=False),
        sa.Column(
            "status",
            sa.Enum("DRAFT", "FINALIZED", "PUBLISHED", name="nav_snapshot_status_enum"),
            nullable=False,
            server_default="DRAFT",
        ),
        sa.Column("finalized_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finalized_by", sa.String(length=128), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("published_by", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_nav_snapshots_fund_id", "nav_snapshots", ["fund_id"])
    op.create_index("ix_nav_snapshots_access_level", "nav_snapshots", ["access_level"])
    op.create_index("ix_nav_snapshots_period_month", "nav_snapshots", ["period_month"])
    op.create_index("ix_nav_snapshots_status", "nav_snapshots", ["status"])
    op.create_index("ix_nav_snapshots_fund_period", "nav_snapshots", ["fund_id", "period_month"])
    op.create_index("ix_nav_snapshots_fund_status", "nav_snapshots", ["fund_id", "status"])

    op.create_table(
        "asset_valuation_snapshots",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("nav_snapshot_id", sa.Uuid(), nullable=False),
        sa.Column("asset_id", sa.Uuid(), nullable=False),
        sa.Column("asset_type", sa.String(length=64), nullable=False),
        sa.Column("valuation_usd", sa.Numeric(20, 2), nullable=False),
        sa.Column(
            "valuation_method",
            sa.Enum(
                "AMORTIZED_COST",
                "FAIR_VALUE",
                "EXTERNAL_MARK",
                "ADMIN_ESTIMATE",
                name="valuation_method_enum",
            ),
            nullable=False,
        ),
        sa.Column("supporting_document_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
        sa.ForeignKeyConstraint(["nav_snapshot_id"], ["nav_snapshots.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["supporting_document_id"], ["documents.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_asset_valuation_snapshots_fund_id", "asset_valuation_snapshots", ["fund_id"])
    op.create_index("ix_asset_valuation_snapshots_access_level", "asset_valuation_snapshots", ["access_level"])
    op.create_index("ix_asset_valuation_snapshots_nav_snapshot_id", "asset_valuation_snapshots", ["nav_snapshot_id"])
    op.create_index("ix_asset_valuation_snapshots_asset_id", "asset_valuation_snapshots", ["asset_id"])
    op.create_index("ix_asset_valuation_snapshots_asset_type", "asset_valuation_snapshots", ["asset_type"])
    op.create_index("ix_asset_valuation_snapshots_valuation_method", "asset_valuation_snapshots", ["valuation_method"])
    op.create_index("ix_asset_valuation_snapshots_supporting_document_id", "asset_valuation_snapshots", ["supporting_document_id"])
    op.create_index(
        "ix_asset_valuation_snapshots_fund_nav",
        "asset_valuation_snapshots",
        ["fund_id", "nav_snapshot_id"],
    )
    op.create_index(
        "ix_asset_valuation_snapshots_nav_asset",
        "asset_valuation_snapshots",
        ["nav_snapshot_id", "asset_id"],
    )

    op.create_table(
        "investor_statements",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("investor_id", sa.Uuid(), nullable=True),
        sa.Column("period_month", sa.String(length=7), nullable=False),
        sa.Column("commitment", sa.Numeric(20, 2), nullable=False, server_default="0"),
        sa.Column("capital_called", sa.Numeric(20, 2), nullable=False, server_default="0"),
        sa.Column("distributions", sa.Numeric(20, 2), nullable=False, server_default="0"),
        sa.Column("ending_balance", sa.Numeric(20, 2), nullable=False, server_default="0"),
        sa.Column("blob_path", sa.String(length=800), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_investor_statements_fund_id", "investor_statements", ["fund_id"])
    op.create_index("ix_investor_statements_access_level", "investor_statements", ["access_level"])
    op.create_index("ix_investor_statements_investor_id", "investor_statements", ["investor_id"])
    op.create_index("ix_investor_statements_period_month", "investor_statements", ["period_month"])
    op.create_index("ix_investor_statements_fund_period", "investor_statements", ["fund_id", "period_month"])

    op.add_column("monthly_report_packs", sa.Column("nav_snapshot_id", sa.Uuid(), nullable=True))
    op.add_column("monthly_report_packs", sa.Column("blob_path", sa.String(length=800), nullable=True))
    op.add_column("monthly_report_packs", sa.Column("generated_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("monthly_report_packs", sa.Column("generated_by", sa.String(length=128), nullable=True))
    op.add_column(
        "monthly_report_packs",
        sa.Column(
            "pack_type",
            sa.Enum("INVESTOR_REPORT", "AUDITOR_PACK", "ADMIN_PACKAGE", name="monthly_pack_type_enum"),
            nullable=True,
        ),
    )
    op.create_index("ix_monthly_report_packs_nav_snapshot_id", "monthly_report_packs", ["nav_snapshot_id"])
    op.create_index("ix_monthly_report_packs_pack_type", "monthly_report_packs", ["pack_type"])
    op.create_index("ix_monthly_report_packs_generated_at", "monthly_report_packs", ["generated_at"])
    op.create_foreign_key(
        "fk_monthly_report_packs_nav_snapshot_id",
        "monthly_report_packs",
        "nav_snapshots",
        ["nav_snapshot_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_monthly_report_packs_nav_snapshot_id", "monthly_report_packs", type_="foreignkey")
    op.drop_index("ix_monthly_report_packs_generated_at", table_name="monthly_report_packs")
    op.drop_index("ix_monthly_report_packs_pack_type", table_name="monthly_report_packs")
    op.drop_index("ix_monthly_report_packs_nav_snapshot_id", table_name="monthly_report_packs")
    op.drop_column("monthly_report_packs", "pack_type")
    op.drop_column("monthly_report_packs", "generated_by")
    op.drop_column("monthly_report_packs", "generated_at")
    op.drop_column("monthly_report_packs", "blob_path")
    op.drop_column("monthly_report_packs", "nav_snapshot_id")

    op.drop_index("ix_investor_statements_fund_period", table_name="investor_statements")
    op.drop_index("ix_investor_statements_period_month", table_name="investor_statements")
    op.drop_index("ix_investor_statements_investor_id", table_name="investor_statements")
    op.drop_index("ix_investor_statements_access_level", table_name="investor_statements")
    op.drop_index("ix_investor_statements_fund_id", table_name="investor_statements")
    op.drop_table("investor_statements")

    op.drop_index("ix_asset_valuation_snapshots_nav_asset", table_name="asset_valuation_snapshots")
    op.drop_index("ix_asset_valuation_snapshots_fund_nav", table_name="asset_valuation_snapshots")
    op.drop_index("ix_asset_valuation_snapshots_supporting_document_id", table_name="asset_valuation_snapshots")
    op.drop_index("ix_asset_valuation_snapshots_valuation_method", table_name="asset_valuation_snapshots")
    op.drop_index("ix_asset_valuation_snapshots_asset_type", table_name="asset_valuation_snapshots")
    op.drop_index("ix_asset_valuation_snapshots_asset_id", table_name="asset_valuation_snapshots")
    op.drop_index("ix_asset_valuation_snapshots_nav_snapshot_id", table_name="asset_valuation_snapshots")
    op.drop_index("ix_asset_valuation_snapshots_access_level", table_name="asset_valuation_snapshots")
    op.drop_index("ix_asset_valuation_snapshots_fund_id", table_name="asset_valuation_snapshots")
    op.drop_table("asset_valuation_snapshots")

    op.drop_index("ix_nav_snapshots_fund_status", table_name="nav_snapshots")
    op.drop_index("ix_nav_snapshots_fund_period", table_name="nav_snapshots")
    op.drop_index("ix_nav_snapshots_status", table_name="nav_snapshots")
    op.drop_index("ix_nav_snapshots_period_month", table_name="nav_snapshots")
    op.drop_index("ix_nav_snapshots_access_level", table_name="nav_snapshots")
    op.drop_index("ix_nav_snapshots_fund_id", table_name="nav_snapshots")
    op.drop_table("nav_snapshots")

    op.execute("DROP TYPE monthly_pack_type_enum")
    op.execute("DROP TYPE valuation_method_enum")
    op.execute("DROP TYPE nav_snapshot_status_enum")
