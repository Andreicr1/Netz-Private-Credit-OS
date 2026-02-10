from __future__ import annotations

import uuid

from sqlalchemy import JSON, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db.base import AuditMetaMixin, Base, FundScopedMixin, IdMixin


class Fund(Base, IdMixin, AuditMetaMixin):
    __tablename__ = "funds"

    name: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)


class User(Base, IdMixin, AuditMetaMixin):
    __tablename__ = "users"

    external_id: Mapped[str | None] = mapped_column(String(200), unique=True, nullable=True, index=True)
    email: Mapped[str | None] = mapped_column(String(320), unique=True, nullable=True, index=True)
    display_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)


class UserFundRole(Base, IdMixin, FundScopedMixin, AuditMetaMixin):
    __tablename__ = "user_fund_roles"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    fund_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("funds.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(32), index=True)

    __table_args__ = (UniqueConstraint("user_id", "fund_id", "role", name="uq_user_fund_role"),)


class AuditEvent(Base, IdMixin, FundScopedMixin, AuditMetaMixin):
    __tablename__ = "audit_events"

    actor_id: Mapped[str] = mapped_column(String(200), index=True)
    actor_roles: Mapped[list[str]] = mapped_column(JSON, default=list)

    action: Mapped[str] = mapped_column(String(200), index=True)
    entity_type: Mapped[str] = mapped_column(String(100), index=True)
    entity_id: Mapped[str] = mapped_column(String(200), index=True)

    before: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    after: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    request_id: Mapped[str] = mapped_column(String(64), index=True)

    __table_args__ = (
        Index("ix_audit_events_fund_entity", "fund_id", "entity_type", "entity_id"),
    )

