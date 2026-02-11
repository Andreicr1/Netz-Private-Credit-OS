from __future__ import annotations

import json
import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.domain.cash_management.enums import CashTransactionDirection, CashTransactionStatus, CashTransactionType
from app.domain.cash_management.models.cash import CashTransaction
from app.modules.documents.models import Document


def _actor_header(*, actor_id: str, roles: list[str], fund_id: str) -> dict[str, str]:
    return {
        "X-DEV-ACTOR": json.dumps({"actor_id": actor_id, "roles": roles, "fund_ids": [fund_id]}),
        "Content-Type": "application/json",
    }


def test_signatures_list_detail_and_sign_flow(client: TestClient, db: Session, seeded_fund: dict):
    fund_id = seeded_fund["fund_id"]

    # Evidence document (backend-authoritative pointer)
    doc = Document(
        fund_id=uuid.UUID(fund_id),
        access_level="internal",
        document_type="investment_memo",
        title="IC Memo",
        status="final",
        current_version=1,
        created_by="seed",
        updated_by="seed",
        blob_uri="https://example.invalid/memo.pdf",
    )
    db.add(doc)
    db.flush()

    tx = CashTransaction(
        fund_id=uuid.UUID(fund_id),
        type=CashTransactionType.FUND_EXPENSE,
        direction=CashTransactionDirection.OUTFLOW,
        amount=100000,
        currency="USD",
        status=CashTransactionStatus.PENDING_APPROVAL,
        beneficiary_name="Vendor LLC",
        beneficiary_bank="Bank",
        beneficiary_account="****1234",
        justification_text="Service invoice",
        investment_memo_document_id=doc.id,
        created_by="seed",
        updated_by="seed",
    )
    db.add(tx)
    db.commit()

    # List
    r = client.get(f"/funds/{fund_id}/signatures", headers=_actor_header(actor_id="aud", roles=["AUDITOR"], fund_id=fund_id))
    assert r.status_code == 200
    payload = r.json()
    assert "items" in payload
    assert any(str(it["id"]) == str(tx.id) for it in payload["items"])

    # Detail
    d = client.get(
        f"/funds/{fund_id}/signatures/{tx.id}",
        headers=_actor_header(actor_id="aud", roles=["AUDITOR"], fund_id=fund_id),
    )
    assert d.status_code == 200
    detail = d.json()
    assert detail["request"]["status"] in ("PENDING", "DRAFT")
    assert len(detail["evidence"]) >= 1

    # Sign #1
    s1 = client.post(
        f"/funds/{fund_id}/signatures/{tx.id}/sign",
        headers=_actor_header(actor_id="dir-1", roles=["DIRECTOR"], fund_id=fund_id),
        json={"comment": "OK"},
    )
    assert s1.status_code == 200
    assert s1.json()["request"]["current_signatures_count"] == 1

    # Duplicate by same director blocked
    sdup = client.post(
        f"/funds/{fund_id}/signatures/{tx.id}/sign",
        headers=_actor_header(actor_id="dir-1", roles=["DIRECTOR"], fund_id=fund_id),
        json={"comment": "again"},
    )
    assert sdup.status_code == 400

    # Sign #2 => SIGNED
    s2 = client.post(
        f"/funds/{fund_id}/signatures/{tx.id}/sign",
        headers=_actor_header(actor_id="dir-2", roles=["DIRECTOR"], fund_id=fund_id),
        json={"comment": "OK"},
    )
    assert s2.status_code == 200
    out2 = s2.json()
    assert out2["request"]["current_signatures_count"] == 2
    assert out2["request"]["status"] == "SIGNED"

    # Execution pack allowed when signed
    pack = client.post(
        f"/funds/{fund_id}/signatures/{tx.id}/execution-pack",
        headers=_actor_header(actor_id="dir-2", roles=["DIRECTOR"], fund_id=fund_id),
        json={},
    )
    assert pack.status_code == 200
    m = pack.json()
    assert m["kind"] == "BANK_EXECUTION_PACK"
    assert m["request_id"] == str(tx.id)
    assert m.get("sha256")


def test_signatures_sign_requires_evidence(client: TestClient, db: Session, seeded_fund: dict):
    fund_id = seeded_fund["fund_id"]

    tx = CashTransaction(
        fund_id=uuid.UUID(fund_id),
        type=CashTransactionType.FUND_EXPENSE,
        direction=CashTransactionDirection.OUTFLOW,
        amount=123,
        currency="USD",
        status=CashTransactionStatus.PENDING_APPROVAL,
        beneficiary_name="Vendor LLC",
        created_by="seed",
        updated_by="seed",
    )
    db.add(tx)
    db.commit()

    s = client.post(
        f"/funds/{fund_id}/signatures/{tx.id}/sign",
        headers=_actor_header(actor_id="dir-1", roles=["DIRECTOR"], fund_id=fund_id),
        json={"comment": "OK"},
    )
    assert s.status_code == 400
    assert "Missing supporting evidence" in s.text


def test_compliance_me_does_not_alias_gp_to_director(client: TestClient, seeded_fund: dict):
    fund_id = seeded_fund["fund_id"]

    r = client.get(
        f"/funds/{fund_id}/compliance/me",
        headers=_actor_header(actor_id="dir", roles=["GP"], fund_id=fund_id),
    )
    assert r.status_code == 200
    roles = r.json().get("roles") or []
    assert "GP" in roles
    assert "DIRECTOR" not in roles
