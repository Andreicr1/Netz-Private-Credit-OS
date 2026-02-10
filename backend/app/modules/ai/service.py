from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db.audit import write_audit_event
from app.core.security.auth import Actor
from app.modules.ai.models import AIQuery, AIResponse
from app.modules.ai.schemas import AIQueryCreate
from app.shared.utils import sa_model_to_dict


def create_query_stub(db: Session, *, fund_id: uuid.UUID, actor: Actor, payload: AIQueryCreate, request_id: str) -> tuple[AIQuery, AIResponse]:
    q = AIQuery(
        fund_id=fund_id,
        actor_id=actor.actor_id,
        query_text=payload.query_text,
        request_id=request_id,
        created_by=actor.actor_id,
        updated_by=actor.actor_id,
    )
    db.add(q)
    db.flush()

    r = AIResponse(
        fund_id=fund_id,
        query_id=q.id,
        model_version="stub-not-implemented",
        prompt={"query_text": payload.query_text},
        retrieval_sources=[],
        citations=[],
        response_text=None,
        created_by=actor.actor_id,
        updated_by=actor.actor_id,
    )
    db.add(r)
    db.flush()

    write_audit_event(
        db,
        fund_id=fund_id,
        action="ai.query.create",
        entity_type="ai_query",
        entity_id=q.id,
        before=None,
        after=sa_model_to_dict(q),
    )
    write_audit_event(
        db,
        fund_id=fund_id,
        action="ai.response.create_stub",
        entity_type="ai_response",
        entity_id=r.id,
        before=None,
        after=sa_model_to_dict(r),
    )
    db.commit()
    db.refresh(q)
    db.refresh(r)
    return q, r


def list_queries(db: Session, *, fund_id: uuid.UUID, limit: int, offset: int) -> list[AIQuery]:
    stmt = select(AIQuery).where(AIQuery.fund_id == fund_id).order_by(AIQuery.created_at.desc()).offset(offset).limit(limit)
    return list(db.execute(stmt).scalars().all())

