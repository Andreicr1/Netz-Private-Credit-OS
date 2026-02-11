from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.domain.reporting.enums import NavSnapshotStatus, ValuationMethod
from app.domain.reporting.models.asset_valuation_snapshots import AssetValuationSnapshot
from app.domain.reporting.models.nav_snapshots import NAVSnapshot
from app.modules.documents.models import Document


def test_nav_snapshot_asset_requires_supporting_document_when_not_amortized_cost(client: TestClient, seeded_fund: dict):
    fund_id = seeded_fund["fund_id"]

    snap = client.post(
        f"/funds/{fund_id}/reports/nav/snapshots",
        json={
            "period_month": "2025-01",
            "nav_total_usd": 100,
            "cash_balance_usd": 10,
            "assets_value_usd": 95,
            "liabilities_usd": 5,
        },
    )
    assert snap.status_code == 200
    snapshot_id = snap.json()["id"]

    r = client.post(
        f"/funds/{fund_id}/reports/nav/snapshots/{snapshot_id}/assets",
        json={
            "asset_id": str(uuid.uuid4()),
            "asset_type": "LOAN",
            "valuation_usd": 123.45,
            "valuation_method": "FAIR_VALUE",
        },
    )
    assert r.status_code == 400
    assert "supporting_document_id" in r.json()["detail"]


def test_nav_snapshot_finalize_blocks_missing_evidence_inserted_directly(
    client: TestClient, db_session: Session, seeded_fund: dict
):
    fund_id = uuid.UUID(seeded_fund["fund_id"])

    snap = NAVSnapshot(
        fund_id=fund_id,
        period_month="2025-02",
        nav_total_usd=100,
        cash_balance_usd=10,
        assets_value_usd=95,
        liabilities_usd=5,
        status=NavSnapshotStatus.DRAFT,
        created_by="seed-user",
        updated_by="seed-user",
    )
    db_session.add(snap)
    db_session.flush()

    # Insert a valuation that violates evidence rules (simulates legacy/bad data)
    v = AssetValuationSnapshot(
        fund_id=fund_id,
        nav_snapshot_id=snap.id,
        asset_id=uuid.uuid4(),
        asset_type="LOAN",
        valuation_usd=1,
        valuation_method=ValuationMethod.FAIR_VALUE,
        supporting_document_id=None,
        created_by="seed-user",
        updated_by="seed-user",
    )
    db_session.add(v)
    db_session.commit()

    resp = client.post(f"/funds/{fund_id}/reports/nav/snapshots/{snap.id}/finalize")
    assert resp.status_code == 400
    assert "Missing supporting_document_id" in resp.json()["detail"]


def test_nav_snapshot_freezes_after_finalize(client: TestClient, seeded_fund: dict, db_session: Session):
    fund_id = seeded_fund["fund_id"]

    snap = client.post(
        f"/funds/{fund_id}/reports/nav/snapshots",
        json={
            "period_month": "2025-03",
            "nav_total_usd": 100,
            "cash_balance_usd": 10,
            "assets_value_usd": 95,
            "liabilities_usd": 5,
        },
    )
    assert snap.status_code == 200
    snapshot_id = snap.json()["id"]

    # Create a supporting document
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
    assert fin.json()["status"] == "FINALIZED"

    # Now any attempt to add assets should be blocked.
    blocked = client.post(
        f"/funds/{fund_id}/reports/nav/snapshots/{snapshot_id}/assets",
        json={
            "asset_id": str(uuid.uuid4()),
            "asset_type": "LOAN",
            "valuation_usd": 1,
            "valuation_method": "AMORTIZED_COST",
        },
    )
    assert blocked.status_code == 400
    assert "frozen" in blocked.json()["detail"]
