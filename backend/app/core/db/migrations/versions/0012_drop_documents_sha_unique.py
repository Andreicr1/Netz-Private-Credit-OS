import sqlalchemy as sa
from alembic import op

revision = "0012_drop_documents_sha_unique"
down_revision = "0011_dataroom_folder_governance"


def upgrade():
    # EPIC 3A: allow multiple docs with same sha256 (different folders / filenames).
    # Keep ix_documents_sha256 for audit/search, but drop uniqueness.
    op.drop_constraint("uq_documents_fund_source_sha256", "documents", type_="unique")


def downgrade():
    op.create_unique_constraint("uq_documents_fund_source_sha256", "documents", ["fund_id", "source", "sha256"])

