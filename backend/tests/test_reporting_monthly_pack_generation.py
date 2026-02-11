from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.modules.documents.models import Document


def test_monthly_pack_generation_requires_finalized_snapshot(client: TestClient, seeded_fund: dict):
    fund_id = seeded_fund["fund_id"]

    snap = client.post(
        f"/funds/{fund_id}/reports/nav/snapshots",
        json={
            "period_month": "2025-04",
            "nav_total_usd": 100,
            "cash_balance_usd": 10,
            "assets_value_usd": 95,
            "liabilities_usd": 5,
        },
    )
    assert snap.status_code == 200
    snapshot_id = snap.json()["id"]

    r = client.post(
        f"/funds/{fund_id}/reports/monthly-pack/generate",
        json={
            "nav_snapshot_id": snapshot_id,
            "pack_type": "INVESTOR_REPORT",
            "include_evidence_binder": True,
            "evidence_binder_limit": 5,
        },
    )
    assert r.status_code == 400
    assert "FINALIZED" in r.json()["detail"]


def test_monthly_pack_generation_and_download(client: TestClient, seeded_fund: dict, db_session: Session):
    fund_id = seeded_fund["fund_id"]

    snap = client.post(
        f"/funds/{fund_id}/reports/nav/snapshots",
        json={
            "period_month": "2025-05",
            "nav_total_usd": 100,
            "cash_balance_usd": 10,
            "assets_value_usd": 95,
            "liabilities_usd": 5,
        },
    )
    assert snap.status_code == 200
    snapshot_id = snap.json()["id"]

    # Add one supported valuation to satisfy finalize checks.
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
            "valuation_usd": 123.45,
            "valuation_method": "FAIR_VALUE",
            "supporting_document_id": str(doc.id),
        },
    )
    assert val.status_code == 200

    fin = client.post(f"/funds/{fund_id}/reports/nav/snapshots/{snapshot_id}/finalize")
    assert fin.status_code == 200

    gen = client.post(
        f"/funds/{fund_id}/reports/monthly-pack/generate",
        json={
            "nav_snapshot_id": snapshot_id,
            "pack_type": "AUDITOR_PACK",
            "include_evidence_binder": True,
            "evidence_binder_limit": 5,
        },
    )
    assert gen.status_code == 200
    pack_id = gen.json()["id"]
    assert gen.json()["blob_path"]

    dl = client.get(f"/funds/{fund_id}/reports/monthly-pack/{pack_id}/download")
    assert dl.status_code == 200
    assert dl.headers["content-type"].startswith("application/json")
    assert b"MONTHLY_REPORT_PACK" in dl.content
