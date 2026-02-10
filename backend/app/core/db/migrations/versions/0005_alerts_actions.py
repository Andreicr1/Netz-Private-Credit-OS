import sqlalchemy as sa
from alembic import op

revision = "0005_alerts_actions"
down_revision = "0004_asset_obligations"


def upgrade():
    # --- Rename legacy tables to avoid collisions with domain tables
    # Legacy portfolio monitoring alerts (fund-scoped) -> portfolio_alerts
    op.rename_table("alerts", "portfolio_alerts")

    # Legacy execution layer actions (fund-scoped) -> execution_actions*
    op.rename_table("actions", "execution_actions")
    op.rename_table("action_links", "execution_action_links")
    op.rename_table("action_evidence", "execution_action_evidence")
    op.rename_table("action_comments", "execution_action_comments")
    op.rename_table("action_reviews", "execution_action_reviews")

    # --- Create domain alerts (fund scoping via join to portfolio_assets)
    op.create_table(
        "alerts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("asset_id", sa.Uuid(), nullable=False),
        sa.Column("obligation_id", sa.Uuid(), nullable=True),
        sa.Column(
            "alert_type",
            sa.Enum(
                "OBLIGATION_OVERDUE",
                "NAV_MISSING",
                "COVENANT_BREACH",
                name="alert_type_enum",
            ),
            nullable=False,
        ),
        sa.Column(
            "severity",
            sa.Enum(
                "LOW",
                "MEDIUM",
                "HIGH",
                "CRITICAL",
                name="alert_severity_enum",
            ),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_alerts_asset_id", "alerts", ["asset_id"])

    # --- Create domain actions (must always link to an alert)
    op.create_table(
        "actions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("asset_id", sa.Uuid(), nullable=False),
        sa.Column("alert_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "OPEN",
                "PENDING_EVIDENCE",
                "UNDER_REVIEW",
                "CLOSED",
                "WAIVED",
                name="action_status_enum",
            ),
            nullable=False,
            server_default="OPEN",
        ),
        sa.Column("evidence_required", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("evidence_notes", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["alert_id"], ["alerts.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_actions_asset_id", "actions", ["asset_id"])
    op.create_index("ix_actions_alert_id", "actions", ["alert_id"])


def downgrade():
    # Drop domain tables
    op.drop_index("ix_actions_alert_id", table_name="actions")
    op.drop_index("ix_actions_asset_id", table_name="actions")
    op.drop_table("actions")

    op.drop_index("ix_alerts_asset_id", table_name="alerts")
    op.drop_table("alerts")

    op.execute("DROP TYPE action_status_enum")
    op.execute("DROP TYPE alert_severity_enum")
    op.execute("DROP TYPE alert_type_enum")

    # Rename legacy tables back
    op.rename_table("execution_action_reviews", "action_reviews")
    op.rename_table("execution_action_comments", "action_comments")
    op.rename_table("execution_action_evidence", "action_evidence")
    op.rename_table("execution_action_links", "action_links")
    op.rename_table("execution_actions", "actions")

    op.rename_table("portfolio_alerts", "alerts")

