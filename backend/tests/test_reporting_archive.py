from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.modules.documents.models import Document


def test_reporting_archive_lists_persisted_artifacts(client: TestClient, seeded_fund: dict, db_session: Session):
    fund_id = seeded_fund["fund_id"]

    # Create & finalize snapshot
    snap = client.post(
        f"/funds/{fund_id}/reports/nav/snapshots",
        json={
            "period_month": "2025-06",
            "nav_total_usd": 100,
            "cash_balance_usd": 10,
            "assets_value_usd": 95,
            "liabilities_usd": 5,
        },
    )
    assert snap.status_code == 200
    snapshot_id = snap.json()["id"]

    doc = Document(
        fund_id=uuid.UUID(fund_id),
        document_type="valuation_support",
        title="Support Doc",
        created_by="seed-user",
        updated_by="seed-user",
    )
    db_session.add(doc)
    db_session.commit()

    val = client.post(
        f"/funds/{fund_id}/reports/nav/snapshots/{snapshot_id}/assets",
        json={
            "asset_id": str(uuid.uuid4()),
            "asset_type": "LOAN",
            "valuation_usd": 1,
            "valuation_method": "FAIR_VALUE",
            "supporting_document_id": str(doc.id),
        },
    )
    assert val.status_code == 200

    fin = client.post(f"/funds/{fund_id}/reports/nav/snapshots/{snapshot_id}/finalize")
    assert fin.status_code == 200

    pub = client.post(f"/funds/{fund_id}/reports/nav/snapshots/{snapshot_id}/publish")
    assert pub.status_code == 200

    pack = client.post(
        f"/funds/{fund_id}/reports/monthly-pack/generate",
        json={"nav_snapshot_id": snapshot_id, "pack_type": "AUDITOR_PACK"},
    )
    assert pack.status_code == 200

    stmt = client.post(
        f"/funds/{fund_id}/reports/investor-statements/generate",
        json={"period_month": "2025-06", "ending_balance": 123},
    )
    assert stmt.status_code == 200
    statement_id = stmt.json()["id"]

    archive = client.get(f"/funds/{fund_id}/reports/archive?period_month=2025-06")
    assert archive.status_code == 200
    body = archive.json()

    assert body["period_month"] == "2025-06"
    assert len(body["nav_snapshots"]) == 1
    assert len(body["monthly_packs"]) == 1
    assert len(body["investor_statements"]) == 1

    dl = client.get(f"/funds/{fund_id}/reports/investor-statements/{statement_id}/download")
    assert dl.status_code == 200
    assert dl.headers["content-type"].startswith("application/json")
    assert b"INVESTOR_STATEMENT" in dl.content
