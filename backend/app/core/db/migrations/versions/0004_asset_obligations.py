import sqlalchemy as sa
from alembic import op

revision = "0004_asset_obligations"
down_revision = "0003_fund_investments"


def upgrade():
    op.create_table(
        "asset_obligations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("asset_id", sa.Uuid(), nullable=False),
        sa.Column(
            "obligation_type",
            sa.Enum(
                "NAV_REPORT",
                "CAPITAL_CALL_NOTICE",
                "VALUATION_UPDATE",
                "COVENANT_TEST",
                name="obligation_type_enum",
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "OPEN",
                "PENDING_EVIDENCE",
                "SATISFIED",
                "OVERDUE",
                "WAIVED",
                name="obligation_status_enum",
            ),
            nullable=False,
            server_default="OPEN",
        ),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_index(
        "ix_asset_obligations_asset_id",
        "asset_obligations",
        ["asset_id"],
    )


def downgrade():
    op.drop_index("ix_asset_obligations_asset_id", table_name="asset_obligations")
    op.drop_table("asset_obligations")

    op.execute("DROP TYPE obligation_status_enum")
    op.execute("DROP TYPE obligation_type_enum")

