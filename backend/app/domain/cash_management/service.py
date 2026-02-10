from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db.audit import write_audit_event
from app.core.security.auth import Actor
from app.domain.cash_management.enums import CashTransactionStatus, CashTransactionType
from app.domain.cash_management.models.cash import CashTransaction, CashTransactionApproval
from app.services.blob_storage import upload_bytes_idempotent
from app.services.cash_instructions import generate_transfer_instruction_html
from app.shared.utils import sa_model_to_dict


USD = "USD"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _require_usd(currency: str | None) -> None:
    if (currency or USD) != USD:
        raise ValueError("Only USD is allowed")


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


def _validate_ready_for_approval(db: Session, *, tx: CashTransaction) -> None:
    _require_usd(tx.currency)

    if tx.type == CashTransactionType.EXPENSE:
        if not (tx.justification_text and tx.justification_text.strip()):
            raise ValueError("EXPENSE requires justification_text")
        if not tx.policy_basis or not isinstance(tx.policy_basis, list) or len(tx.policy_basis) == 0:
            raise ValueError("EXPENSE requires policy_basis citations (Offering Memorandum excerpts)")

    if tx.type == CashTransactionType.INVESTMENT:
        if not tx.investment_memo_document_id:
            raise ValueError("INVESTMENT requires investment_memo_document_id")
        # Internal rule: >=2 of 3
        ic = _ic_approvals(db, fund_id=tx.fund_id, tx_id=tx.id)
        if len({a.approver_name for a in ic}) < 2:
            raise ValueError("INVESTMENT requires IC approvals >=2 (2/3 rule)")

    if tx.type == CashTransactionType.CASH_MANAGEMENT:
        # Normative basis hard-coded
        # "Investment Committee approval is not required for cash management."
        pass


def create_transaction(
    db: Session,
    *,
    fund_id: uuid.UUID,
    actor: Actor,
    payload: dict[str, Any],
) -> CashTransaction:
    _require_usd(payload.get("currency") or USD)

    tx = CashTransaction(
        fund_id=fund_id,
        access_level="internal",
        type=CashTransactionType(payload["type"]),
        amount=payload["amount"],
        currency=USD,
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
        investment_memo_document_id=payload.get("investment_memo_document_id"),
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
        action="cash.transaction.create",
        entity_type="cash_transaction",
        entity_id=tx.id,
        before=None,
        after=sa_model_to_dict(tx),
    )
    db.commit()
    db.refresh(tx)
    return tx


def submit_transaction(db: Session, *, fund_id: uuid.UUID, actor: Actor, tx_id: uuid.UUID) -> CashTransaction:
    tx = db.execute(select(CashTransaction).where(CashTransaction.fund_id == fund_id, CashTransaction.id == tx_id)).scalar_one()
    if tx.status != CashTransactionStatus.DRAFT:
        raise ValueError("Only DRAFT can be submitted")
    before = sa_model_to_dict(tx)
    tx.status = CashTransactionStatus.PENDING_APPROVAL
    tx.updated_by = actor.actor_id
    write_audit_event(
        db,
        fund_id=fund_id,
        actor_id=actor.actor_id,
        action="cash.transaction.submit",
        entity_type="cash_transaction",
        entity_id=tx.id,
        before=before,
        after=sa_model_to_dict(tx),
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

    write_audit_event(
        db,
        fund_id=fund_id,
        actor_id=actor.actor_id,
        action="cash.approval.create",
        entity_type="cash_transaction_approval",
        entity_id=appr.id,
        before=None,
        after=sa_model_to_dict(appr),
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

    # Auto-approve when governance constraints satisfied (2 directors + extra rules)
    dir_apprs = _director_approvals(db, fund_id=fund_id, tx_id=tx_id)
    if len({a.approver_name for a in dir_apprs}) >= 2:
        _validate_ready_for_approval(db, tx=tx)
        if tx.status != CashTransactionStatus.APPROVED:
            tx_before = sa_model_to_dict(tx)
            tx.status = CashTransactionStatus.APPROVED
            tx.updated_by = actor.actor_id

            # Evidence bundle JSON must exist for each approved transaction
            bundle = {
                "transaction": sa_model_to_dict(tx),
                "approvals": [sa_model_to_dict(a) for a in (dir_apprs + _ic_approvals(db, fund_id=fund_id, tx_id=tx_id))],
                "normative_rules": {
                    "usd_only": True,
                    "director_signoffs_required": 2,
                    "investment_ic_rule": ">=2 of 3 (internal rule)",
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
            tx.evidence_bundle_blob_uri = res.blob_uri
            tx.evidence_bundle_sha256 = sha

            write_audit_event(
                db,
                fund_id=fund_id,
                actor_id=actor.actor_id,
                action="cash.transaction.approve",
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
    tx = db.execute(select(CashTransaction).where(CashTransaction.fund_id == fund_id, CashTransaction.id == tx_id)).scalar_one()
    if tx.status != CashTransactionStatus.APPROVED:
        raise ValueError("Instructions can only be generated when APPROVED")

    approvals = _director_approvals(db, fund_id=fund_id, tx_id=tx_id) + _ic_approvals(db, fund_id=fund_id, tx_id=tx_id)
    pkg = generate_transfer_instruction_html(
        tx={"id": str(tx.id), "type": tx.type.value, "amount": str(tx.amount), "payment_reference": tx.payment_reference, "beneficiary_name": tx.beneficiary_name},
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
    tx = db.execute(select(CashTransaction).where(CashTransaction.fund_id == fund_id, CashTransaction.id == tx_id)).scalar_one()
    if tx.status != CashTransactionStatus.APPROVED:
        raise ValueError("Only APPROVED can be marked as sent")
    before = sa_model_to_dict(tx)
    tx.status = CashTransactionStatus.SENT_TO_ADMIN
    tx.sent_to_admin_at = _utcnow()
    tx.admin_contact = admin_contact
    tx.updated_by = actor.actor_id
    write_audit_event(
        db,
        fund_id=fund_id,
        actor_id=actor.actor_id,
        action="cash.transaction.mark_sent",
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
    tx = db.execute(select(CashTransaction).where(CashTransaction.fund_id == fund_id, CashTransaction.id == tx_id)).scalar_one()
    if tx.status != CashTransactionStatus.SENT_TO_ADMIN:
        raise ValueError("Only SENT_TO_ADMIN can be marked as executed")
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
        action="cash.transaction.mark_executed",
        entity_type="cash_transaction",
        entity_id=tx.id,
        before=before,
        after=sa_model_to_dict(tx),
    )
    db.commit()
    db.refresh(tx)
    return tx

