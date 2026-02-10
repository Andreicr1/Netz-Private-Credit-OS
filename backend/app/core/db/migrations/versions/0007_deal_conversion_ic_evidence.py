import sqlalchemy as sa
from alembic import op

revision = "0007_deal_conversion_ic_evidence"
down_revision = "0006_deals_intake"


def upgrade():
    # add asset_id column to deals
    op.add_column("deals", sa.Column("asset_id", sa.Uuid(), nullable=True))
    op.create_index("ix_deals_asset_id", "deals", ["asset_id"])

    # create ic_memos table
    op.create_table(
        "ic_memos",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("deal_id", sa.Uuid(), nullable=False),
        sa.Column("executive_summary", sa.Text(), nullable=False),
        sa.Column("risks", sa.Text(), nullable=True),
        sa.Column("mitigants", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ic_memos_deal_id", "ic_memos", ["deal_id"])

    # create evidence_documents table
    op.create_table(
        "evidence_documents",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("deal_id", sa.Uuid(), nullable=True),
        sa.Column("action_id", sa.Uuid(), nullable=True),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("blob_uri", sa.String(length=500), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_evidence_documents_fund_id", "evidence_documents", ["fund_id"])


def downgrade():
    op.drop_index("ix_evidence_documents_fund_id", table_name="evidence_documents")
    op.drop_table("evidence_documents")

    op.drop_index("ix_ic_memos_deal_id", table_name="ic_memos")
    op.drop_table("ic_memos")

    op.drop_index("ix_deals_asset_id", table_name="deals")
    op.drop_column("deals", "asset_id")

