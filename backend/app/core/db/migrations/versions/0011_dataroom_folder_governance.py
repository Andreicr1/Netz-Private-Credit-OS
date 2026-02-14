import sqlalchemy as sa
from alembic import op

revision = "0011_dataroom_folder_governance"
down_revision = "0010_dataroom_ingest_cash_management"


def upgrade():
    # --- documents: folder governance + domain enum
    op.execute(
        """
        CREATE TYPE IF NOT EXISTS document_domain_enum AS ENUM (
            'OFFERING', 'AUDIT', 'BANK', 'KYC', 'MANDATES', 'CORPORATE',
            'DEALS_MANAGERS', 'MARKETING', 'PROPOSALS', 'ADMIN', 'BOARD',
            'INVESTMENT_MANAGER', 'FEEDER', 'OTHER'
        );
        """
    )

    op.add_column("documents", sa.Column("root_folder", sa.String(length=200), nullable=True))
    op.add_column("documents", sa.Column("folder_path", sa.String(length=800), nullable=True))
    op.add_column("documents", sa.Column("domain", sa.Enum("OFFERING", "AUDIT", "BANK", "KYC", "MANDATES", "CORPORATE", "DEALS_MANAGERS", "MARKETING", "PROPOSALS", "ADMIN", "BOARD", "INVESTMENT_MANAGER", "FEEDER", "OTHER", name="document_domain_enum"), nullable=True))
    op.create_index("ix_documents_root_folder", "documents", ["root_folder"])
    op.create_index("ix_documents_folder_path", "documents", ["folder_path"])
    op.create_index("ix_documents_domain", "documents", ["domain"])
    op.create_unique_constraint("uq_documents_fund_folder_title", "documents", ["fund_id", "root_folder", "folder_path", "title"])

    # --- document_versions: append-only blob path + uploader
    op.add_column("document_versions", sa.Column("blob_path", sa.String(length=800), nullable=True))
    op.add_column("document_versions", sa.Column("uploaded_by", sa.String(length=200), nullable=True))
    op.add_column("document_versions", sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_document_versions_blob_path", "document_versions", ["blob_path"])
    op.create_index("ix_document_versions_uploaded_by", "document_versions", ["uploaded_by"])
    op.create_index("ix_document_versions_uploaded_at", "document_versions", ["uploaded_at"])

    # --- custom root folders (ADMIN-created)
    op.create_table(
        "document_root_folders",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("fund_id", sa.Uuid(), nullable=False),
        sa.Column("access_level", sa.String(length=32), nullable=False, server_default="internal"),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_document_root_folders_fund_id", "document_root_folders", ["fund_id"])
    op.create_index("ix_document_root_folders_access_level", "document_root_folders", ["access_level"])
    op.create_index("ix_document_root_folders_name", "document_root_folders", ["name"])
    op.create_index("ix_document_root_folders_is_active", "document_root_folders", ["is_active"])
    op.create_unique_constraint("uq_document_root_folders_fund_name", "document_root_folders", ["fund_id", "name"])


def downgrade():
    op.drop_constraint("uq_document_root_folders_fund_name", "document_root_folders", type_="unique")
    op.drop_index("ix_document_root_folders_is_active", table_name="document_root_folders")
    op.drop_index("ix_document_root_folders_name", table_name="document_root_folders")
    op.drop_index("ix_document_root_folders_access_level", table_name="document_root_folders")
    op.drop_index("ix_document_root_folders_fund_id", table_name="document_root_folders")
    op.drop_table("document_root_folders")

    op.drop_index("ix_document_versions_uploaded_at", table_name="document_versions")
    op.drop_index("ix_document_versions_uploaded_by", table_name="document_versions")
    op.drop_index("ix_document_versions_blob_path", table_name="document_versions")
    op.drop_column("document_versions", "uploaded_at")
    op.drop_column("document_versions", "uploaded_by")
    op.drop_column("document_versions", "blob_path")

    op.drop_constraint("uq_documents_fund_folder_title", "documents", type_="unique")
    op.drop_index("ix_documents_domain", table_name="documents")
    op.drop_index("ix_documents_folder_path", table_name="documents")
    op.drop_index("ix_documents_root_folder", table_name="documents")
    op.drop_column("documents", "domain")
    op.drop_column("documents", "folder_path")
    op.drop_column("documents", "root_folder")

    op.execute("DROP TYPE IF EXISTS document_domain_enum")

