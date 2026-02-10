from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.core.db.audit import write_audit_event
from app.core.security.auth import Actor
from app.domain.cash_management.enums import CashTransactionDirection, ReconciliationStatus
from app.domain.cash_management.models.bank_statements import BankStatementLine, BankStatementUpload
from app.domain.cash_management.models.cash import CashTransaction
from app.shared.utils import sa_model_to_dict


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def match_statement_lines(
    db: Session,
    *,
    fund_id: uuid.UUID,
    actor: Actor,
    statement_id: uuid.UUID | None = None,
    date_tolerance_days: int = 5,
) -> dict[str, Any]:
    """
    Reconciliation matching engine.
    
    Matches bank statement lines to cash transactions using:
    1. Exact amount match
    2. Date tolerance (±5 days by default)
    3. Reference code substring match (if available)
    
    Returns summary of matched, unmatched, and discrepancy counts.
    """
    # Get unmatched statement lines
    stmt_query = select(BankStatementLine).where(
        BankStatementLine.fund_id == fund_id,
        BankStatementLine.reconciliation_status == ReconciliationStatus.UNMATCHED,
    )
    if statement_id:
        stmt_query = stmt_query.where(BankStatementLine.statement_id == statement_id)
    
    lines = list(db.execute(stmt_query).scalars().all())
    
    matched_count = 0
    discrepancy_count = 0
    
    for line in lines:
        # Find matching transaction candidates
        date_min = line.value_date - timedelta(days=date_tolerance_days)
        date_max = line.value_date + timedelta(days=date_tolerance_days)
        
        tx_query = select(CashTransaction).where(
            and_(
                CashTransaction.fund_id == fund_id,
                CashTransaction.amount == abs(float(line.amount_usd)),
                CashTransaction.direction == line.direction,
                CashTransaction.status.in_(["EXECUTED", "SENT_TO_ADMIN"]),
                or_(
                    and_(
                        CashTransaction.execution_confirmed_at >= date_min,
                        CashTransaction.execution_confirmed_at <= date_max,
                    ),
                    and_(
                        CashTransaction.sent_to_admin_at >= date_min,
                        CashTransaction.sent_to_admin_at <= date_max,
                    ),
                ),
            )
        )
        
        candidates = list(db.execute(tx_query).scalars().all())
        
        # Prefer reference code match if available
        matched_tx = None
        if line.description and candidates:
            for tx in candidates:
                if tx.reference_code and tx.reference_code in line.description:
                    matched_tx = tx
                    break
                if tx.payment_reference and tx.payment_reference in line.description:
                    matched_tx = tx
                    break
        
        # Otherwise take first candidate
        if not matched_tx and candidates:
            matched_tx = candidates[0]
        
        if matched_tx:
            before = sa_model_to_dict(line)
            line.matched_transaction_id = matched_tx.id
            line.reconciliation_status = ReconciliationStatus.MATCHED
            line.reconciled_at = _utcnow()
            line.reconciled_by = actor.actor_id
            line.updated_by = actor.actor_id
            
            write_audit_event(
                db,
                fund_id=fund_id,
                actor_id=actor.actor_id,
                action="cash.reconciliation.match",
                entity_type="bank_statement_line",
                entity_id=line.id,
                before=before,
                after=sa_model_to_dict(line),
            )
            matched_count += 1
    
    db.commit()
    
    # Count remaining unmatched
    unmatched_query = select(BankStatementLine).where(
        BankStatementLine.fund_id == fund_id,
        BankStatementLine.reconciliation_status == ReconciliationStatus.UNMATCHED,
    )
    if statement_id:
        unmatched_query = unmatched_query.where(BankStatementLine.statement_id == statement_id)
    
    unmatched_count = db.execute(select(BankStatementLine).where(
        BankStatementLine.fund_id == fund_id,
        BankStatementLine.reconciliation_status == ReconciliationStatus.UNMATCHED,
    )).scalar_one_or_none()
    unmatched_count = len(list(db.execute(unmatched_query).scalars().all()))
    
    return {
        "matched": matched_count,
        "unmatched": unmatched_count,
        "discrepancies": discrepancy_count,
        "fund_id": str(fund_id),
    }


