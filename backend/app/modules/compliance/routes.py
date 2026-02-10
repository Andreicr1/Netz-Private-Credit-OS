from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db.session import get_db
from app.core.security.auth import Actor
from app.core.security.dependencies import get_actor, require_readonly_allowed, require_roles
from app.modules.compliance import service
from app.modules.compliance.schemas import ObligationCreate, ObligationOut, ObligationStatusOut, Page
from app.domain.compliance.services.evidence_gap import AI_GAP_PREFIX
from app.modules.compliance.models import Obligation
from app.shared.enums import Role

router = APIRouter(prefix="/compliance", tags=["compliance"])


def _limit(limit: int = Query(50, ge=1, le=200)) -> int:
    return limit


def _offset(offset: int = Query(0, ge=0, le=10_000)) -> int:
    return offset


@router.post("/obligations", response_model=ObligationOut, status_code=status.HTTP_201_CREATED)
def create_obligation(
    fund_id: uuid.UUID,
    payload: ObligationCreate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_actor),
    _write_guard: Actor = Depends(require_readonly_allowed()),
    _role_guard: Actor = Depends(require_roles([Role.COMPLIANCE, Role.ADMIN])),
) -> ObligationOut:
    return service.create_obligation(db, fund_id=fund_id, actor=actor, payload=payload)


@router.get("/obligation-status", response_model=Page[ObligationStatusOut])
def get_obligation_status(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    limit: int = Depends(_limit),
    offset: int = Depends(_offset),
) -> Page[ObligationStatusOut]:
    items = service.list_obligation_status(db, fund_id=fund_id, limit=limit, offset=offset)
    return Page(items=items, limit=limit, offset=offset)


@router.post("/obligation-status/recompute", response_model=Page[ObligationStatusOut])
def recompute_obligation_status(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_actor),
    _write_guard: Actor = Depends(require_readonly_allowed()),
    _role_guard: Actor = Depends(require_roles([Role.COMPLIANCE, Role.ADMIN])),
) -> Page[ObligationStatusOut]:
    items = service.recompute_obligation_status(db, fund_id=fund_id, actor=actor)
    return Page(items=items, limit=len(items), offset=0)


@router.post("/gaps/recompute", response_model=Page[ObligationOut])
def recompute_gaps(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_actor),
    _write_guard: Actor = Depends(require_readonly_allowed()),
    _role_guard: Actor = Depends(require_roles([Role.COMPLIANCE, Role.ADMIN])),
) -> Page[ObligationOut]:
    # Minimal v1: gaps are represented as AI-created obligations (prefix).
    items = list(db.execute(select(Obligation).where(Obligation.fund_id == fund_id, Obligation.name.like(f"{AI_GAP_PREFIX}%"))).scalars().all())
    return Page(items=items, limit=len(items), offset=0)


@router.get("/gaps", response_model=Page[ObligationOut])
def list_gaps(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    limit: int = Depends(_limit),
    offset: int = Depends(_offset),
    _role_guard: Actor = Depends(require_roles([Role.COMPLIANCE, Role.ADMIN])),
) -> Page[ObligationOut]:
    stmt = select(Obligation).where(Obligation.fund_id == fund_id, Obligation.name.like(f"{AI_GAP_PREFIX}%")).offset(offset).limit(limit)
    items = list(db.execute(stmt).scalars().all())
    return Page(items=items, limit=limit, offset=offset)

