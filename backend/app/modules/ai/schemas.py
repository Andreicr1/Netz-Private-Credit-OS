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


class AIQueryCreate(BaseModel):
    query_text: str = Field(min_length=3)


class AIQueryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    fund_id: uuid.UUID
    access_level: str
    actor_id: str
    query_text: str
    request_id: str
    created_at_utc: dt.datetime


class AIResponseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: uuid.UUID
    fund_id: uuid.UUID
    access_level: str
    query_id: uuid.UUID
    model_version: str
    prompt: dict
    retrieval_sources: list[dict] | None
    citations: list[dict] | None
    response_text: str | None
    created_at_utc: dt.datetime


class AIRetrieveRequest(BaseModel):
    query: str = Field(min_length=3)
    root_folder: str | None = None
    top_k: int = Field(default=5, ge=1, le=20)


class AIRetrieveResult(BaseModel):
    chunk_id: str
    document_title: str
    root_folder: str | None
    folder_path: str | None
    version_id: str
    version_number: int
    chunk_index: int | None
    excerpt: str
    source_blob: str | None


class AIRetrieveResponse(BaseModel):
    results: list[AIRetrieveResult]


class AIAnswerRequest(BaseModel):
    question: str = Field(min_length=3)
    root_folder: str | None = None
    top_k: int = Field(default=6, ge=1, le=20)


class AIAnswerCitationOut(BaseModel):
    chunk_id: str
    document_id: str
    version_id: str
    page_start: int | None
    page_end: int | None
    excerpt: str
    source_blob: str | None


class AIAnswerResponse(BaseModel):
    answer: str
    citations: list[AIAnswerCitationOut]

