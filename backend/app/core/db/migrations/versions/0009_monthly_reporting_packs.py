import sqlalchemy as sa
from alembic import op

revision = "0009_monthly_reporting_packs"
down_revision = "0008_evidence_blob_governance"


def upgrade():
    op.create_table(
        "monthly_report_packs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("DRAFT", "GENERATED", "PUBLISHED", "ARCHIVED", name="report_pack_status_enum"),
            nullable=False,
            server_default="DRAFT",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False, server_default="Monthly Report Pack"),
    )
    op.create_index("ix_monthly_report_packs_fund_id", "monthly_report_packs", ["fund_id"])

    op.create_table(
        "report_pack_sections",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("report_pack_id", sa.Uuid(), nullable=False),
        sa.Column(
            "section_type",
            sa.Enum(
                "NAV_SUMMARY",
                "PORTFOLIO_EXPOSURE",
                "OBLIGATIONS",
                "ACTIONS",
                "BREACHES",
                name="report_section_type_enum",
            ),
            nullable=False,
        ),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["report_pack_id"], ["monthly_report_packs.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_report_pack_sections_report_pack_id", "report_pack_sections", ["report_pack_id"])

    # Evidence link to report packs
    op.add_column("evidence_documents", sa.Column("report_pack_id", sa.Uuid(), nullable=True))
    op.create_index("ix_evidence_documents_report_pack_id", "evidence_documents", ["report_pack_id"])


def downgrade():
    op.drop_index("ix_evidence_documents_report_pack_id", table_name="evidence_documents")
    op.drop_column("evidence_documents", "report_pack_id")

    op.drop_index("ix_report_pack_sections_report_pack_id", table_name="report_pack_sections")
    op.drop_table("report_pack_sections")

    op.drop_index("ix_monthly_report_packs_fund_id", table_name="monthly_report_packs")
    op.drop_table("monthly_report_packs")

    op.execute("DROP TYPE report_section_type_enum")
    op.execute("DROP TYPE report_pack_status_enum")