def detect_missing_transactions(db: Session, *, fund_id: uuid.UUID) -> list[dict[str, Any]]:
    """
    Find bank statement lines that have no matching transaction.
    These represent unexplained movements in the bank account.
    """
    query = select(BankStatementLine).where(
        BankStatementLine.fund_id == fund_id,
        BankStatementLine.reconciliation_status == ReconciliationStatus.UNMATCHED,
    )
    lines = list(db.execute(query).scalars().all())
    
    return [
        {
            "line_id": str(line.id),
            "value_date": line.value_date.isoformat(),
            "amount_usd": float(line.amount_usd),
            "direction": line.direction.value,
            "description": line.description,
        }
        for line in lines
    ]


def detect_unexplained_outflows(db: Session, *, fund_id: uuid.UUID) -> list[dict[str, Any]]:
    """
    Find executed transactions with no corresponding bank statement line.
    These may indicate execution delays or missing statements.
    """
    query = select(CashTransaction).where(
        CashTransaction.fund_id == fund_id,
        CashTransaction.status == "EXECUTED",
        CashTransaction.direction == CashTransactionDirection.OUTFLOW,
    )
    
    transactions = list(db.execute(query).scalars().all())
    
    unexplained = []
    for tx in transactions:
        # Check if any statement line references this transaction
        line_query = select(BankStatementLine).where(
            BankStatementLine.fund_id == fund_id,
            BankStatementLine.matched_transaction_id == tx.id,
        )
        if not db.execute(line_query).scalar_one_or_none():
            unexplained.append({
                "transaction_id": str(tx.id),
                "type": tx.type.value,
                "amount_usd": float(tx.amount),
                "executed_at": tx.execution_confirmed_at.isoformat() if tx.execution_confirmed_at else None,
                "reference_code": tx.reference_code,
            })
    
    return unexplained


def upload_bank_statement(
    db: Session,
    *,
    fund_id: uuid.UUID,
    actor: Actor,
    period_start: date,
    period_end: date,
    blob_path: str,
    original_filename: str | None = None,
    sha256: str | None = None,
    notes: str | None = None,
) -> BankStatementUpload:
    """
    Register a bank statement upload as immutable evidence.
    """
    upload = BankStatementUpload(
        fund_id=fund_id,
        access_level="internal",
        period_start=period_start,
        period_end=period_end,
        uploaded_by=actor.actor_id,
        uploaded_at=_utcnow(),
        blob_path=blob_path,
        original_filename=original_filename,
        sha256=sha256,
        notes=notes,
        created_by=actor.actor_id,
        updated_by=actor.actor_id,
    )
    db.add(upload)
    db.flush()
    
    write_audit_event(
        db,
        fund_id=fund_id,
        actor_id=actor.actor_id,
        action="cash.bank_statement.upload",
        entity_type="bank_statement_upload",
        entity_id=upload.id,
        before=None,
        after=sa_model_to_dict(upload),
    )
    
    db.commit()
    db.refresh(upload)
    return upload


def add_statement_line(
    db: Session,
    *,
    fund_id: uuid.UUID,
    actor: Actor,
    statement_id: uuid.UUID,
    value_date: date,
    description: str,
    amount_usd: float,
    direction: CashTransactionDirection,
) -> BankStatementLine:
    """
    Add a manual statement line entry.
    """
    line = BankStatementLine(
        fund_id=fund_id,
        access_level="internal",
        statement_id=statement_id,
        value_date=value_date,
        description=description,
        amount_usd=amount_usd,
        direction=direction,
        reconciliation_status=ReconciliationStatus.UNMATCHED,
        created_by=actor.actor_id,
        updated_by=actor.actor_id,
    )
    db.add(line)
    db.flush()
    
    write_audit_event(
        db,
        fund_id=fund_id,
        actor_id=actor.actor_id,
        action="cash.bank_statement_line.create",
        entity_type="bank_statement_line",
        entity_id=line.id,
        before=None,
        after=sa_model_to_dict(line),
    )
    
    db.commit()
    db.refresh(line)
    return line
