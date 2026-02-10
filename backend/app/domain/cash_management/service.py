from __future__ import annotations

import hashlib
import json
import uuid
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db.audit import write_audit_event
from app.core.security.auth import Actor
from app.domain.cash_management.enums import CashTransactionDirection, CashTransactionStatus, CashTransactionType
from app.domain.cash_management.models.cash import CashTransaction, CashTransactionApproval
from app.domain.cash_management.services.workflows import (
    validate_ready_for_approval,
    validate_usd_only,
    can_transition,
)
from app.services.blob_storage import upload_bytes_idempotent
from app.services.cash_instructions import generate_transfer_instruction_html
from app.shared.utils import sa_model_to_dict


USD = "USD"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _generate_reference_code(fund_id: uuid.UUID, tx_type: CashTransactionType) -> str:
    """
    Generate a human-friendly reference code for a transaction.
    Format: FUND-{type_code}-{timestamp}
    """
    type_code_map = {
        CashTransactionType.LP_SUBSCRIPTION: "SUB",
        CashTransactionType.CAPITAL_CALL: "CAP",
        CashTransactionType.FUND_EXPENSE: "EXP",
        CashTransactionType.INVESTMENT: "INV",
        CashTransactionType.TRANSFER_INTERNAL: "XFR",
        CashTransactionType.BANK_FEE: "FEE",
        CashTransactionType.OTHER: "OTH",
    }
    type_code = type_code_map.get(tx_type, "TXN")
    timestamp = _utcnow().strftime("%Y%m%d%H%M%S")
    fund_short = str(fund_id)[:8].upper()
    return f"{fund_short}-{type_code}-{timestamp}"


def _infer_direction(tx_type: CashTransactionType) -> CashTransactionDirection:
    """
    Automatically determine transaction direction based on type.
    """
    inflow_types = {
        CashTransactionType.LP_SUBSCRIPTION,
        CashTransactionType.CAPITAL_CALL,
    }
    if tx_type in inflow_types:
        return CashTransactionDirection.INFLOW
    return CashTransactionDirection.OUTFLOW


def _director_approvals(db: Session, *, fund_id: uuid.UUID, tx_id: uuid.UUID) -> list[CashTransactionApproval]:
    stmt = select(CashTransactionApproval).where(
        CashTransactionApproval.fund_id == fund_id,
        CashTransactionApproval.transaction_id == tx_id,
        CashTransactionApproval.approver_role == "DIRECTOR",
    )
    return list(db.execute(stmt).scalars().all())


def _ic_approvals(db: Session, *, fund_id: uuid.UUID, tx_id: uuid.UUID) -> list[CashTransactionApproval]:
    stmt = select(CashTransactionApproval).where(
        CashTransactionApproval.fund_id == fund_id,
        CashTransactionApproval.transaction_id == tx_id,
        CashTransactionApproval.approver_role == "IC_MEMBER",
    )
    return list(db.execute(stmt).scalars().all())


def create_transaction(
    db: Session,
    *,
    fund_id: uuid.UUID,
    actor: Actor,
    payload: dict[str, Any],
) -> CashTransaction:
    """
    Create a new cash transaction in DRAFT status.
    
    Governance rules enforced:
    - USD only (hard constraint)
    - Direction automatically inferred from type
    - Reference code auto-generated
    """
    validate_usd_only(payload.get("currency") or USD)

    value_date_raw = payload.get("value_date")
    if not value_date_raw:
        raise ValueError("value_date is required")
    if isinstance(value_date_raw, date):
        value_date = value_date_raw
    else:
        value_date = date.fromisoformat(str(value_date_raw))

    tx_type = CashTransactionType(payload["type"])
    direction = payload.get("direction")
    if not direction:
        direction = _infer_direction(tx_type)
    else:
        direction = CashTransactionDirection(direction)

    investment_memo_document_id = payload.get("investment_memo_document_id")
    if isinstance(investment_memo_document_id, str) and investment_memo_document_id:
        investment_memo_document_id = uuid.UUID(investment_memo_document_id)

    tx = CashTransaction(
        fund_id=fund_id,
        access_level="internal",
        type=tx_type,
        direction=direction,
        amount=payload["amount"],
        currency=USD,
        value_date=value_date,
        reference_code=_generate_reference_code(fund_id, tx_type),
        status=CashTransactionStatus.DRAFT,
        beneficiary_name=payload.get("beneficiary_name"),
        beneficiary_bank=payload.get("beneficiary_bank"),
        beneficiary_account=payload.get("beneficiary_account"),
        intermediary_bank=payload.get("intermediary_bank"),
        intermediary_swift=payload.get("intermediary_swift"),
        beneficiary_swift=payload.get("beneficiary_swift"),
        payment_reference=payload.get("payment_reference"),
        justification_text=payload.get("justification_text"),
        policy_basis=payload.get("policy_basis"),
        investment_memo_document_id=investment_memo_document_id,
        ic_approvals_count=0,
        ic_approval_evidence=None,
        notes=payload.get("notes"),
        created_by=actor.actor_id,
        updated_by=actor.actor_id,
    )
    db.add(tx)
    db.flush()

    write_audit_event(
        db,
        fund_id=fund_id,
        actor_id=actor.actor_id,
        action="CASH_TRANSACTION_CREATED",
        entity_type="cash_transaction",
        entity_id=tx.id,
        before=None,
        after=sa_model_to_dict(tx),
    )
    db.commit()
    db.refresh(tx)
    return tx
