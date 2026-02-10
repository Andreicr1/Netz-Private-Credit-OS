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


class BorrowerCreate(BaseModel):
    legal_name: str = Field(min_length=2, max_length=300)
    tax_id: str | None = Field(default=None, max_length=64)
    country: str | None = Field(default=None, max_length=2)
    industry: str | None = Field(default=None, max_length=120)
    notes: str | None = None


class BorrowerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    fund_id: uuid.UUID
    access_level: str
    legal_name: str
    tax_id: str | None
    country: str | None
    industry: str | None
    notes: str | None
    created_at: dt.datetime
    updated_at: dt.datetime


class LoanCreate(BaseModel):
    borrower_id: uuid.UUID
    external_reference: str | None = Field(default=None, max_length=120)
    principal_amount: float
    currency: str = Field(default="USD", max_length=3)
    interest_rate_bps: int | None = None
    start_date: dt.date | None = None
    maturity_date: dt.date | None = None
    status: str = Field(default="active", max_length=32)


class LoanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    fund_id: uuid.UUID
    access_level: str
    borrower_id: uuid.UUID
    external_reference: str | None
    principal_amount: float
    currency: str
    interest_rate_bps: int | None
    start_date: dt.date | None
    maturity_date: dt.date | None
    status: str
    created_at: dt.datetime
    updated_at: dt.datetime


class CovenantCreate(BaseModel):
    loan_id: uuid.UUID
    name: str = Field(min_length=2, max_length=200)
    covenant_type: str = Field(min_length=2, max_length=64)
    threshold: float | None = None
    comparator: str = Field(default=">=", max_length=8)
    frequency: str | None = Field(default=None, max_length=32)
    is_active: bool = True


class CovenantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    fund_id: uuid.UUID
    access_level: str
    loan_id: uuid.UUID
    name: str
    covenant_type: str
    threshold: float | None
    comparator: str
    frequency: str | None
    is_active: bool
    created_at: dt.datetime
    updated_at: dt.datetime


class CovenantTestCreate(BaseModel):
    covenant_id: uuid.UUID
    tested_at: dt.date
    value: float | None = None
    passed: bool | None = None
    notes: str | None = None
    inputs: dict | None = None

    # Optional breach metadata (if passed == False)
    breach_severity: str = Field(default="warning", max_length=32)
    breach_details: dict | None = None


class CovenantTestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    fund_id: uuid.UUID
    access_level: str
    covenant_id: uuid.UUID
    tested_at: dt.date
    value: float | None
    passed: bool | None
    notes: str | None
    inputs: dict | None
    created_at: dt.datetime
    updated_at: dt.datetime


class CovenantBreachOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    fund_id: uuid.UUID
    access_level: str
    covenant_test_id: uuid.UUID
    breach_detected_at: dt.date
    severity: str
    details: dict | None
    created_at: dt.datetime
    updated_at: dt.datetime


class AlertCreate(BaseModel):
    alert_type: str = Field(min_length=2, max_length=32)
    severity: str = Field(default="info", max_length=16)
    message: str
    entity_type: str | None = Field(default=None, max_length=64)
    entity_id: str | None = Field(default=None, max_length=200)
    status: str = Field(default="open", max_length=32)
    data: dict | None = None


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    fund_id: uuid.UUID
    access_level: str
    alert_type: str
    severity: str
    message: str
    entity_type: str | None
    entity_id: str | None
    status: str
    data: dict | None
    created_at: dt.datetime
    updated_at: dt.datetime

