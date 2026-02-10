from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.core.db.models import AuditEvent
from app.core.middleware.audit import get_actor_id, get_actor_roles, get_request_id


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
        before=before,
        after=after,
        request_id=request_id,
        created_by=actor_id,
        updated_by=actor_id,
    )
    db.add(event)
    db.flush()
    return event

