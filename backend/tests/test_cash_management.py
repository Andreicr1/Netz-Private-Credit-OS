"""
Comprehensive tests for Cash Management module.

Tests cover:
- USD-only enforcement
- Investment governance (IC approval requirement)
- Expense governance (justification requirement)
- Dual signature requirement
- State machine transitions
- Audit event emission
- Bank statement reconciliation
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy.orm import Session

from app.core.security.auth import Actor
from app.domain.cash_management.enums import (
    CashTransactionDirection,
    CashTransactionStatus,
    CashTransactionType,
    ReconciliationStatus,
)
from app.domain.cash_management.models.bank_statements import BankStatementLine, BankStatementUpload
from app.domain.cash_management.models.cash import CashTransaction, CashTransactionApproval
from app.domain.cash_management.service import (
    approve,
    create_transaction,
    mark_executed,
    mark_sent_to_admin,
    submit_transaction,
)
from app.domain.cash_management.services.reconciliation import (
    add_statement_line,
    match_statement_lines,
    upload_bank_statement,
)
from app.domain.cash_management.services.workflows import validate_ready_for_approval


@pytest.fixture
def fund_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture
def actor() -> Actor:
    return Actor(actor_id="test-user", roles=["ADMIN"], fund_ids=[])


def test_usd_only_enforcement(db: Session, fund_id: uuid.UUID, actor: Actor):
    """
    GOVERNANCE RULE: Only USD transactions are allowed.
    """
    payload = {
        "type": CashTransactionType.FUND_EXPENSE.value,
        "amount": 1000.00,
        "currency": "EUR",  # NOT ALLOWED
    }
    
    with pytest.raises(ValueError, match="Only USD"):
        create_transaction(db, fund_id=fund_id, actor=actor, payload=payload)


def test_investment_requires_ic_approval(db: Session, fund_id: uuid.UUID, actor: Actor):
    """
    GOVERNANCE RULE: Investments require >= 2 IC approvals.
    """
    # Create investment transaction
    payload = {
        "type": CashTransactionType.INVESTMENT.value,
        "amount": 500000.00,
        "investment_memo_document_id": str(uuid.uuid4()),
    }
    tx = create_transaction(db, fund_id=fund_id, actor=actor, payload=payload)
    
    # Submit for approval
    tx = submit_transaction(db, fund_id=fund_id, actor=actor, tx_id=tx.id)
    assert tx.status == CashTransactionStatus.PENDING_APPROVAL
    
    # Add 1 IC approval - should NOT be enough
    tx, appr1 = approve(
        db,
        fund_id=fund_id,
        actor=actor,
        tx_id=tx.id,
        approver_role="IC_MEMBER",
        approver_name="John Smith",
        comment="Approved",
        evidence_blob_uri=None,
    )
    
    # Add 2 director signatures
    tx, dir1 = approve(
        db,
        fund_id=fund_id,
        actor=actor,
        tx_id=tx.id,
        approver_role="DIRECTOR",
        approver_name="Director A",
        comment="Approved",
        evidence_blob_uri=None,
    )
    tx, dir2 = approve(
        db,
        fund_id=fund_id,
        actor=actor,
        tx_id=tx.id,
        approver_role="DIRECTOR",
        approver_name="Director B",
        comment="Approved",
        evidence_blob_uri=None,
    )
    
    # Should still NOT be approved (only 1 IC approval)
    db.refresh(tx)
    assert tx.status == CashTransactionStatus.PENDING_APPROVAL
    
    # Add 2nd IC approval - NOW should auto-approve
    tx, appr2 = approve(
        db,
        fund_id=fund_id,
        actor=actor,
        tx_id=tx.id,
        approver_role="IC_MEMBER",
        approver_name="Jane Doe",
        comment="Approved",
        evidence_blob_uri=None,
    )
    
    db.refresh(tx)
    assert tx.status == CashTransactionStatus.APPROVED
    assert tx.ic_approvals_count == 2


def test_expense_requires_justification(db: Session, fund_id: uuid.UUID, actor: Actor):
    """
    GOVERNANCE RULE: Expenses require justification_text and policy_basis.
    """
    payload = {
        "type": CashTransactionType.FUND_EXPENSE.value,
        "amount": 10000.00,
        # Missing justification_text and policy_basis
    }
    tx = create_transaction(db, fund_id=fund_id, actor=actor, payload=payload)
    tx = submit_transaction(db, fund_id=fund_id, actor=actor, tx_id=tx.id)
    
    # Try to approve without justification - should FAIL
    with pytest.raises(ValueError, match="requires justification_text"):
        validate_ready_for_approval(db, tx=tx)
    
    # Update transaction with justification (in real system would be via update endpoint)
    tx.justification_text = "Legal fees for fund setup"
    tx.policy_basis = [{"section": "3.2", "excerpt": "Legal and professional fees"}]
    db.commit()
    
    # Now validation should pass (still need signatures though)
    # This won't raise an error for missing signatures in validation,
    # but auto-approval won't trigger without them
    try:
        validate_ready_for_approval(db, tx=tx)
    except ValueError as e:
        # Expected to fail on signature requirement
        assert "director" in str(e).lower() or "signature" in str(e).lower()


def test_dual_signature_requirement(db: Session, fund_id: uuid.UUID, actor: Actor):
    """
    GOVERNANCE RULE: Cannot send to admin without 2 director signatures.
    """
    payload = {
        "type": CashTransactionType.TRANSFER_INTERNAL.value,
        "amount": 5000.00,
    }
    tx = create_transaction(db, fund_id=fund_id, actor=actor, payload=payload)
    tx = submit_transaction(db, fund_id=fund_id, actor=actor, tx_id=tx.id)
    
    # Add 1 director approval
    tx, dir1 = approve(
        db,
        fund_id=fund_id,
        actor=actor,
        tx_id=tx.id,
        approver_role="DIRECTOR",
        approver_name="Director A",
        comment=None,
        evidence_blob_uri=None,
    )
    
    # Should NOT be auto-approved yet (only 1 director)
    db.refresh(tx)
    assert tx.status == CashTransactionStatus.PENDING_APPROVAL
    
    # Add 2nd director approval
    tx, dir2 = approve(
        db,
        fund_id=fund_id,
        actor=actor,
        tx_id=tx.id,
        approver_role="DIRECTOR",
        approver_name="Director B",
        comment=None,
        evidence_blob_uri=None,
    )
    
    # Now should be auto-approved
    db.refresh(tx)
    assert tx.status == CashTransactionStatus.APPROVED
    
    # Can now send to admin
    tx = mark_sent_to_admin(db, fund_id=fund_id, actor=actor, tx_id=tx.id, admin_contact="zedra@example.com")
    assert tx.status == CashTransactionStatus.SENT_TO_ADMIN
    assert tx.sent_to_admin_at is not None


def test_state_machine_transitions(db: Session, fund_id: uuid.UUID, actor: Actor):
    """
    Test valid and invalid state transitions.
    """
    payload = {
        "type": CashTransactionType.BANK_FEE.value,
        "amount": 25.00,
    }
    tx = create_transaction(db, fund_id=fund_id, actor=actor, payload=payload)
    
    # DRAFT → PENDING_APPROVAL (valid)
    tx = submit_transaction(db, fund_id=fund_id, actor=actor, tx_id=tx.id)
    assert tx.status == CashTransactionStatus.PENDING_APPROVAL
    
    # Cannot go from PENDING_APPROVAL to EXECUTED directly (invalid)
    with pytest.raises(ValueError, match="Invalid transition"):
        mark_executed(db, fund_id=fund_id, actor=actor, tx_id=tx.id, bank_reference=None, notes=None)
    
    # Must go through APPROVED → SENT_TO_ADMIN → EXECUTED
    # Add required approvals
    tx, _ = approve(db, fund_id=fund_id, actor=actor, tx_id=tx.id, approver_role="DIRECTOR", approver_name="Dir1", comment=None, evidence_blob_uri=None)
    tx, _ = approve(db, fund_id=fund_id, actor=actor, tx_id=tx.id, approver_role="DIRECTOR", approver_name="Dir2", comment=None, evidence_blob_uri=None)
    
    db.refresh(tx)
    assert tx.status == CashTransactionStatus.APPROVED
    
    tx = mark_sent_to_admin(db, fund_id=fund_id, actor=actor, tx_id=tx.id, admin_contact=None)
    assert tx.status == CashTransactionStatus.SENT_TO_ADMIN
    
    tx = mark_executed(db, fund_id=fund_id, actor=actor, tx_id=tx.id, bank_reference="BANK-REF-123", notes=None)
    assert tx.status == CashTransactionStatus.EXECUTED


def test_direction_inference(db: Session, fund_id: uuid.UUID, actor: Actor):
    """
    Test automatic direction inference based on transaction type.
    """
    # LP Subscription = INFLOW
    tx_sub = create_transaction(
        db,
        fund_id=fund_id,
        actor=actor,
        payload={"type": CashTransactionType.LP_SUBSCRIPTION.value, "amount": 1000000.00},
    )
    assert tx_sub.direction == CashTransactionDirection.INFLOW
    
    # Investment = OUTFLOW
    tx_inv = create_transaction(
        db,
        fund_id=fund_id,
        actor=actor,
        payload={"type": CashTransactionType.INVESTMENT.value, "amount": 500000.00},
    )
    assert tx_inv.direction == CashTransactionDirection.OUTFLOW
    
    # Bank Fee = OUTFLOW
    tx_fee = create_transaction(
        db,
        fund_id=fund_id,
        actor=actor,
        payload={"type": CashTransactionType.BANK_FEE.value, "amount": 50.00},
    )
    assert tx_fee.direction == CashTransactionDirection.OUTFLOW


def test_reference_code_generation(db: Session, fund_id: uuid.UUID, actor: Actor):
    """
    Test that reference codes are auto-generated and unique.
    """
    tx1 = create_transaction(
        db,
        fund_id=fund_id,
        actor=actor,
        payload={"type": CashTransactionType.INVESTMENT.value, "amount": 100000.00},
    )
    assert tx1.reference_code is not None
    assert "INV" in tx1.reference_code
    
    tx2 = create_transaction(
        db,
        fund_id=fund_id,
        actor=actor,
        payload={"type": CashTransactionType.CAPITAL_CALL.value, "amount": 50000.00},
    )
    assert tx2.reference_code is not None
    assert "CAP" in tx2.reference_code
    assert tx1.reference_code != tx2.reference_code


def test_bank_statement_reconciliation(db: Session, fund_id: uuid.UUID, actor: Actor):
    """
    Test bank statement line matching to transactions.
    """
    # Create and execute a transaction
    tx = create_transaction(
        db,
        fund_id=fund_id,
        actor=actor,
        payload={
            "type": CashTransactionType.FUND_EXPENSE.value,
            "amount": 5000.00,
            "payment_reference": "LEGAL-FEE-2024",
            "justification_text": "Legal fees for fund setup",
            "policy_basis": [{"section": "3.2", "excerpt": "Legal and professional fees"}],
        },
    )
    tx = submit_transaction(db, fund_id=fund_id, actor=actor, tx_id=tx.id)
    
    # Approve it
    tx, _ = approve(db, fund_id=fund_id, actor=actor, tx_id=tx.id, approver_role="DIRECTOR", approver_name="Dir1", comment=None, evidence_blob_uri=None)
    tx, _ = approve(db, fund_id=fund_id, actor=actor, tx_id=tx.id, approver_role="DIRECTOR", approver_name="Dir2", comment=None, evidence_blob_uri=None)
    
    db.refresh(tx)
    tx = mark_sent_to_admin(db, fund_id=fund_id, actor=actor, tx_id=tx.id, admin_contact=None)
    tx = mark_executed(db, fund_id=fund_id, actor=actor, tx_id=tx.id, bank_reference="BANK-123", notes=None)
    
    # Upload bank statement
    statement = upload_bank_statement(
        db,
        fund_id=fund_id,
        actor=actor,
        period_start=date.today() - timedelta(days=30),
        period_end=date.today(),
        blob_path=f"{fund_id}/statements/2024-01.pdf",
        sha256="abc123",
    )
    
    # Add matching statement line
    line = add_statement_line(
        db,
        fund_id=fund_id,
        actor=actor,
        statement_id=statement.id,
        value_date=date.today(),
        description=f"WIRE TRANSFER {tx.reference_code} LEGAL-FEE-2024",
        amount_usd=5000.00,
        direction=CashTransactionDirection.OUTFLOW,
    )
    
    assert line.reconciliation_status == ReconciliationStatus.UNMATCHED
    
    # Run reconciliation
    result = match_statement_lines(db, fund_id=fund_id, actor=actor, statement_id=statement.id)
    
    # Line should now be matched
    db.refresh(line)
    assert line.reconciliation_status == ReconciliationStatus.MATCHED
    assert line.matched_transaction_id == tx.id
    assert result["matched"] == 1


def test_audit_events_emitted(db: Session, fund_id: uuid.UUID, actor: Actor):
    """
    Test that all required audit events are emitted.
    """
    from app.core.db.audit import get_audit_log
    
    payload = {
        "type": CashTransactionType.TRANSFER_INTERNAL.value,
        "amount": 1000.00,
    }
    
    # Create transaction
    tx = create_transaction(db, fund_id=fund_id, actor=actor, payload=payload)
    events = get_audit_log(db, fund_id=fund_id, entity_id=tx.id)
    assert any(e.action == "CASH_TRANSACTION_CREATED" for e in events)
    
    # Submit
    tx = submit_transaction(db, fund_id=fund_id, actor=actor, tx_id=tx.id)
    events = get_audit_log(db, fund_id=fund_id, entity_id=tx.id)
    assert any(e.action == "CASH_TRANSACTION_SUBMITTED" for e in events)
    
    # Approve (director signatures)
    tx, _ = approve(db, fund_id=fund_id, actor=actor, tx_id=tx.id, approver_role="DIRECTOR", approver_name="Dir1", comment=None, evidence_blob_uri=None)
    events = get_audit_log(db, fund_id=fund_id, entity_id=tx.id)
    assert any(e.action == "DIRECTOR_SIGNED" for e in events)
    
    tx, _ = approve(db, fund_id=fund_id, actor=actor, tx_id=tx.id, approver_role="DIRECTOR", approver_name="Dir2", comment=None, evidence_blob_uri=None)
    events = get_audit_log(db, fund_id=fund_id, entity_id=tx.id)
    assert any(e.action == "CASH_TRANSACTION_APPROVED" for e in events)
    
    # Send to admin
    tx = mark_sent_to_admin(db, fund_id=fund_id, actor=actor, tx_id=tx.id, admin_contact="admin@zedra.com")
    events = get_audit_log(db, fund_id=fund_id, entity_id=tx.id)
    assert any(e.action == "TRANSACTION_SENT_TO_ADMIN" for e in events)
    
    # Execute
    tx = mark_executed(db, fund_id=fund_id, actor=actor, tx_id=tx.id, bank_reference="BANK-REF", notes=None)
    events = get_audit_log(db, fund_id=fund_id, entity_id=tx.id)
    assert any(e.action == "TRANSACTION_EXECUTED" for e in events)
