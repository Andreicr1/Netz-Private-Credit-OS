from __future__ import annotations

import hashlib
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db.session import get_db
from app.core.security.rbac import require_role
from app.domain.cash_management.enums import CashTransactionDirection, CashTransactionStatus
from app.domain.cash_management.models.cash import CashTransaction
from app.domain.cash_management.models.bank_statements import BankStatementLine, BankStatementUpload
from app.domain.cash_management.service import (
    approve,
    create_transaction,
    generate_instructions,
    mark_executed,
    mark_sent_to_admin,
    reject_transaction,
    submit_transaction,
)
from app.domain.cash_management.services.reconciliation import (
    add_statement_line,
    detect_missing_transactions,
    detect_unexplained_outflows,
    match_statement_lines,
    upload_bank_statement,
)
from app.services.blob_storage import upload_bytes_idempotent


router = APIRouter(prefix="/funds/{fund_id}/cash", tags=["Cash Management"])


def _tx_out(tx: CashTransaction) -> dict:
    return {
        "id": str(tx.id),
        "fund_id": str(tx.fund_id),
        "created_at": tx.created_at.isoformat() if tx.created_at else None,
        "updated_at": tx.updated_at.isoformat() if tx.updated_at else None,
        "value_date": tx.value_date.isoformat() if tx.value_date else None,
        "type": tx.type.value,
        "direction": tx.direction.value,
        "amount": float(tx.amount),
        "currency": tx.currency,
        "status": tx.status.value,
        "reference_code": tx.reference_code,
        "beneficiary_name": tx.beneficiary_name,
        "beneficiary_bank": tx.beneficiary_bank,
        "beneficiary_account": tx.beneficiary_account,
        "payment_reference": tx.payment_reference,
        "justification_text": tx.justification_text,
        "policy_basis": tx.policy_basis,
        "investment_memo_document_id": str(tx.investment_memo_document_id) if tx.investment_memo_document_id else None,
        "ic_approvals_count": int(tx.ic_approvals_count or 0),
        "sent_to_admin_at": tx.sent_to_admin_at.isoformat() if tx.sent_to_admin_at else None,
        "admin_contact": tx.admin_contact,
        "execution_confirmed_at": tx.execution_confirmed_at.isoformat() if tx.execution_confirmed_at else None,
        "bank_reference": tx.bank_reference,
        "notes": tx.notes,
        "instructions_blob_uri": tx.instructions_blob_uri,
        "evidence_bundle_blob_uri": tx.evidence_bundle_blob_uri,
        "evidence_bundle_sha256": tx.evidence_bundle_sha256,
    }


def _statement_out(s: BankStatementUpload) -> dict:
    return {
        "id": str(s.id),
        "fund_id": str(s.fund_id),
        "period_start": s.period_start.isoformat(),
        "period_end": s.period_end.isoformat(),
        "uploaded_by": s.uploaded_by,
        "uploaded_at": s.uploaded_at.isoformat(),
        "blob_path": s.blob_path,
        "original_filename": s.original_filename,
        "sha256": s.sha256,
        "notes": s.notes,
    }


def _line_out(line: BankStatementLine) -> dict:
    return {
        "id": str(line.id),
        "statement_id": str(line.statement_id),
        "value_date": line.value_date.isoformat(),
        "description": line.description,
        "amount_usd": float(line.amount_usd),
        "direction": line.direction.value,
        "matched_transaction_id": str(line.matched_transaction_id) if line.matched_transaction_id else None,
        "reconciliation_status": line.reconciliation_status.value,
        "reconciled_at": line.reconciled_at.isoformat() if line.reconciled_at else None,
        "reconciled_by": line.reconciled_by,
        "reconciliation_notes": line.reconciliation_notes,
    }


@router.get("/transactions")
def list_transactions(
    fund_id: uuid.UUID,
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    actor=Depends(require_role(["INVESTMENT_TEAM", "COMPLIANCE", "GP", "ADMIN", "AUDITOR"])),
):
    _require_fund_access(fund_id, actor)

    stmt = select(CashTransaction).where(CashTransaction.fund_id == fund_id)
    if status:
        try:
            st = CashTransactionStatus(status)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid status")
        stmt = stmt.where(CashTransaction.status == st)
    stmt = stmt.order_by(CashTransaction.created_at.desc())

    txs = list(db.execute(stmt).scalars().all())
    return {"items": [_tx_out(tx) for tx in txs]}


