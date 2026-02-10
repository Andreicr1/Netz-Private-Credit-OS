from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import NoResultFound
from sqlalchemy.orm import Session

from app.core.db.session import get_db
from app.core.security.auth import Actor
from app.core.security.dependencies import get_actor, require_readonly_allowed
from app.modules.deals import service
from app.modules.deals.schemas import (
    DealCreate,
    DealDecisionCreate,
    DealDecisionOut,
    DealOut,
    DealStagePatch,
    Page,
    QualificationRunRequest,
    QualificationRunResponse,
)

router = APIRouter(prefix="/pipeline/deals", tags=["deals"])


def _limit(limit: int = Query(50, ge=1, le=200)) -> int:
    return limit


def _offset(offset: int = Query(0, ge=0, le=10_000)) -> int:
    return offset


@router.get("", response_model=Page[DealOut])
def list_deals(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    limit: int = Depends(_limit),
    offset: int = Depends(_offset),
    stage: str | None = Query(default=None),
    is_archived: bool | None = Query(default=None),
    rejection_reason_code: str | None = Query(default=None),
) -> Page[DealOut]:
    items = service.list_deals(
        db,
        fund_id=fund_id,
        limit=limit,
        offset=offset,
        stage=stage,
        is_archived=is_archived,
        rejection_reason_code=rejection_reason_code,
    )
    return Page(items=items, limit=limit, offset=offset)


@router.post("", response_model=DealOut, status_code=status.HTTP_201_CREATED)
def create_deal(
    fund_id: uuid.UUID,
    payload: DealCreate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_actor),
    _write_guard: Actor = Depends(require_readonly_allowed()),
) -> DealOut:
    return service.create_deal(db, fund_id=fund_id, actor=actor, data=payload)


@router.patch("/{deal_id}/stage", response_model=DealOut)
def patch_deal_stage(
    fund_id: uuid.UUID,
    deal_id: uuid.UUID,
    payload: DealStagePatch,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_actor),
    _write_guard: Actor = Depends(require_readonly_allowed()),
) -> DealOut:
    try:
        return service.patch_stage(db, fund_id=fund_id, actor=actor, deal_id=deal_id, patch=payload)
    except NoResultFound:
        raise HTTPException(status_code=404, detail="Deal not found")


@router.post("/{deal_id}/decisions", response_model=DealDecisionOut, status_code=status.HTTP_201_CREATED)
def create_decision(
    fund_id: uuid.UUID,
    deal_id: uuid.UUID,
    payload: DealDecisionCreate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_actor),
    _write_guard: Actor = Depends(require_readonly_allowed()),
) -> DealDecisionOut:
    try:
        return service.decide(db, fund_id=fund_id, actor=actor, deal_id=deal_id, payload=payload)
    except NoResultFound:
        raise HTTPException(status_code=404, detail="Deal not found")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid outcome")


@router.post("/qualification/run", response_model=QualificationRunResponse)
def run_qualification(
    fund_id: uuid.UUID,
    payload: QualificationRunRequest,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_actor),
    _write_guard: Actor = Depends(require_readonly_allowed()),
) -> QualificationRunResponse:
    if payload.deal_id is None:
        raise HTTPException(status_code=400, detail="deal_id is required")
    try:
        deal, results, auto_archived = service.run_qualification(db, fund_id=fund_id, actor=actor, req=payload)
    except NoResultFound:
        raise HTTPException(status_code=404, detail="Deal not found")
    return QualificationRunResponse(deal=deal, results=results, auto_archived=auto_archived)

