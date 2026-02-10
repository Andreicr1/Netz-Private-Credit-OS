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


class ObligationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    regulator: str | None = Field(default=None, max_length=64)
    description: str | None = None
    is_active: bool = True


class ObligationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    fund_id: uuid.UUID
    access_level: str
    name: str
    regulator: str | None
    description: str | None
    is_active: bool
    created_at: dt.datetime
    updated_at: dt.datetime


class ObligationStatusOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    fund_id: uuid.UUID
    access_level: str
    obligation_id: uuid.UUID
    status: str
    last_computed_at: dt.datetime
    details: dict | None
    created_at: dt.datetime
    updated_at: dt.datetime

