from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db.audit import write_audit_event
from app.core.security.auth import Actor
from app.modules.actions import models
from app.modules.actions.schemas import ActionCreate, ActionStatusPatch, EvidenceCreate
from app.shared.enums import ActionStatus
from app.shared.utils import sa_model_to_dict


def _validate_action_status(status: str) -> None:
    allowed = {s.value for s in ActionStatus}
    if status not in allowed:
        raise ValueError(f"Invalid action status. Allowed: {sorted(allowed)}")


def list_actions(
    db: Session,
    *,
    fund_id: uuid.UUID,
    limit: int,
    offset: int,
    deal_id: uuid.UUID | None,
    loan_id: uuid.UUID | None,
) -> list[models.Action]:
    stmt = select(models.Action).where(models.Action.fund_id == fund_id)

    if deal_id or loan_id:
        stmt = stmt.join(models.ActionLink, models.ActionLink.action_id == models.Action.id)
        if deal_id:
            stmt = stmt.where(models.ActionLink.entity_type == "deal", models.ActionLink.entity_id == str(deal_id))
        if loan_id:
            stmt = stmt.where(models.ActionLink.entity_type == "loan", models.ActionLink.entity_id == str(loan_id))

    stmt = stmt.order_by(models.Action.created_at.desc()).offset(offset).limit(limit)
    return list(db.execute(stmt).scalars().unique().all())


def create_action(db: Session, *, fund_id: uuid.UUID, actor: Actor, payload: ActionCreate) -> models.Action:
    _validate_action_status(payload.status)

    action = models.Action(
        fund_id=fund_id,
        title=payload.title,
        description=payload.description,
        status=payload.status,
        due_date=payload.due_date,
        owner_actor_id=payload.owner_actor_id,
        data=payload.data,
        created_by=actor.actor_id,
        updated_by=actor.actor_id,
    )
    db.add(action)
    db.flush()

    for link in payload.links:
        al = models.ActionLink(
            fund_id=fund_id,
            action_id=action.id,
            entity_type=link.entity_type,
            entity_id=link.entity_id,
            created_by=actor.actor_id,
            updated_by=actor.actor_id,
        )
        db.add(al)

    write_audit_event(
        db,
        fund_id=fund_id,
        action="actions.action.create",
        entity_type="action",
        entity_id=action.id,
        before=None,
        after=sa_model_to_dict(action),
    )
    db.commit()
    db.refresh(action)
    return action


def patch_action_status(
    db: Session, *, fund_id: uuid.UUID, actor: Actor, action_id: uuid.UUID, patch: ActionStatusPatch
) -> models.Action:
    _validate_action_status(patch.status)

    action = db.execute(select(models.Action).where(models.Action.fund_id == fund_id, models.Action.id == action_id)).scalar_one()
    before = sa_model_to_dict(action)
    action.status = patch.status
    action.updated_by = actor.actor_id

    write_audit_event(
        db,
        fund_id=fund_id,
        action="actions.action.status_patch",
        entity_type="action",
        entity_id=action.id,
        before=before,
        after=sa_model_to_dict(action),
    )
    db.commit()
    db.refresh(action)
    return action


def add_evidence(
    db: Session, *, fund_id: uuid.UUID, actor: Actor, action_id: uuid.UUID, payload: EvidenceCreate
) -> models.ActionEvidence:
    # Ensure action exists and is fund-scoped
    db.execute(select(models.Action.id).where(models.Action.fund_id == fund_id, models.Action.id == action_id)).scalar_one()

    evidence = models.ActionEvidence(
        fund_id=fund_id,
        action_id=action_id,
        filename=payload.filename,
        document_ref=payload.document_ref,
        status=payload.status,
        meta=payload.meta,
        created_by=actor.actor_id,
        updated_by=actor.actor_id,
    )
    db.add(evidence)
    db.flush()

    write_audit_event(
        db,
        fund_id=fund_id,
        action="actions.action_evidence.create",
        entity_type="action_evidence",
        entity_id=evidence.id,
        before=None,
        after=sa_model_to_dict(evidence),
    )
    db.commit()
    db.refresh(evidence)
    return evidence