def submit_transaction(db: Session, *, fund_id: uuid.UUID, actor: Actor, tx_id: uuid.UUID) -> CashTransaction:
    """
    Move transaction from DRAFT to PENDING_APPROVAL.
    """
    tx = db.execute(select(CashTransaction).where(CashTransaction.fund_id == fund_id, CashTransaction.id == tx_id)).scalar_one()
    
    allowed, error = can_transition(db, tx=tx, to_status=CashTransactionStatus.PENDING_APPROVAL)
    if not allowed:
        raise ValueError(error)
    
    before = sa_model_to_dict(tx)
    tx.status = CashTransactionStatus.PENDING_APPROVAL
    tx.updated_by = actor.actor_id
    
    write_audit_event(
        db,
        fund_id=fund_id,
        actor_id=actor.actor_id,
        action="CASH_TRANSACTION_SUBMITTED",
        entity_type="cash_transaction",
        entity_id=tx.id,
        before=before,
        after=sa_model_to_dict(tx),
    )
    db.commit()
    db.refresh(tx)
    return tx


def reject_transaction(
    db: Session,
    *,
    fund_id: uuid.UUID,
    actor: Actor,
    tx_id: uuid.UUID,
    comment: str | None,
) -> CashTransaction:
    """Move transaction to REJECTED.

    The rejection rationale is preserved as an append-only audit event payload.
    """
    tx = db.execute(select(CashTransaction).where(CashTransaction.fund_id == fund_id, CashTransaction.id == tx_id)).scalar_one()

    allowed, error = can_transition(db, tx=tx, to_status=CashTransactionStatus.REJECTED)
    if not allowed:
        raise ValueError(error)

    before = sa_model_to_dict(tx)
    tx.status = CashTransactionStatus.REJECTED
    tx.updated_by = actor.actor_id

    write_audit_event(
        db,
        fund_id=fund_id,
        actor_id=actor.actor_id,
        action="CASH_TRANSACTION_REJECTED",
        entity_type="cash_transaction",
        entity_id=tx.id,
        before=before,
        after={**sa_model_to_dict(tx), "reject_comment": comment},
    )

    db.commit()
    db.refresh(tx)
    return tx


