from __future__ import annotations

from datetime import date, datetime, timezone
import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.domain.cash_management.enums import CashTransactionType
from app.domain.cash_management.models.bank_statements import BankStatementUpload


def _create_statement_upload(db: Session, fund_id: str) -> str:
    statement = BankStatementUpload(
        fund_id=uuid.UUID(fund_id),
        access_level="internal",
        period_start=date.today(),
        period_end=date.today(),
        uploaded_by="seed-user",
        uploaded_at=datetime.now(timezone.utc),
        blob_path="dev://dummy-statement",
        original_filename="dummy.pdf",
        sha256=None,
        notes=None,
        created_by="seed-user",
        updated_by="seed-user",
    )
    db.add(statement)
    db.commit()
    db.refresh(statement)
    return str(statement.id)


def test_manual_reconciliation_match_happy_path(client: TestClient, db_session: Session, seeded_fund: dict):
    fund_id = seeded_fund["fund_id"]

    # Create a cash transaction
    tx_resp = client.post(
        f"/funds/{fund_id}/cash/transactions",
        json={
            "type": CashTransactionType.OTHER.value,
            "amount": 123.45,
            "value_date": date.today().isoformat(),
            "currency": "USD",
        },
    )
    assert tx_resp.status_code == 200
    tx_id = tx_resp.json()["transaction_id"]

    statement_id = _create_statement_upload(db_session, fund_id)

    # Add a statement line
    line_resp = client.post(
        f"/funds/{fund_id}/cash/statements/{statement_id}/lines",
        json={
            "value_date": date.today().isoformat(),
            "direction": "INFLOW",
            "description": "Incoming wire",
            "amount_usd": 123.45,
        },
    )
    assert line_resp.status_code == 200
    line_id = line_resp.json()["line_id"]

    # Manual match
    match_resp = client.post(
        f"/funds/{fund_id}/cash/reconciliation/match",
        json={
            "statement_line_id": line_id,
            "transaction_id": tx_id,
            "reconciliation_status": "MATCHED",
            "notes": "Matched by compliance",
        },
    )
    assert match_resp.status_code == 200
    line = match_resp.json()["line"]
    assert line["reconciliation_status"] == "MATCHED"
    assert line["matched_transaction_id"] == tx_id

    # Second attempt should hard-fail (no rewrite)
    match_resp_2 = client.post(
        f"/funds/{fund_id}/cash/reconciliation/match",
        json={
            "statement_line_id": line_id,
            "transaction_id": tx_id,
            "reconciliation_status": "MATCHED",
        },
    )
    assert match_resp_2.status_code == 400


def test_manual_reconciliation_flag_discrepancy(client: TestClient, db_session: Session, seeded_fund: dict):
    fund_id = seeded_fund["fund_id"]

    statement_id = _create_statement_upload(db_session, fund_id)

    line_resp = client.post(
        f"/funds/{fund_id}/cash/statements/{statement_id}/lines",
        json={
            "value_date": date.today().isoformat(),
            "direction": "OUTFLOW",
            "description": "Unknown fee",
            "amount_usd": 10.00,
        },
    )
    assert line_resp.status_code == 200
    line_id = line_resp.json()["line_id"]

    disc_resp = client.post(
        f"/funds/{fund_id}/cash/reconciliation/match",
        json={
            "statement_line_id": line_id,
            "reconciliation_status": "DISCREPANCY",
            "notes": "No corresponding transaction found",
        },
    )
    assert disc_resp.status_code == 200
    line = disc_resp.json()["line"]
    assert line["reconciliation_status"] == "DISCREPANCY"
    assert line["matched_transaction_id"] is None
