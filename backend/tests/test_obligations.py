from __future__ import annotations


def test_nav_obligation_auto_generated_on_fund_investment_attach(client, seeded_fund):
    fund_id = seeded_fund["fund_id"]

    # create fund investment asset
    r = client.post(
        f"/funds/{fund_id}/assets",
        json={
            "asset_type": "FUND_INVESTMENT",
            "strategy": "FUND_SECONDARIES",
            "name": "Test Fund Commitment",
        },
    )
    assert r.status_code == 200
    asset_id = r.json()["id"]

    # attach fund investment extension
    r2 = client.post(
        f"/funds/{fund_id}/assets/{asset_id}/fund-investment",
        json={
            "manager_name": "Manager A",
            "underlying_fund_name": "Underlying Fund B",
            "reporting_frequency": "QUARTERLY",
        },
    )
    assert r2.status_code == 200

    # obligations should exist
    r3 = client.get(f"/funds/{fund_id}/obligations")
    assert r3.status_code == 200

    obligations = r3.json()
    assert any(o["obligation_type"] == "NAV_REPORT" for o in obligations)

