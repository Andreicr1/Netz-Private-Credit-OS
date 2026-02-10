from __future__ import annotations

import uuid
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.cash_management.enums import CashTransactionStatus, CashTransactionType
from app.domain.cash_management.models.cash import CashTransaction, CashTransactionApproval


USD = "USD"


def _director_approvals(db: Session, *, fund_id: uuid.UUID, tx_id: uuid.UUID) -> list[CashTransactionApproval]:
    """Get all director approvals for a transaction."""
    stmt = select(CashTransactionApproval).where(
        CashTransactionApproval.fund_id == fund_id,
        CashTransactionApproval.transaction_id == tx_id,
        CashTransactionApproval.approver_role == "DIRECTOR",
    )
    return list(db.execute(stmt).scalars().all())


def _ic_approvals(db: Session, *, fund_id: uuid.UUID, tx_id: uuid.UUID) -> list[CashTransactionApproval]:
    """Get all Investment Committee approvals for a transaction."""
    stmt = select(CashTransactionApproval).where(
        CashTransactionApproval.fund_id == fund_id,
        CashTransactionApproval.transaction_id == tx_id,
        CashTransactionApproval.approver_role == "IC_MEMBER",
    )
    return list(db.execute(stmt).scalars().all())


def validate_usd_only(currency: str | None) -> None:
    """
    Governance rule: Only USD is allowed.
    Hard-fail for any other currency.
    """
    if (currency or USD) != USD:
        raise ValueError("GOVERNANCE VIOLATION: Only USD transactions are allowed")


def validate_expense_governance(db: Session, *, tx: CashTransaction) -> None:
    """
    Expense governance rules:
    - Must have justification_text
    - Must have policy_basis (Offering Memorandum citations)
    """
    if tx.type in [CashTransactionType.FUND_EXPENSE, CashTransactionType.EXPENSE]:
        if not (tx.justification_text and tx.justification_text.strip()):
            raise ValueError("GOVERNANCE VIOLATION: EXPENSE requires justification_text")
        
        if not tx.policy_basis or not isinstance(tx.policy_basis, list) or len(tx.policy_basis) == 0:
            raise ValueError("GOVERNANCE VIOLATION: EXPENSE requires policy_basis (Offering Memorandum citations)")


def validate_investment_governance(db: Session, *, tx: CashTransaction) -> None:
    """
    Investment governance rules:
    - Must have Investment Memo attached
    - Must have >= 2 IC approvals (2/3 rule)
    """
    if tx.type == CashTransactionType.INVESTMENT:
        if not tx.investment_memo_document_id:
            raise ValueError("GOVERNANCE VIOLATION: INVESTMENT requires investment_memo_document_id")
        
        # IC approval requirement: >= 2 of 3
        ic = _ic_approvals(db, fund_id=tx.fund_id, tx_id=tx.id)
        unique_ic_approvers = len({a.approver_name for a in ic})
        if unique_ic_approvers < 2:
            raise ValueError(f"GOVERNANCE VIOLATION: INVESTMENT requires >= 2 IC approvals (found {unique_ic_approvers})")


def validate_dual_signature_requirement(db: Session, *, tx: CashTransaction) -> None:
    """
    Execution governance rule:
    - Must have >= 2 director signatures before sending to admin
    """
    directors = _director_approvals(db, fund_id=tx.fund_id, tx_id=tx.id)
    unique_directors = len({a.approver_name for a in directors})
    if unique_directors < 2:
        raise ValueError(f"GOVERNANCE VIOLATION: Execution requires 2 director signatures (found {unique_directors})")


def validate_ready_for_approval(db: Session, *, tx: CashTransaction) -> None:
    """
    Combined validation before moving from PENDING_APPROVAL to APPROVED.
    
    This enforces all governance rules:
    - USD only
    - Type-specific justification requirements
    - IC approval for investments
    - Dual signature requirement
    """
    validate_usd_only(tx.currency)
    validate_expense_governance(db, tx=tx)
    validate_investment_governance(db, tx=tx)
    validate_dual_signature_requirement(db, tx=tx)


def can_transition(
    db: Session,
    *,
    tx: CashTransaction,
    to_status: CashTransactionStatus,
) -> tuple[bool, str | None]:
    """
    Check if a transaction can transition to a new status.
    
    Returns:
        (allowed, error_message)
    """
    current = tx.status
    
    # Define valid state transitions (finite state machine)
    valid_transitions = {
        CashTransactionStatus.DRAFT: [
            CashTransactionStatus.PENDING_APPROVAL,
            CashTransactionStatus.CANCELLED,
        ],
        CashTransactionStatus.PENDING_APPROVAL: [
            CashTransactionStatus.APPROVED,
            CashTransactionStatus.REJECTED,
            CashTransactionStatus.CANCELLED,
        ],
        CashTransactionStatus.APPROVED: [
            CashTransactionStatus.SENT_TO_ADMIN,
            CashTransactionStatus.CANCELLED,
        ],
        CashTransactionStatus.SENT_TO_ADMIN: [
            CashTransactionStatus.EXECUTED,
        ],
        CashTransactionStatus.EXECUTED: [],  # Terminal state
        CashTransactionStatus.REJECTED: [],  # Terminal state
        CashTransactionStatus.CANCELLED: [],  # Terminal state
    }
    
    if to_status not in valid_transitions.get(current, []):
        return False, f"Invalid transition: {current.value} → {to_status.value}"
    
    # Additional governance checks for specific transitions
    if to_status == CashTransactionStatus.APPROVED:
        try:
            validate_ready_for_approval(db, tx=tx)
        except ValueError as e:
            return False, str(e)
    
    if to_status == CashTransactionStatus.SENT_TO_ADMIN:
        try:
            validate_dual_signature_requirement(db, tx=tx)
        except ValueError as e:
            return False, str(e)
    
    return True, None


def get_required_approvals(tx: CashTransaction) -> dict[str, int]:
    """
    Return the required approval counts for a transaction type.
    
    Returns:
        {"directors": int, "ic_members": int}
    """
    requirements = {
        "directors": 2,  # Always require 2 directors
        "ic_members": 0,  # Default: no IC requirement
    }
    
    # Investment requires IC approval
    if tx.type == CashTransactionType.INVESTMENT:
        requirements["ic_members"] = 2  # 2 of 3 IC members
    
    # Cash management explicitly does NOT require IC
    # (per normative rule: "Investment Committee approval is not required for cash management")
    
    return requirements
