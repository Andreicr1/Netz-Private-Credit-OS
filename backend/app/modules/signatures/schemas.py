from __future__ import annotations

import datetime as dt
import uuid
from typing import Generic, TypeVar

from pydantic import BaseModel, Field


T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    limit: int
    offset: int


class SignatureEvidenceOut(BaseModel):
    document_id: uuid.UUID
    title: str
    source_blob: str | None = None


class DirectorSignatureOut(BaseModel):
    director_id: str
    director_name: str
    status: str = Field(default="SIGNED")
    signed_at_utc: dt.datetime | None = None
    comment: str | None = None


class SignatureRequestOut(BaseModel):
    id: uuid.UUID

    # Normalized signature workflow status (frontend contract)
    status: str

    # Normalized types for UI filters
    type: str

    amount_usd: str
    beneficiary_name: str | None = None
    beneficiary_bank: str | None = None
    beneficiary_account: str | None = None

    purpose: str | None = None
    linked_entity_ref: str | None = None

    created_at_utc: dt.datetime | None = None
    deadline_utc: dt.datetime | None = None

    required_signatures_count: int = Field(default=2)
    current_signatures_count: int = Field(default=0)

    investment_memo_status: str | None = None
    committee_votes_summary: str | None = None


class SignatureRequestDetailOut(BaseModel):
    request: SignatureRequestOut
    evidence: list[SignatureEvidenceOut]
    signatures: list[DirectorSignatureOut]


class SignRequestIn(BaseModel):
    comment: str | None = Field(default=None, max_length=2000)


class RejectRequestIn(BaseModel):
    reason: str = Field(min_length=2, max_length=2000)
