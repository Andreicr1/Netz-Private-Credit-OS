from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db.audit import write_audit_event
from app.core.db.session import get_db
from app.core.security.dependencies import require_fund_access
from app.core.security.rbac import require_role
from app.domain.actions.schemas.actions import ActionCreate, ActionOut, ActionUpdate
from app.domain.documents.models.evidence import EvidenceDocument
from app.modules.actions.models import Action as ExecutionAction


router = APIRouter(tags=["Actions"], dependencies=[Depends(require_fund_access())])


@router.post("/funds/{fund_id}/actions", response_model=ActionOut)
def create_action(
    fund_id: uuid.UUID,
    payload: ActionCreate,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["INVESTMENT_TEAM", "COMPLIANCE", "ADMIN"])),
):
    action = ExecutionAction(
        fund_id=fund_id,
        title=payload.title,
        status="OPEN",
        description=None,
        created_by=actor.id,
        updated_by=actor.id,
    )
    db.add(action)
    db.flush()

    write_audit_event(
        db=db,
        fund_id=fund_id,
        actor_id=actor.id,
        action="action.created",
        entity_type="ExecutionAction",
        entity_id=str(action.id),
        before=None,
        after={"title": payload.title},
    )

    db.commit()
    db.refresh(action)
    return action


@router.get("/funds/{fund_id}/actions", response_model=list[ActionOut])
def list_actions(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["ADMIN", "COMPLIANCE", "AUDITOR", "INVESTMENT_TEAM"])),
):
    return db.query(ExecutionAction).filter(ExecutionAction.fund_id == fund_id).all()


@router.patch("/funds/{fund_id}/actions/{action_id}", response_model=ActionOut)
def update_action(
    fund_id: uuid.UUID,
    action_id: uuid.UUID,
    payload: ActionUpdate,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["ADMIN", "COMPLIANCE", "INVESTMENT_TEAM"])),
):
    action = db.query(ExecutionAction).filter(ExecutionAction.fund_id == fund_id, ExecutionAction.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Not found")

    # Governance rule: cannot close without evidence
    if payload.status == "CLOSED":
        evidence_count = (
            db.query(EvidenceDocument)
            .filter(EvidenceDocument.fund_id == fund_id)
            .filter(EvidenceDocument.action_id == action.id)
            .count()
        )
        if evidence_count == 0:
            write_audit_event(
                db=db,
                fund_id=fund_id,
                actor_id=actor.id,
                action="action.close_blocked_missing_evidence",
                entity_type="ExecutionAction",
                entity_id=str(action.id),
                before={"status": action.status},
                after={"attempted_status": "CLOSED"},
            )
            db.commit()
            raise HTTPException(status_code=400, detail="Cannot close Action without evidence")

    before = {"status": action.status, "description": action.description}
    action.status = payload.status
    if payload.evidence_notes is not None:
        action.description = payload.evidence_notes
    action.updated_by = actor.id
    db.flush()

    write_audit_event(
        db=db,
        fund_id=fund_id,
        actor_id=actor.id,
        action="action.updated",
        entity_type="ExecutionAction",
        entity_id=str(action.id),
        before=before,
        after=payload.model_dump(),
    )

    db.commit()
    db.refresh(action)
    return action

