from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.db.session import get_db
from app.core.security.rbac import require_role
from app.domain.cash_management.service import (
    approve,
    create_transaction,
    generate_instructions,
    mark_executed,
    mark_sent_to_admin,
    submit_transaction,
)


router = APIRouter(prefix="/api/cash", tags=["Cash Management"])


def _require_fund_access(fund_id: uuid.UUID, actor) -> None:
    if not actor.can_access_fund(fund_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden for this fund")


@router.post("/transactions")
def create_tx(
    payload: dict,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["INVESTMENT_TEAM", "COMPLIANCE", "GP", "ADMIN"])),
):
    if "fund_id" not in payload:
        raise HTTPException(status_code=400, detail="fund_id is required")
    fund_id = uuid.UUID(str(payload["fund_id"]))
    _require_fund_access(fund_id, actor)
    try:
        tx = create_transaction(db, fund_id=fund_id, actor=actor, payload=payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"transaction_id": str(tx.id), "status": tx.status.value}


@router.post("/transactions/{tx_id}/submit")
def submit(
    tx_id: uuid.UUID,
    fund_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    actor=Depends(require_role(["INVESTMENT_TEAM", "COMPLIANCE", "GP", "ADMIN"])),
):
    _require_fund_access(fund_id, actor)
    try:
        tx = submit_transaction(db, fund_id=fund_id, actor=actor, tx_id=tx_id)
        return {"transaction_id": str(tx.id), "status": tx.status.value}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/transactions/{tx_id}/approve/director")
def approve_director(
    tx_id: uuid.UUID,
    payload: dict,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["GP", "ADMIN"])),
):
    if "fund_id" not in payload:
        raise HTTPException(status_code=400, detail="fund_id is required")
    fund_id = uuid.UUID(str(payload["fund_id"]))
    _require_fund_access(fund_id, actor)
    try:
        tx, appr = approve(
            db,
            fund_id=fund_id,
            actor=actor,
            tx_id=tx_id,
            approver_role="DIRECTOR",
            approver_name=str(payload.get("approver_name") or actor.actor_id),
            comment=payload.get("comment"),
            evidence_blob_uri=payload.get("evidence_blob_url") or payload.get("evidence_blob_uri"),
        )
        return {"transaction_id": str(tx.id), "status": tx.status.value, "approval_id": str(appr.id)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/transactions/{tx_id}/approve/ic")
def approve_ic(
    tx_id: uuid.UUID,
    payload: dict,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["INVESTMENT_TEAM", "ADMIN"])),
):
    if "fund_id" not in payload:
        raise HTTPException(status_code=400, detail="fund_id is required")
    fund_id = uuid.UUID(str(payload["fund_id"]))
    _require_fund_access(fund_id, actor)
    try:
        tx, appr = approve(
            db,
            fund_id=fund_id,
            actor=actor,
            tx_id=tx_id,
            approver_role="IC_MEMBER",
            approver_name=str(payload.get("approver_name") or actor.actor_id),
            comment=payload.get("comment"),
            evidence_blob_uri=payload.get("evidence_blob_url") or payload.get("evidence_blob_uri"),
        )
        return {
            "transaction_id": str(tx.id),
            "status": tx.status.value,
            "ic_approvals_count": int(tx.ic_approvals_count),
            "approval_id": str(appr.id),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/transactions/{tx_id}/generate-instructions")
def gen_instructions(
    tx_id: uuid.UUID,
    fund_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    actor=Depends(require_role(["COMPLIANCE", "GP", "ADMIN"])),
):
    _require_fund_access(fund_id, actor)
    try:
        tx = generate_instructions(db, fund_id=fund_id, actor=actor, tx_id=tx_id)
        return {"transaction_id": str(tx.id), "instructions_blob_uri": tx.instructions_blob_uri}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/transactions/{tx_id}/mark-sent")
def mark_sent(
    tx_id: uuid.UUID,
    payload: dict,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["COMPLIANCE", "GP", "ADMIN"])),
):
    if "fund_id" not in payload:
        raise HTTPException(status_code=400, detail="fund_id is required")
    fund_id = uuid.UUID(str(payload["fund_id"]))
    _require_fund_access(fund_id, actor)
    try:
        tx = mark_sent_to_admin(db, fund_id=fund_id, actor=actor, tx_id=tx_id, admin_contact=payload.get("admin_contact"))
        return {"transaction_id": str(tx.id), "status": tx.status.value, "sent_to_admin_at": tx.sent_to_admin_at.isoformat()}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/transactions/{tx_id}/mark-executed")
def mark_exec(
    tx_id: uuid.UUID,
    payload: dict,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["COMPLIANCE", "GP", "ADMIN"])),
):
    if "fund_id" not in payload:
        raise HTTPException(status_code=400, detail="fund_id is required")
    fund_id = uuid.UUID(str(payload["fund_id"]))
    _require_fund_access(fund_id, actor)
    try:
        tx = mark_executed(
            db,
            fund_id=fund_id,
            actor=actor,
            tx_id=tx_id,
            bank_reference=payload.get("bank_reference"),
            notes=payload.get("notes"),
        )
        return {"transaction_id": str(tx.id), "status": tx.status.value, "executed_at": tx.execution_confirmed_at.isoformat()}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