def _require_fund_access(fund_id: uuid.UUID, actor) -> None:
    if not actor.can_access_fund(fund_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden for this fund")


@router.post("/transactions")
def create_tx(
    fund_id: uuid.UUID,
    payload: dict,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["INVESTMENT_TEAM", "COMPLIANCE", "GP", "ADMIN"])),
):
    _require_fund_access(fund_id, actor)
    try:
        tx = create_transaction(db, fund_id=fund_id, actor=actor, payload=payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"transaction_id": str(tx.id), "status": tx.status.value}


@router.post("/transactions/{tx_id}/submit")
def submit(
    fund_id: uuid.UUID,
    tx_id: uuid.UUID,
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
    fund_id: uuid.UUID,
    tx_id: uuid.UUID,
    payload: dict,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["GP", "ADMIN"])),
):
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
    fund_id: uuid.UUID,
    tx_id: uuid.UUID,
    payload: dict,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["INVESTMENT_TEAM", "ADMIN"])),
):
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


@router.post("/transactions/{tx_id}/approve")
def approve_any(
    fund_id: uuid.UUID,
    tx_id: uuid.UUID,
    payload: dict,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["INVESTMENT_TEAM", "GP", "ADMIN"])),
):
    """Unified approval endpoint.

    Payload:
      - approver_role: DIRECTOR | IC_MEMBER
      - approver_name: optional (defaults to actor_id)
      - comment: optional
      - evidence_blob_uri: optional
    """
    _require_fund_access(fund_id, actor)

    role = payload.get("approver_role") or payload.get("role")
    if role not in ("DIRECTOR", "IC_MEMBER"):
        raise HTTPException(status_code=400, detail="approver_role must be DIRECTOR or IC_MEMBER")

    actor_roles = set(getattr(actor, "roles", []) or [])
    if role == "DIRECTOR" and not ("GP" in actor_roles or "ADMIN" in actor_roles):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    if role == "IC_MEMBER" and not ("INVESTMENT_TEAM" in actor_roles or "ADMIN" in actor_roles):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    try:
        tx, appr = approve(
            db,
            fund_id=fund_id,
            actor=actor,
            tx_id=tx_id,
            approver_role=role,
            approver_name=str(payload.get("approver_name") or actor.actor_id),
            comment=payload.get("comment"),
            evidence_blob_uri=payload.get("evidence_blob_url") or payload.get("evidence_blob_uri"),
        )
        out = {"transaction_id": str(tx.id), "status": tx.status.value, "approval_id": str(appr.id)}
        if role == "IC_MEMBER":
            out["ic_approvals_count"] = int(tx.ic_approvals_count)
        return out
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/transactions/{tx_id}/reject")
def reject(
    fund_id: uuid.UUID,
    tx_id: uuid.UUID,
    payload: dict,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["INVESTMENT_TEAM", "GP", "ADMIN"])),
):
    _require_fund_access(fund_id, actor)
    try:
        tx = reject_transaction(db, fund_id=fund_id, actor=actor, tx_id=tx_id, comment=payload.get("comment"))
        return {"transaction_id": str(tx.id), "status": tx.status.value}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/transactions/{tx_id}/generate-instructions")
def gen_instructions(
    fund_id: uuid.UUID,
    tx_id: uuid.UUID,
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
    fund_id: uuid.UUID,
    tx_id: uuid.UUID,
    payload: dict,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["COMPLIANCE", "GP", "ADMIN"])),
):
    _require_fund_access(fund_id, actor)
    try:
        tx = mark_sent_to_admin(db, fund_id=fund_id, actor=actor, tx_id=tx_id, admin_contact=payload.get("admin_contact"))
        return {"transaction_id": str(tx.id), "status": tx.status.value, "sent_to_admin_at": tx.sent_to_admin_at.isoformat()}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/transactions/{tx_id}/mark-executed")
def mark_exec(
    fund_id: uuid.UUID,
    tx_id: uuid.UUID,
    payload: dict,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["COMPLIANCE", "GP", "ADMIN"])),
):
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


# Bank Statement Reconciliation Endpoints


