from __future__ import annotations

import datetime as dt
import uuid
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field


T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    limit: int
    offset: int


class DealCreate(BaseModel):
    title: str = Field(min_length=2, max_length=300)
    borrower_name: str | None = Field(default=None, max_length=300)
    requested_amount: float | None = None
    currency: str = Field(default="USD", max_length=3)
    meta: dict | None = Field(default=None, validation_alias="metadata", serialization_alias="metadata")


class DealOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    fund_id: uuid.UUID
    access_level: str
    title: str
    borrower_name: str | None
    requested_amount: float | None
    currency: str
    stage: str
    is_archived: bool
    rejection_reason_code: str | None
    rejection_rationale: str | None
    meta: dict | None = Field(default=None, serialization_alias="metadata")
    created_at: dt.datetime
    updated_at: dt.datetime


class DealStagePatch(BaseModel):
    to_stage: str = Field(min_length=2, max_length=64)
    rationale: str | None = None


class DealDecisionCreate(BaseModel):
    outcome: str = Field(min_length=2, max_length=32)  # approved/rejected/conditional
    reason_code: str | None = Field(default=None, max_length=64)
    rationale: str = Field(min_length=3)


class DealDecisionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    fund_id: uuid.UUID
    access_level: str
    deal_id: uuid.UUID
    outcome: str
    reason_code: str | None
    rationale: str
    decided_at: dt.datetime


class QualificationRunRequest(BaseModel):
    deal_id: uuid.UUID
    rule_ids: list[uuid.UUID] | None = None


class QualificationResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    fund_id: uuid.UUID
    access_level: str
    deal_id: uuid.UUID
    rule_id: uuid.UUID
    result: str  # pass/fail/flag
    reasons: list[dict] | None
    run_at: dt.datetime


class QualificationRunResponse(BaseModel):
    deal: DealOut
    results: list[QualificationResultOut]
    auto_archived: bool = False

