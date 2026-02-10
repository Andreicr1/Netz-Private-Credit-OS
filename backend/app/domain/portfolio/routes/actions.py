from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db.audit import write_audit_event
from app.core.db.session import get_db
from app.core.security.dependencies import require_fund_access
from app.core.security.rbac import require_role
from app.domain.portfolio.models.actions import Action
from app.domain.portfolio.models.assets import PortfolioAsset
from app.domain.portfolio.schemas.actions import ActionOut, ActionUpdate


router = APIRouter(tags=["Actions"], dependencies=[Depends(require_fund_access())])


@router.get("/funds/{fund_id}/portfolio/actions", response_model=list[ActionOut])
def list_actions(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["ADMIN", "COMPLIANCE", "AUDITOR"])),
):
    return (
        db.query(Action)
        .join(PortfolioAsset, PortfolioAsset.id == Action.asset_id)
        .filter(PortfolioAsset.fund_id == fund_id)
        .all()
    )


@router.patch("/funds/{fund_id}/portfolio/actions/{action_id}", response_model=ActionOut)
def update_action(
    fund_id: uuid.UUID,
    action_id: uuid.UUID,
    payload: ActionUpdate,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["ADMIN", "COMPLIANCE"])),
):
    action = (
        db.query(Action)
        .join(PortfolioAsset, PortfolioAsset.id == Action.asset_id)
        .filter(
            PortfolioAsset.fund_id == fund_id,
            Action.id == action_id,
        )
        .first()
    )

    if not action:
        raise HTTPException(status_code=404, detail="Not found")

    before = {"status": action.status.value if hasattr(action.status, "value") else action.status}

    action.status = payload.status
    action.evidence_notes = payload.evidence_notes
    db.flush()

    write_audit_event(
        db=db,
        fund_id=fund_id,
        actor_id=actor.id,
        action="action.updated",
        entity_type="Action",
        entity_id=str(action.id),
        before=before,
        after=payload.model_dump(),
    )

    db.commit()
    db.refresh(action)
    return action

