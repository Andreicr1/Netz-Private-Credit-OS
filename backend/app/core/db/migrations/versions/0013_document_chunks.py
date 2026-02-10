import sqlalchemy as sa
from alembic import op

revision = "0013_document_chunks"
down_revision = "0012_drop_documents_sha_unique"


def upgrade():
    op.create_table(
        "document_chunks",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("document_id", sa.Uuid(), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_id", sa.Uuid(), sa.ForeignKey("document_versions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("embedding_vector", sa.JSON(), nullable=True),
        sa.Column("version_checksum", sa.String(length=128), nullable=True),
        sa.Column("page_start", sa.Integer(), nullable=True),
        sa.Column("page_end", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_document_chunks_fund_id", "document_chunks", ["fund_id"])
    op.create_index("ix_document_chunks_access_level", "document_chunks", ["access_level"])
    op.create_index("ix_document_chunks_document_id", "document_chunks", ["document_id"])
    op.create_index("ix_document_chunks_version_id", "document_chunks", ["version_id"])
    op.create_index("ix_document_chunks_chunk_index", "document_chunks", ["chunk_index"])
    op.create_index("ix_document_chunks_version_checksum", "document_chunks", ["version_checksum"])
    op.create_unique_constraint("uq_document_chunks_version_chunk_index", "document_chunks", ["version_id", "chunk_index"])
    op.create_index("ix_document_chunks_fund_doc_ver", "document_chunks", ["fund_id", "document_id", "version_id"])


def downgrade():
    op.drop_index("ix_document_chunks_fund_doc_ver", table_name="document_chunks")
    op.drop_constraint("uq_document_chunks_version_chunk_index", "document_chunks", type_="unique")
    op.drop_index("ix_document_chunks_version_checksum", table_name="document_chunks")
    op.drop_index("ix_document_chunks_chunk_index", table_name="document_chunks")
    op.drop_index("ix_document_chunks_version_id", table_name="document_chunks")
    op.drop_index("ix_document_chunks_document_id", table_name="document_chunks")
    op.drop_index("ix_document_chunks_access_level", table_name="document_chunks")
    op.drop_index("ix_document_chunks_fund_id", table_name="document_chunks")
    op.drop_table("document_chunks")

