from __future__ import annotations

import datetime as dt
import hashlib
import json
import uuid
from decimal import Decimal

from fastapi import HTTPException, status
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db.audit import write_audit_event
from app.core.security.auth import Actor
from app.domain.cash_management.enums import CashTransactionStatus
from app.domain.cash_management.models.cash import CashTransaction, CashTransactionApproval
from app.domain.cash_management.service import approve as cash_approve
from app.domain.cash_management.service import reject_transaction as cash_reject
from app.modules.documents.models import Document
from app.shared.utils import sa_model_to_dict


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _normalize_type(tx: CashTransaction) -> str:
    t = getattr(tx.type, "value", None) or str(tx.type)
    if t in ("FUND_EXPENSE", "BANK_FEE"):
        return "EXPENSE"
    if t == "INVESTMENT":
        return "INVESTMENT"
    return "OTHER"


def _director_signatures(db: Session, *, fund_id: uuid.UUID, tx_id: uuid.UUID) -> list[CashTransactionApproval]:
    stmt = select(CashTransactionApproval).where(
        CashTransactionApproval.fund_id == fund_id,
        CashTransactionApproval.transaction_id == tx_id,
        CashTransactionApproval.approver_role == "DIRECTOR",
    ).order_by(CashTransactionApproval.approved_at.asc())
    return list(db.execute(stmt).scalars().all())


def _signature_status(tx: CashTransaction, director_count: int) -> str:
    if tx.status == CashTransactionStatus.REJECTED:
        return "REJECTED"
    if tx.status == CashTransactionStatus.CANCELLED:
        return "CANCELLED"
    if tx.status == CashTransactionStatus.EXECUTED:
        return "EXECUTED"
    if tx.status == CashTransactionStatus.DRAFT:
        return "DRAFT"
    # Pending approval/approved/sent_to_admin map to signature workflow states
    if director_count >= 2 or tx.status in (CashTransactionStatus.APPROVED, CashTransactionStatus.SENT_TO_ADMIN):
        return "SIGNED"
    return "PENDING"


def _amount_str(v) -> str:
    if v is None:
        return "0"
    if isinstance(v, Decimal):
        return str(v)
    return str(v)


def _evidence_doc_ids(tx: CashTransaction) -> list[uuid.UUID]:
    ids: list[uuid.UUID] = []
    if tx.investment_memo_document_id:
        ids.append(tx.investment_memo_document_id)
    basis = tx.policy_basis or []
    if isinstance(basis, list):
        for item in basis:
            if not isinstance(item, dict):
                continue
            did = item.get("document_id") or item.get("doc_id")
            if did:
                try:
                    ids.append(uuid.UUID(str(did)))
                except Exception:
                    continue
    # De-dupe preserving order
    seen: set[uuid.UUID] = set()
    out: list[uuid.UUID] = []
    for i in ids:
        if i in seen:
            continue
        seen.add(i)
        out.append(i)
    return out


def build_detail(db: Session, *, fund_id: uuid.UUID, tx: CashTransaction) -> dict:
    sigs = _director_signatures(db, fund_id=fund_id, tx_id=tx.id)
    director_count = len({a.approver_name for a in sigs})
    status_norm = _signature_status(tx, director_count)

    # Evidence derived only from backend-authoritative pointers.
    doc_ids = _evidence_doc_ids(tx)
    docs: list[Document] = []
    if doc_ids:
        docs = list(
            db.execute(select(Document).where(Document.fund_id == fund_id, Document.id.in_(doc_ids))).scalars().all()
        )
    by_id = {d.id: d for d in docs}

    evidence = []
    for did in doc_ids:
        d = by_id.get(did)
        evidence.append({
            "document_id": did,
            "title": d.title if d else "(missing document)",
            "source_blob": d.blob_uri if d else None,
        })

    signatures = [
        {
            "director_id": a.approver_name,
            "director_name": a.approver_name,
            "status": "SIGNED",
            "signed_at_utc": a.approved_at,
            "comment": a.comment,
        }
        for a in sigs
    ]

    request = {
        "id": tx.id,
        "status": status_norm,
        "type": _normalize_type(tx),
        "amount_usd": _amount_str(tx.amount),
        "beneficiary_name": tx.beneficiary_name,
        "beneficiary_bank": tx.beneficiary_bank,
        "beneficiary_account": tx.beneficiary_account,
        "purpose": tx.justification_text or tx.payment_reference,
        "linked_entity_ref": tx.reference_code or tx.payment_reference,
        "created_at_utc": tx.created_at,
        "deadline_utc": None,
        "required_signatures_count": 2,
        "current_signatures_count": director_count,
        "investment_memo_status": "LINKED" if tx.investment_memo_document_id else "MISSING",
        "committee_votes_summary": "N/A",
    }

    return {"request": request, "evidence": evidence, "signatures": signatures}


