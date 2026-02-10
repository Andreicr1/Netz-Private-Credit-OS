from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db.base import Base


class ICMemo(Base):
    """
    Institutional Investment Committee memo record.
    Stores structured metadata and narrative.

    IC memos must persist forever.
    """

    __tablename__ = "ic_memos"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)

    deal_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), index=True, nullable=False)

    executive_summary: Mapped[str] = mapped_column(Text, nullable=False)

    risks: Mapped[str | None] = mapped_column(Text, nullable=True)

    mitigants: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

