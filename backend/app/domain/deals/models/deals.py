from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db.base import Base
from app.domain.deals.enums import DealStage, DealType, RejectionCode


class Deal(Base):
    """
    Canonical record of every opportunity ever reviewed.
    Deals are never deleted, even if rejected.
    """

    __tablename__ = "deals"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)

    fund_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), index=True, nullable=False)

    deal_type: Mapped[DealType] = mapped_column(
        Enum(DealType, name="deal_type_enum"),
        nullable=False,
    )

    stage: Mapped[DealStage] = mapped_column(
        Enum(DealStage, name="deal_stage_enum"),
        default=DealStage.INTAKE,
        nullable=False,
    )

    asset_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        nullable=True,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)

    sponsor_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    rejection_code: Mapped[RejectionCode | None] = mapped_column(
        Enum(RejectionCode, name="rejection_code_enum"),
        nullable=True,
    )

    rejection_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

