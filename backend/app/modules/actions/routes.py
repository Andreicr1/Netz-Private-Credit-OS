from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import NoResultFound
from sqlalchemy.orm import Session

from app.core.db.session import get_db
from app.core.security.auth import Actor
from app.core.security.dependencies import get_actor, require_readonly_allowed
from app.modules.actions import service
from app.modules.actions.schemas import (
    ActionCreate,
    ActionOut,
    ActionStatusPatch,
    EvidenceCreate,
    EvidenceOut,
    Page,
)

router = APIRouter(prefix="/execution/actions", tags=["actions"])


def _limit(limit: int = Query(50, ge=1, le=200)) -> int:
    return limit


def _offset(offset: int = Query(0, ge=0, le=10_000)) -> int:
    return offset


@router.get("", response_model=Page[ActionOut])
def list_actions(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    limit: int = Depends(_limit),
    offset: int = Depends(_offset),
    deal_id: uuid.UUID | None = Query(default=None),
    loan_id: uuid.UUID | None = Query(default=None),
) -> Page[ActionOut]:
    items = service.list_actions(db, fund_id=fund_id, limit=limit, offset=offset, deal_id=deal_id, loan_id=loan_id)
    return Page(items=items, limit=limit, offset=offset)


@router.post("", response_model=ActionOut, status_code=status.HTTP_201_CREATED)
def create_action(
    fund_id: uuid.UUID,
    payload: ActionCreate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_actor),
    _write_guard: Actor = Depends(require_readonly_allowed()),
) -> ActionOut:
    try:
        return service.create_action(db, fund_id=fund_id, actor=actor, payload=payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{action_id}/status", response_model=ActionOut)
def patch_action_status(
    fund_id: uuid.UUID,
    action_id: uuid.UUID,
    payload: ActionStatusPatch,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_actor),
    _write_guard: Actor = Depends(require_readonly_allowed()),
) -> ActionOut:
    try:
        return service.patch_action_status(db, fund_id=fund_id, actor=actor, action_id=action_id, patch=payload)
    except NoResultFound:
        raise HTTPException(status_code=404, detail="Action not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{action_id}/evidence", response_model=EvidenceOut, status_code=status.HTTP_201_CREATED)
def add_evidence(
    fund_id: uuid.UUID,
    action_id: uuid.UUID,
    payload: EvidenceCreate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_actor),
    _write_guard: Actor = Depends(require_readonly_allowed()),
) -> EvidenceOut:
    try:
        return service.add_evidence(db, fund_id=fund_id, actor=actor, action_id=action_id, payload=payload)
    except NoResultFound:
        raise HTTPException(status_code=404, detail="Action not found")

