from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict

from app.domain.deals.enums import DealStage, DealType, RejectionCode


class DealCreate(BaseModel):
    deal_type: DealType
    name: str
    sponsor_name: str | None = None
    description: str | None = None


class DealDecision(BaseModel):
    stage: DealStage
    rejection_code: RejectionCode | None = None
    rejection_notes: str | None = None


class DealOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    fund_id: uuid.UUID

    deal_type: DealType
    stage: DealStage

    name: str
    sponsor_name: str | None
    description: str | None

    rejection_code: RejectionCode | None
    rejection_notes: str | None

