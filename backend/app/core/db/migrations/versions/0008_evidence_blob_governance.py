import sqlalchemy as sa
from alembic import op

revision = "0008_evidence_blob_governance"
down_revision = "0007_deal_conversion_ic_evidence"


def upgrade():
    # Ensure evidence_documents exists (created in 0007); add governance constraints/indexes.
    op.alter_column("evidence_documents", "uploaded_at", existing_type=sa.DateTime(timezone=True), nullable=True)

    op.create_index(
        "ix_evidence_documents_blob_uri",
        "evidence_documents",
        ["blob_uri"],
    )


def downgrade():
    op.drop_index("ix_evidence_documents_blob_uri", table_name="evidence_documents")
    op.alter_column("evidence_documents", "uploaded_at", existing_type=sa.DateTime(timezone=True), nullable=False)

