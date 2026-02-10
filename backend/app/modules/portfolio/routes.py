from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db.session import get_db
from app.core.security.auth import Actor
from app.core.security.dependencies import get_actor, require_readonly_allowed
from app.modules.portfolio import service
from app.modules.portfolio.schemas import (
    AlertCreate,
    AlertOut,
    BorrowerCreate,
    BorrowerOut,
    CovenantBreachOut,
    CovenantCreate,
    CovenantOut,
    CovenantTestCreate,
    CovenantTestOut,
    LoanCreate,
    LoanOut,
    Page,
)

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


def _limit(limit: int = Query(50, ge=1, le=200)) -> int:
    return limit


def _offset(offset: int = Query(0, ge=0, le=10_000)) -> int:
    return offset


@router.get("/borrowers", response_model=Page[BorrowerOut])
def list_borrowers(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    limit: int = Depends(_limit),
    offset: int = Depends(_offset),
) -> Page[BorrowerOut]:
    items = service.list_borrowers(db, fund_id=fund_id, limit=limit, offset=offset)
    return Page(items=items, limit=limit, offset=offset)


@router.post("/borrowers", response_model=BorrowerOut)
def create_borrower(
    fund_id: uuid.UUID,
    payload: BorrowerCreate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_actor),
    _write_guard: Actor = Depends(require_readonly_allowed()),
) -> BorrowerOut:
    return service.create_borrower(db, fund_id=fund_id, actor=actor, data=payload)


@router.get("/loans", response_model=Page[LoanOut])
def list_loans(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    limit: int = Depends(_limit),
    offset: int = Depends(_offset),
) -> Page[LoanOut]:
    items = service.list_loans(db, fund_id=fund_id, limit=limit, offset=offset)
    return Page(items=items, limit=limit, offset=offset)


@router.post("/loans", response_model=LoanOut)
def create_loan(
    fund_id: uuid.UUID,
    payload: LoanCreate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_actor),
    _write_guard: Actor = Depends(require_readonly_allowed()),
) -> LoanOut:
    return service.create_loan(db, fund_id=fund_id, actor=actor, data=payload)


@router.get("/covenants", response_model=Page[CovenantOut])
def list_covenants(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    limit: int = Depends(_limit),
    offset: int = Depends(_offset),
) -> Page[CovenantOut]:
    items = service.list_covenants(db, fund_id=fund_id, limit=limit, offset=offset)
    return Page(items=items, limit=limit, offset=offset)


@router.post("/covenants", response_model=CovenantOut)
def create_covenant(
    fund_id: uuid.UUID,
    payload: CovenantCreate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_actor),
    _write_guard: Actor = Depends(require_readonly_allowed()),
) -> CovenantOut:
    return service.create_covenant(db, fund_id=fund_id, actor=actor, data=payload)


@router.post("/covenant-tests", response_model=CovenantTestOut)
def create_covenant_test(
    fund_id: uuid.UUID,
    payload: CovenantTestCreate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_actor),
    _write_guard: Actor = Depends(require_readonly_allowed()),
) -> CovenantTestOut:
    return service.create_covenant_test(db, fund_id=fund_id, actor=actor, data=payload)


@router.get("/breaches", response_model=Page[CovenantBreachOut])
def list_breaches(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    limit: int = Depends(_limit),
    offset: int = Depends(_offset),
) -> Page[CovenantBreachOut]:
    items = service.list_breaches(db, fund_id=fund_id, limit=limit, offset=offset)
    return Page(items=items, limit=limit, offset=offset)


@router.get("/alerts", response_model=Page[AlertOut])
def list_alerts(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    limit: int = Depends(_limit),
    offset: int = Depends(_offset),
) -> Page[AlertOut]:
    items = service.list_alerts(db, fund_id=fund_id, limit=limit, offset=offset)
    return Page(items=items, limit=limit, offset=offset)


@router.post("/alerts", response_model=AlertOut)
def create_alert(
    fund_id: uuid.UUID,
    payload: AlertCreate,
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_actor),
    _write_guard: Actor = Depends(require_readonly_allowed()),
) -> AlertOut:
    return service.create_alert(db, fund_id=fund_id, actor=actor, data=payload)