def approve(
    db: Session,
    *,
    fund_id: uuid.UUID,
    actor: Actor,
    tx_id: uuid.UUID,
    approver_role: str,
    approver_name: str,
    comment: str | None,
    evidence_blob_uri: str | None,
) -> tuple[CashTransaction, CashTransactionApproval]:
    """
    Add an approval (director or IC member).
    
    Auto-approves transaction when governance requirements are met:
    - 2 director signatures (always required)
    - 2 IC approvals (for investments only)
    """
    tx = db.execute(select(CashTransaction).where(CashTransaction.fund_id == fund_id, CashTransaction.id == tx_id)).scalar_one()

    if tx.status not in (CashTransactionStatus.PENDING_APPROVAL, CashTransactionStatus.DRAFT):
        raise ValueError("Approvals only allowed before APPROVED")

    # Prevent duplicate sign-off by same name+role
    exists_stmt = select(CashTransactionApproval).where(
        CashTransactionApproval.fund_id == fund_id,
        CashTransactionApproval.transaction_id == tx_id,
        CashTransactionApproval.approver_role == approver_role,
        CashTransactionApproval.approver_name == approver_name,
    )
    if db.execute(exists_stmt).scalar_one_or_none():
        raise ValueError("Duplicate approval for this approver")

    appr = CashTransactionApproval(
        fund_id=fund_id,
        access_level="internal",
        transaction_id=tx_id,
        approver_role=approver_role,
        approver_name=approver_name,
        approved_at=_utcnow(),
        evidence_blob_uri=evidence_blob_uri,
        comment=comment,
        created_by=actor.actor_id,
        updated_by=actor.actor_id,
    )
    db.add(appr)
    db.flush()

    audit_action = "IC_APPROVAL_ADDED" if approver_role == "IC_MEMBER" else "DIRECTOR_SIGNED"
    write_audit_event(
        db,
        fund_id=fund_id,
        actor_id=actor.actor_id,
        action=audit_action,
        entity_type="cash_transaction_approval",
        entity_id=appr.id,
        before=None,
        after=sa_model_to_dict(appr),
    )

    # Also emit an event on the transaction itself so callers can query audit by tx.id.
    if approver_role == "DIRECTOR":
        write_audit_event(
            db,
            fund_id=fund_id,
            actor_id=actor.actor_id,
            action="DIRECTOR_SIGNED",
            entity_type="cash_transaction",
            entity_id=tx.id,
            before=None,
            after=sa_model_to_dict(tx),
        )

    # Update derived IC approvals count
    if approver_role == "IC_MEMBER":
        ic = _ic_approvals(db, fund_id=fund_id, tx_id=tx_id)
        tx_before = sa_model_to_dict(tx)
        tx.ic_approvals_count = len({a.approver_name for a in ic})
        tx.updated_by = actor.actor_id
        write_audit_event(
            db,
            fund_id=fund_id,
            actor_id=actor.actor_id,
            action="cash.transaction.update_ic_count",
            entity_type="cash_transaction",
            entity_id=tx.id,
            before=tx_before,
            after=sa_model_to_dict(tx),
        )

    # Auto-approve when governance constraints satisfied
    dir_apprs = _director_approvals(db, fund_id=fund_id, tx_id=tx_id)
    if len({a.approver_name for a in dir_apprs}) >= 2:
        try:
            validate_ready_for_approval(db, tx=tx)
        except ValueError:
            # Governance validation failed, don't auto-approve
            pass
        else:
            if tx.status != CashTransactionStatus.APPROVED:
                tx_before = sa_model_to_dict(tx)

                # Evidence bundle JSON (immutable proof)
                bundle = {
                    "transaction": sa_model_to_dict(tx),
                    "approvals": [sa_model_to_dict(a) for a in (dir_apprs + _ic_approvals(db, fund_id=fund_id, tx_id=tx_id))],
                    "normative_rules": {
                        "usd_only": True,
                        "director_signoffs_required": 2,
                        "investment_ic_rule": ">=2 of 3 IC members",
                        "cash_management_no_ic_rule": "Investment Committee approval is not required for cash management.",
                    },
                    "generated_at_utc": _utcnow().isoformat(),
                }
                blob_name = f"{fund_id}/cash/transactions/{tx_id}/evidence_bundle.json"
                data = json.dumps(bundle, ensure_ascii=False, indent=2).encode("utf-8")
                sha = hashlib.sha256(data).hexdigest()
                res = upload_bytes_idempotent(
                    container=settings.AZURE_STORAGE_EVIDENCE_CONTAINER,
                    blob_name=blob_name,
                    data=data,
                    content_type="application/json",
                    metadata={"fund_id": str(fund_id), "transaction_id": str(tx_id), "kind": "cash_evidence_bundle"},
                )

                tx.status = CashTransactionStatus.APPROVED
                tx.updated_by = actor.actor_id
                tx.evidence_bundle_blob_uri = res.blob_uri
                tx.evidence_bundle_sha256 = sha

                write_audit_event(
                    db,
                    fund_id=fund_id,
                    actor_id=actor.actor_id,
                    action="CASH_TRANSACTION_APPROVED",
                    entity_type="cash_transaction",
                    entity_id=tx.id,
                    before=tx_before,
                    after=sa_model_to_dict(tx),
                )

    db.commit()
    db.refresh(tx)
    db.refresh(appr)
    return tx, appr


