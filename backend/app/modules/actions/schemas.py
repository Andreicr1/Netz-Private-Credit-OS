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


class ActionLinkIn(BaseModel):
    entity_type: str = Field(min_length=2, max_length=64)
    entity_id: str = Field(min_length=1, max_length=200)


class ActionCreate(BaseModel):
    title: str = Field(min_length=2, max_length=300)
    description: str | None = None
    status: str = Field(default="Open", max_length=32)
    due_date: dt.date | None = None
    owner_actor_id: str | None = Field(default=None, max_length=200)
    data: dict | None = None
    links: list[ActionLinkIn] = Field(default_factory=list)


class ActionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    fund_id: uuid.UUID
    access_level: str
    title: str
    description: str | None
    status: str
    due_date: dt.date | None
    owner_actor_id: str | None
    data: dict | None
    created_at: dt.datetime
    updated_at: dt.datetime


class ActionStatusPatch(BaseModel):
    status: str = Field(min_length=2, max_length=32)


class EvidenceCreate(BaseModel):
    filename: str = Field(min_length=1, max_length=300)
    document_ref: str | None = Field(default=None, max_length=500)
    status: str = Field(default="pending_review", max_length=32)
    meta: dict | None = Field(default=None, validation_alias="metadata", serialization_alias="metadata")


class EvidenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    fund_id: uuid.UUID
    access_level: str
    action_id: uuid.UUID
    filename: str
    document_ref: str | None
    status: str
    meta: dict | None = Field(default=None, serialization_alias="metadata")
    created_at: dt.datetime
    updated_at: dt.datetime

