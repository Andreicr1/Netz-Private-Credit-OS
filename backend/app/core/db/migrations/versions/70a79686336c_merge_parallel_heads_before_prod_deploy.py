"""merge parallel heads before prod deploy

Revision ID: 70a79686336c
Revises: 0009b_expand_alembic_version, 0023_ai_engine_wave_ai4_portfolio_intelligence
Create Date: 2026-02-14 10:59:23.091132

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa



revision = '70a79686336c'
down_revision = ('0009b_expand_alembic_version', '0023_ai_engine_wave_ai4_portfolio_intelligence')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