@router.post("/statements/upload")
async def upload_statement(
    fund_id: uuid.UUID,
    period_start: str,
    period_end: str,
    file: UploadFile = File(...),
    notes: str | None = None,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["COMPLIANCE", "GP", "ADMIN"])),
):
    """
    Upload a bank statement for reconciliation.
    Stores statement metadata in registry and persists the file in blob storage (append-only evidence).
    """
    _require_fund_access(fund_id, actor)

    filename = (file.filename or "statement").strip()
    lower = filename.lower()
    allowed_ext = (".pdf", ".csv", ".xls", ".xlsx")
    if not any(lower.endswith(ext) for ext in allowed_ext):
        raise HTTPException(status_code=400, detail="Only PDF/CSV/XLS/XLSX files are allowed")

    try:
        ps = date.fromisoformat(period_start)
        pe = date.fromisoformat(period_end)

        data = await file.read()
        sha = hashlib.sha256(data).hexdigest()
        safe = "".join(c for c in filename if c.isalnum() or c in ("-", "_", "."))
        safe = safe or "statement"
        blob_name = f"{fund_id}/cash/statements/{sha}/{safe}"

        write_res = upload_bytes_idempotent(
            container=settings.AZURE_STORAGE_EVIDENCE_CONTAINER,
            blob_name=blob_name,
            data=data,
            content_type=file.content_type,
            metadata={"fund_id": str(fund_id), "sha256": sha, "source": "bank_statement"},
        )

        upload = upload_bank_statement(
            db,
            fund_id=fund_id,
            actor=actor,
            period_start=ps,
            period_end=pe,
            blob_path=write_res.blob_uri,
            original_filename=filename,
            sha256=sha,
            notes=notes,
        )
        return {
            "statement_id": str(upload.id),
            "period_start": upload.period_start.isoformat(),
            "period_end": upload.period_end.isoformat(),
            "blob_path": upload.blob_path,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/statements")
def list_statements(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["COMPLIANCE", "GP", "ADMIN", "AUDITOR"])),
):
    _require_fund_access(fund_id, actor)
    stmt = select(BankStatementUpload).where(BankStatementUpload.fund_id == fund_id).order_by(BankStatementUpload.uploaded_at.desc())
    items = list(db.execute(stmt).scalars().all())
    return {"items": [_statement_out(s) for s in items]}


@router.get("/statements/{statement_id}/lines")
def list_statement_lines(
    fund_id: uuid.UUID,
    statement_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["COMPLIANCE", "GP", "ADMIN", "AUDITOR"])),
):
    _require_fund_access(fund_id, actor)
    stmt = (
        select(BankStatementLine)
        .where(BankStatementLine.fund_id == fund_id, BankStatementLine.statement_id == statement_id)
        .order_by(BankStatementLine.value_date.asc())
    )
    lines = list(db.execute(stmt).scalars().all())
    return {"items": [_line_out(l) for l in lines]}


@router.post("/statements/{statement_id}/lines")
def add_line(
    fund_id: uuid.UUID,
    statement_id: uuid.UUID,
    payload: dict,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["COMPLIANCE", "GP", "ADMIN"])),
):
    """
    Add a manual statement line for reconciliation.
    """
    _require_fund_access(fund_id, actor)
    
    try:
        value_date = date.fromisoformat(payload["value_date"])
        direction = CashTransactionDirection(payload["direction"])
        
        line = add_statement_line(
            db,
            fund_id=fund_id,
            actor=actor,
            statement_id=statement_id,
            value_date=value_date,
            description=payload["description"],
            amount_usd=float(payload["amount_usd"]),
            direction=direction,
        )
        return {
            "line_id": str(line.id),
            "value_date": line.value_date.isoformat(),
            "amount_usd": float(line.amount_usd),
            "direction": line.direction.value,
            "reconciliation_status": line.reconciliation_status.value,
        }
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/reconcile")
def reconcile(
    fund_id: uuid.UUID,
    payload: dict,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["COMPLIANCE", "GP", "ADMIN"])),
):
    """
    Run reconciliation engine to match bank statement lines with transactions.
    """
    _require_fund_access(fund_id, actor)
    
    try:
        statement_id = uuid.UUID(payload["statement_id"]) if "statement_id" in payload else None
        date_tolerance_days = int(payload.get("date_tolerance_days", 5))
        
        result = match_statement_lines(
            db,
            fund_id=fund_id,
            actor=actor,
            statement_id=statement_id,
            date_tolerance_days=date_tolerance_days,
        )
        return result
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/reconciliation/report")
def reconciliation_report(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["COMPLIANCE", "GP", "ADMIN"])),
):
    """
    Get reconciliation report showing unmatched lines and unexplained transactions.
    """
    _require_fund_access(fund_id, actor)
    
    try:
        missing_tx = detect_missing_transactions(db, fund_id=fund_id)
        unexplained_outflows = detect_unexplained_outflows(db, fund_id=fund_id)
        
        return {
            "fund_id": str(fund_id),
            "unmatched_bank_lines": missing_tx,
            "unexplained_outflows": unexplained_outflows,
            "discrepancies_count": len(missing_tx) + len(unexplained_outflows),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

