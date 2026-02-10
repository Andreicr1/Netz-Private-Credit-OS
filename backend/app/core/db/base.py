from __future__ import annotations

import datetime as dt
import uuid
from typing import Any

from sqlalchemy import DateTime, String, Uuid, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.shared.enums import AccessLevel


class Base(DeclarativeBase):
    type_annotation_map: dict[Any, Any] = {
        dt.datetime: DateTime(timezone=True),
    }


class IdMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        default=uuid.uuid4,
        primary_key=True,
        index=True,
    )


class FundScopedMixin:
    fund_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), index=True)
    access_level: Mapped[str] = mapped_column(
        String(32),
        default=AccessLevel.internal.value,
        index=True,
    )


class AuditMetaMixin:
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    created_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(128), nullable=True)

