from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import Date, DateTime, ForeignKey, Index, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db.base import AuditMetaMixin, Base, FundScopedMixin, IdMixin


class Action(Base, IdMixin, FundScopedMixin, AuditMetaMixin):
    __tablename__ = "execution_actions"

    title: Mapped[str] = mapped_column(String(300), index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), index=True)
    due_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True, index=True)
    owner_actor_id: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    __table_args__ = (Index("ix_execution_actions_fund_status", "fund_id", "status"),)


class ActionLink(Base, IdMixin, FundScopedMixin, AuditMetaMixin):
    __tablename__ = "execution_action_links"

    action_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("execution_actions.id", ondelete="CASCADE"), index=True)
    entity_type: Mapped[str] = mapped_column(String(64), index=True)  # deal/loan/document/obligation
    entity_id: Mapped[str] = mapped_column(String(200), index=True)


class ActionEvidence(Base, IdMixin, FundScopedMixin, AuditMetaMixin):
    __tablename__ = "execution_action_evidence"

    action_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("execution_actions.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(300))
    document_ref: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending_review", index=True)
    meta: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)


class ActionComment(Base, IdMixin, FundScopedMixin, AuditMetaMixin):
    __tablename__ = "execution_action_comments"

    action_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("execution_actions.id", ondelete="CASCADE"), index=True)
    comment: Mapped[str] = mapped_column(Text)
    author_actor_id: Mapped[str] = mapped_column(String(200), index=True)
    commented_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class ActionReview(Base, IdMixin, FundScopedMixin, AuditMetaMixin):
    __tablename__ = "execution_action_reviews"

    action_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("execution_actions.id", ondelete="CASCADE"), index=True)
    reviewer_actor_id: Mapped[str] = mapped_column(String(200), index=True)
    decision: Mapped[str] = mapped_column(String(32), index=True)  # approved/rejected/changes_requested
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

