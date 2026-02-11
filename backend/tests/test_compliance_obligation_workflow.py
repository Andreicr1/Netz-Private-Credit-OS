from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.modules.documents.models import Document


def _create_dataroom_doc(db: Session, *, fund_id: str) -> str:
    doc_id = uuid.uuid4()
    db.add(
        Document(
            id=doc_id,
            fund_id=uuid.UUID(fund_id),
            source="dataroom",
            document_type="evidence",
            title="Audit Financials FY2025",
            status="final",
            current_version=1,
            root_folder="11 Audit",
            folder_path="Financial statements",
            domain=None,
            blob_uri=None,
            content_type="application/pdf",
            original_filename="fy2025.pdf",
            sha256=None,
            meta=None,
            created_by="seed-user",
            updated_by="seed-user",
        )
    )
    db.commit()
    return str(doc_id)


def test_close_obligation_requires_linked_evidence(client, seeded_fund, db_session: Session):
    fund_id = seeded_fund["fund_id"]

    # Create an obligation
    r = client.post(
        f"/funds/{fund_id}/compliance/obligations",
        json={"name": "CIMA Annual Return", "regulator": "CIMA", "description": "Annual filing", "is_active": True},
    )
    assert r.status_code == 201, r.text
    obligation_id = r.json()["id"]

    # Closing without evidence must hard-fail
    r = client.post(f"/funds/{fund_id}/compliance/obligations/{obligation_id}/workflow/close")
    assert r.status_code == 400
    assert "without linked evidence" in r.json()["detail"].lower()

    # Link dataroom doc as evidence
    doc_id = _create_dataroom_doc(db_session, fund_id=fund_id)
    r = client.post(
        f"/funds/{fund_id}/compliance/obligations/{obligation_id}/evidence/link",
        json={"document_id": doc_id, "version_id": None},
    )
    assert r.status_code == 201, r.text

    # Evidence list reflects the link
    r = client.get(f"/funds/{fund_id}/compliance/obligations/{obligation_id}/evidence")
    assert r.status_code == 200, r.text
    items = r.json()
    assert len(items) == 1
    assert items[0]["document_id"] == doc_id
    assert items[0]["root_folder"] == "11 Audit"

    # Now closing is allowed
    r = client.post(f"/funds/{fund_id}/compliance/obligations/{obligation_id}/workflow/close")
    assert r.status_code == 200, r.text

    # Closed view should contain it; active view should not
    r = client.get(f"/funds/{fund_id}/compliance/obligations?view=closed")
    assert r.status_code == 200
    closed_ids = [x["id"] for x in r.json()["items"]]
    assert obligation_id in closed_ids

    r = client.get(f"/funds/{fund_id}/compliance/obligations?view=active")
    assert r.status_code == 200
    active_ids = [x["id"] for x in r.json()["items"]]
    assert obligation_id not in active_ids


def test_link_evidence_rejects_non_dataroom_document(client, seeded_fund, db_session: Session):
    fund_id = seeded_fund["fund_id"]

    r = client.post(
        f"/funds/{fund_id}/compliance/obligations",
        json={"name": "Test Obligation", "regulator": "CIMA", "description": None, "is_active": True},
    )
    assert r.status_code == 201, r.text
    obligation_id = r.json()["id"]

    # Non-dataroom document
    doc_id = uuid.uuid4()
    db_session.add(
        Document(
            id=doc_id,
            fund_id=uuid.UUID(fund_id),
            source="manual",
            document_type="evidence",
            title="Not in dataroom",
            status="final",
            current_version=1,
            root_folder=None,
            folder_path=None,
            domain=None,
            blob_uri=None,
            content_type="application/pdf",
            original_filename="x.pdf",
            sha256=None,
            meta=None,
            created_by="seed-user",
            updated_by="seed-user",
        )
    )
    db_session.commit()

    r = client.post(
        f"/funds/{fund_id}/compliance/obligations/{obligation_id}/evidence/link",
        json={"document_id": str(doc_id), "version_id": None},
    )
    assert r.status_code == 400
    assert "data room" in r.json()["detail"].lower()
