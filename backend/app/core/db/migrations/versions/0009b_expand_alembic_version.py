"""Expand alembic_version.version_num length.

This project uses descriptive Alembic revision identifiers (e.g.
`0010_dataroom_ingest_cash_management`) which exceed Alembic's default
`VARCHAR(32)` for `alembic_version.version_num` on some databases.

If the column is too short, `alembic upgrade` fails when it tries to update
`version_num` to a longer revision id.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0009b_expand_alembic_version"
down_revision = "0009_monthly_reporting_packs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "alembic_version",
        "version_num",
        existing_type=sa.String(length=32),
        type_=sa.String(length=64),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "alembic_version",
        "version_num",
        existing_type=sa.String(length=64),
        type_=sa.String(length=32),
        existing_nullable=False,
    )

