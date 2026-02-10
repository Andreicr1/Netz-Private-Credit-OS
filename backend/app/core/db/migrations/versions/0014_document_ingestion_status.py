import sqlalchemy as sa
from alembic import op

revision = "0014_document_ingestion_status"
down_revision = "0013_document_chunks"


def upgrade():
    op.add_column(
        "document_versions",
        sa.Column(
            "ingestion_status",
            sa.Enum("PENDING", "PROCESSING", "INDEXED", "FAILED", name="document_ingestion_status_enum"),
            nullable=False,
            server_default="PENDING",
        ),
    )
    op.create_index("ix_document_versions_ingestion_status", "document_versions", ["ingestion_status"])


def downgrade():
    op.drop_index("ix_document_versions_ingestion_status", table_name="document_versions")
    op.drop_column("document_versions", "ingestion_status")
    op.execute("DROP TYPE document_ingestion_status_enum")

