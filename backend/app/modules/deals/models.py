from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, JSON, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db.base import AuditMetaMixin, Base, FundScopedMixin, IdMixin


class Deal(Base, IdMixin, FundScopedMixin, AuditMetaMixin):
    __tablename__ = "pipeline_deals"

    deal_name: Mapped[str | None] = mapped_column(String(300), nullable=True, index=True)
    sponsor_name: Mapped[str | None] = mapped_column(String(300), nullable=True, index=True)
    lifecycle_stage: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    first_detected_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    last_updated_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    deal_folder_path: Mapped[str | None] = mapped_column(String(800), nullable=True, index=True)
    transition_target_container: Mapped[str | None] = mapped_column(String(120), nullable=True)
    intelligence_history: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    title: Mapped[str] = mapped_column(String(300), index=True)
    borrower_name: Mapped[str | None] = mapped_column(String(300), nullable=True, index=True)
    requested_amount: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="USD")

    stage: Mapped[str] = mapped_column(String(64), index=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)

    rejection_reason_code: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    rejection_rationale: Mapped[str | None] = mapped_column(Text, nullable=True)

    meta: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)

    __table_args__ = (Index("ix_pipeline_deals_fund_stage", "fund_id", "stage"),)


class DealDocument(Base, IdMixin, FundScopedMixin, AuditMetaMixin):
    __tablename__ = "pipeline_deal_documents"

    deal_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pipeline_deals.id", ondelete="CASCADE"), index=True)
    document_type: Mapped[str] = mapped_column(String(64), index=True)
    filename: Mapped[str] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(32), default="registered", index=True)
    meta: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)


class DealStageHistory(Base, IdMixin, FundScopedMixin, AuditMetaMixin):
    __tablename__ = "pipeline_deal_stage_history"

    deal_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pipeline_deals.id", ondelete="CASCADE"), index=True)
    from_stage: Mapped[str | None] = mapped_column(String(64), nullable=True)
    to_stage: Mapped[str] = mapped_column(String(64), index=True)
    changed_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)


class DealDecision(Base, IdMixin, FundScopedMixin, AuditMetaMixin):
    __tablename__ = "pipeline_deal_decisions"

    deal_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pipeline_deals.id", ondelete="CASCADE"), index=True)
    outcome: Mapped[str] = mapped_column(String(32), index=True)  # approved/rejected/conditional
    reason_code: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    rationale: Mapped[str] = mapped_column(Text)
    decided_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class QualificationRule(Base, IdMixin, FundScopedMixin, AuditMetaMixin):
    __tablename__ = "pipeline_qualification_rules"

    name: Mapped[str] = mapped_column(String(200), index=True)
    version: Mapped[str] = mapped_column(String(32), default="v1", index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    rule_config: Mapped[dict] = mapped_column(JSON)


class QualificationResult(Base, IdMixin, FundScopedMixin, AuditMetaMixin):
    __tablename__ = "pipeline_qualification_results"

    deal_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pipeline_deals.id", ondelete="CASCADE"), index=True)
    rule_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("pipeline_qualification_rules.id", ondelete="RESTRICT"),
        index=True,
    )
    result: Mapped[str] = mapped_column(String(16), index=True)  # pass/fail/flag
    reasons: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    run_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

