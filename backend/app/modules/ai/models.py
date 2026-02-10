from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import DateTime, ForeignKey, Index, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db.base import AuditMetaMixin, Base, FundScopedMixin, IdMixin


class AIQuery(Base, IdMixin, FundScopedMixin, AuditMetaMixin):
    __tablename__ = "ai_queries"

    actor_id: Mapped[str] = mapped_column(String(200), index=True)
    query_text: Mapped[str] = mapped_column(Text)
    request_id: Mapped[str] = mapped_column(String(64), index=True)
    created_at_utc: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class AIResponse(Base, IdMixin, FundScopedMixin, AuditMetaMixin):
    __tablename__ = "ai_responses"

    query_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("ai_queries.id", ondelete="CASCADE"), index=True)
    model_version: Mapped[str] = mapped_column(String(80), index=True)
    prompt: Mapped[dict] = mapped_column(JSON)
    retrieval_sources: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    citations: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    response_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at_utc: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    __table_args__ = (Index("ix_ai_responses_fund_query", "fund_id", "query_id"),)


# EPIC 3C: institutional Q&A (append-only) with explicit citation table.
class AIQuestion(Base, IdMixin, FundScopedMixin, AuditMetaMixin):
    __tablename__ = "ai_questions"

    actor_id: Mapped[str] = mapped_column(String(200), index=True)
    question_text: Mapped[str] = mapped_column(Text)
    root_folder: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    top_k: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    request_id: Mapped[str] = mapped_column(String(64), index=True)
    retrieved_chunk_ids: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    created_at_utc: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class AIAnswer(Base, IdMixin, FundScopedMixin, AuditMetaMixin):
    __tablename__ = "ai_answers"

    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("ai_questions.id", ondelete="CASCADE"), index=True)
    model_version: Mapped[str] = mapped_column(String(80), index=True)
    answer_text: Mapped[str] = mapped_column(Text)
    prompt: Mapped[dict] = mapped_column(JSON)
    created_at_utc: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    __table_args__ = (Index("ix_ai_answers_fund_question", "fund_id", "question_id"),)


class AIAnswerCitation(Base, IdMixin, FundScopedMixin, AuditMetaMixin):
    __tablename__ = "ai_answer_citations"

    answer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("ai_answers.id", ondelete="CASCADE"), index=True)
    chunk_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("document_chunks.id", ondelete="CASCADE"), index=True)
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("document_versions.id", ondelete="CASCADE"), index=True)
    page_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    page_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    excerpt: Mapped[str] = mapped_column(Text)
    source_blob: Mapped[str | None] = mapped_column(String(800), nullable=True)

    __table_args__ = (Index("ix_ai_answer_citations_fund_answer", "fund_id", "answer_id"),)