def generate_instructions(db: Session, *, fund_id: uuid.UUID, actor: Actor, tx_id: uuid.UUID) -> CashTransaction:
    """
    Generate wire instruction pack for Zedra.
    Only allowed when transaction is APPROVED.
    """
    tx = db.execute(select(CashTransaction).where(CashTransaction.fund_id == fund_id, CashTransaction.id == tx_id)).scalar_one()
    if tx.status != CashTransactionStatus.APPROVED:
        raise ValueError("Instructions can only be generated when APPROVED")

    approvals = _director_approvals(db, fund_id=fund_id, tx_id=tx_id) + _ic_approvals(db, fund_id=fund_id, tx_id=tx_id)
    pkg = generate_transfer_instruction_html(
        tx={
            "id": str(tx.id),
            "type": tx.type.value,
            "amount": str(tx.amount),
            "payment_reference": tx.payment_reference,
            "beneficiary_name": tx.beneficiary_name,
        },
        approvals=[
            {"approver_role": a.approver_role, "approver_name": a.approver_name, "approved_at": a.approved_at.isoformat()}
            for a in approvals
        ],
    )
    blob_name = f"{fund_id}/cash/transactions/{tx_id}/transfer_instruction.html"
    res = upload_bytes_idempotent(
        container=settings.AZURE_STORAGE_EVIDENCE_CONTAINER,
        blob_name=blob_name,
        data=pkg.html.encode("utf-8"),
        content_type="text/html; charset=utf-8",
        metadata={"fund_id": str(fund_id), "transaction_id": str(tx_id), "kind": "transfer_instruction_html"},
    )
    before = sa_model_to_dict(tx)
    tx.instructions_blob_uri = res.blob_uri
    tx.updated_by = actor.actor_id
    write_audit_event(
        db,
        fund_id=fund_id,
        actor_id=actor.actor_id,
        action="cash.transaction.generate_instructions",
        entity_type="cash_transaction",
        entity_id=tx.id,
        before=before,
        after=sa_model_to_dict(tx),
    )
    db.commit()
    db.refresh(tx)
    return tx


def mark_sent_to_admin(
    db: Session,
    *,
    fund_id: uuid.UUID,
    actor: Actor,
    tx_id: uuid.UUID,
    admin_contact: str | None,
) -> CashTransaction:
    """
    Mark transaction as sent to administrator (Zedra).
    Must have 2 director signatures before sending.
    """
    tx = db.execute(select(CashTransaction).where(CashTransaction.fund_id == fund_id, CashTransaction.id == tx_id)).scalar_one()
    
    allowed, error = can_transition(db, tx=tx, to_status=CashTransactionStatus.SENT_TO_ADMIN)
    if not allowed:
        raise ValueError(error)
    
    before = sa_model_to_dict(tx)
    tx.status = CashTransactionStatus.SENT_TO_ADMIN
    tx.sent_to_admin_at = _utcnow()
    tx.admin_contact = admin_contact
    tx.updated_by = actor.actor_id
    
    write_audit_event(
        db,
        fund_id=fund_id,
        actor_id=actor.actor_id,
        action="TRANSACTION_SENT_TO_ADMIN",
        entity_type="cash_transaction",
        entity_id=tx.id,
        before=before,
        after=sa_model_to_dict(tx),
    )
    db.commit()
    db.refresh(tx)
    return tx


def mark_executed(
    db: Session,
    *,
    fund_id: uuid.UUID,
    actor: Actor,
    tx_id: uuid.UUID,
    bank_reference: str | None,
    notes: str | None,
) -> CashTransaction:
    """
    Mark transaction as executed by the bank.
    Final confirmation step.
    """
    tx = db.execute(select(CashTransaction).where(CashTransaction.fund_id == fund_id, CashTransaction.id == tx_id)).scalar_one()
    
    allowed, error = can_transition(db, tx=tx, to_status=CashTransactionStatus.EXECUTED)
    if not allowed:
        raise ValueError(error)
    
    before = sa_model_to_dict(tx)
    tx.status = CashTransactionStatus.EXECUTED
    tx.execution_confirmed_at = _utcnow()
    tx.bank_reference = bank_reference
    if notes:
        tx.notes = (tx.notes or "") + ("\n" if tx.notes else "") + notes
    tx.updated_by = actor.actor_id
    
    write_audit_event(
        db,
        fund_id=fund_id,
        actor_id=actor.actor_id,
        action="TRANSACTION_EXECUTED",
        entity_type="cash_transaction",
        entity_id=tx.id,
        before=before,
        after=sa_model_to_dict(tx),
    )
    db.commit()
    db.refresh(tx)
    return tx

