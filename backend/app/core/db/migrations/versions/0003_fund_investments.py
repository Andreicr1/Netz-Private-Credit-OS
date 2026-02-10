import sqlalchemy as sa
from alembic import op

revision = "0003_fund_investments"
down_revision = "0002_portfolio_assets"


def upgrade():
    op.create_table(
        "fund_investments",
        sa.Column("asset_id", sa.Uuid(), sa.ForeignKey("portfolio_assets.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("manager_name", sa.String(length=255), nullable=False),
        sa.Column("underlying_fund_name", sa.String(length=255), nullable=False),
        sa.Column(
            "reporting_frequency",
            sa.Enum(
                "MONTHLY",
                "QUARTERLY",
                "SEMI_ANNUAL",
                "ANNUAL",
                name="reporting_frequency_enum",
            ),
            nullable=False,
        ),
        sa.Column("nav_source", sa.String(length=255)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade():
    op.drop_table("fund_investments")
    op.execute("DROP TYPE reporting_frequency_enum")

