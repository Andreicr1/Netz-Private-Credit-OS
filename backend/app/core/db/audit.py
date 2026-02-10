from __future__ import annotations

import datetime as dt
import uuid
from decimal import Decimal
from enum import Enum
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db.models import AuditEvent
from app.core.middleware.audit import get_actor_id, get_actor_roles, get_request_id


def _json_safe(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, (dt.date, dt.datetime)):
        return value.isoformat()
    if isinstance(value, Decimal):
        # Preserve exactness for auditability.
        return str(value)
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(v) for v in value]
    return str(value)


def write_audit_event(
    db: Session,
    *,
    fund_id: uuid.UUID,
    actor_id: str | None = None,
    actor_roles: list[str] | None = None,
    request_id: str | None = None,
    action: str,
    entity_type: str,
    entity_id: str | uuid.UUID,
    before: dict[str, Any] | None,
    after: dict[str, Any] | None,
    access_level: str = "internal",
) -> AuditEvent:
    request_id = request_id or get_request_id() or "unknown"
    actor_id = actor_id or get_actor_id() or "unknown"
    actor_roles = actor_roles or get_actor_roles()

    event = AuditEvent(
        fund_id=fund_id,
        access_level=access_level,
        actor_id=actor_id,
        actor_roles=actor_roles,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        before=_json_safe(before),
        after=_json_safe(after),
        request_id=request_id,
        created_by=actor_id,
        updated_by=actor_id,
    )
    db.add(event)
    db.flush()
    return event


def get_audit_log(
    db: Session,
    *,
    fund_id: uuid.UUID,
    entity_id: str | uuid.UUID,
    entity_type: str | None = None,
    limit: int = 200,
) -> list[AuditEvent]:
    stmt = select(AuditEvent).where(AuditEvent.fund_id == fund_id, AuditEvent.entity_id == str(entity_id))
    if entity_type:
        stmt = stmt.where(AuditEvent.entity_type == entity_type)
    stmt = stmt.order_by(AuditEvent.created_at.asc()).limit(limit)
    return list(db.execute(stmt).scalars().all())