def list_requests(db: Session, *, fund_id: uuid.UUID, limit: int, offset: int) -> list[dict]:
    stmt = (
        select(CashTransaction)
        .where(CashTransaction.fund_id == fund_id)
        .order_by(CashTransaction.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    txs = list(db.execute(stmt).scalars().all())

    items: list[dict] = []
    for tx in txs:
        sigs = _director_signatures(db, fund_id=fund_id, tx_id=tx.id)
        director_count = len({a.approver_name for a in sigs})
        items.append(
            {
                "id": tx.id,
                "status": _signature_status(tx, director_count),
                "type": _normalize_type(tx),
                "amount_usd": _amount_str(tx.amount),
                "beneficiary_name": tx.beneficiary_name,
                "beneficiary_bank": tx.beneficiary_bank,
                "beneficiary_account": tx.beneficiary_account,
                "purpose": tx.justification_text or tx.payment_reference,
                "linked_entity_ref": tx.reference_code or tx.payment_reference,
                "created_at_utc": tx.created_at,
                "deadline_utc": None,
                "required_signatures_count": 2,
                "current_signatures_count": director_count,
                "investment_memo_status": "LINKED" if tx.investment_memo_document_id else "MISSING",
                "committee_votes_summary": "N/A",
            }
        )

    return items


def sign(db: Session, *, fund_id: uuid.UUID, actor: Actor, tx_id: uuid.UUID, comment: str | None) -> dict:
    tx = db.execute(select(CashTransaction).where(CashTransaction.fund_id == fund_id, CashTransaction.id == tx_id)).scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signature request not found")

    if tx.status in (CashTransactionStatus.REJECTED, CashTransactionStatus.CANCELLED, CashTransactionStatus.EXECUTED):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request is not signable in current state")

    # Evidence block enforced by backend (no client-side bypass).
    doc_ids = _evidence_doc_ids(tx)
    if not doc_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing supporting evidence")

    # Ensure 2 distinct directors max.
    existing = _director_signatures(db, fund_id=fund_id, tx_id=tx.id)
    distinct = {a.approver_name for a in existing}
    if len(distinct) >= 2:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already has required director signatures")

    try:
        tx, appr = cash_approve(
            db,
            fund_id=fund_id,
            actor=actor,
            tx_id=tx.id,
            approver_role="DIRECTOR",
            approver_name=actor.actor_id,
            comment=comment,
            evidence_blob_uri=None,
        )
    except ValueError as e:
        # Preserve deterministic governance errors from cash workflow.
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # Also emit an event on the request entity.
    write_audit_event(
        db,
        fund_id=fund_id,
        actor_id=actor.actor_id,
        action="DIRECTOR_SIGNED",
        entity_type="signature_request",
        entity_id=tx.id,
        before=None,
        after={"tx_id": str(tx.id), "director_id": actor.actor_id},
    )

    db.commit()
    db.refresh(tx)
    db.refresh(appr)
    return build_detail(db, fund_id=fund_id, tx=tx)


def reject(db: Session, *, fund_id: uuid.UUID, actor: Actor, tx_id: uuid.UUID, reason: str) -> dict:
    tx = db.execute(select(CashTransaction).where(CashTransaction.fund_id == fund_id, CashTransaction.id == tx_id)).scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signature request not found")

    if tx.status in (CashTransactionStatus.CANCELLED, CashTransactionStatus.EXECUTED):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request is not rejectable in current state")

    before = sa_model_to_dict(tx)

    try:
        tx = cash_reject(db, fund_id=fund_id, actor=actor, tx_id=tx.id, comment=reason)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    write_audit_event(
        db,
        fund_id=fund_id,
        actor_id=actor.actor_id,
        action="SIGNATURE_REQUEST_REJECTED",
        entity_type="signature_request",
        entity_id=tx.id,
        before=before,
        after={**sa_model_to_dict(tx), "reject_reason": reason},
    )

    db.commit()
    db.refresh(tx)
    return build_detail(db, fund_id=fund_id, tx=tx)


def generate_execution_pack(db: Session, *, fund_id: uuid.UUID, actor: Actor, tx_id: uuid.UUID) -> dict:
    tx = db.execute(select(CashTransaction).where(CashTransaction.fund_id == fund_id, CashTransaction.id == tx_id)).scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signature request not found")

    sigs = _director_signatures(db, fund_id=fund_id, tx_id=tx.id)
    distinct = {a.approver_name for a in sigs}
    if len(distinct) < 2:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Execution pack requires 2 distinct director signatures")

    detail = build_detail(db, fund_id=fund_id, tx=tx)

    manifest = {
        "kind": "BANK_EXECUTION_PACK",
        "fund_id": str(fund_id),
        "request_id": str(tx.id),
        "generated_at_utc": _utcnow().isoformat(),
        "generated_by": actor.actor_id,
        "request": detail["request"],
        "evidence": detail["evidence"],
        "signatures": detail["signatures"],
        "normative_rules": {
            "usd_only": True,
            "director_signoffs_required": 2,
            "no_silent_fallback": True,
        },
    }

    manifest_encoded = jsonable_encoder(manifest)
    data = json.dumps(manifest_encoded, ensure_ascii=False, indent=2).encode("utf-8")
    sha = hashlib.sha256(data).hexdigest()

    write_audit_event(
        db,
        fund_id=fund_id,
        actor_id=actor.actor_id,
        action="EXECUTION_PACK_GENERATED",
        entity_type="signature_request",
        entity_id=tx.id,
        before=None,
        after={"sha256": sha, "bytes": len(data)},
    )

    db.commit()
    return {**manifest_encoded, "sha256": sha}
