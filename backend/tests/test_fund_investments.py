from __future__ import annotations


def test_fund_investment_extension_requires_correct_asset_type(client, seeded_fund):
    fund_id = seeded_fund["fund_id"]

    # create an asset that is NOT a fund investment
    r = client.post(
        f"/funds/{fund_id}/assets",
        json={
            "asset_type": "DIRECT_LOAN",
            "strategy": "CORE_DIRECT_LENDING",
            "name": "Test Loan Asset",
        },
    )
    assert r.status_code == 200
    asset_id = r.json()["id"]

    # attaching fund investment should fail
    r2 = client.post(
        f"/funds/{fund_id}/assets/{asset_id}/fund-investment",
        json={
            "manager_name": "Manager X",
            "underlying_fund_name": "Underlying Fund Y",
            "reporting_frequency": "QUARTERLY",
        },
    )
    assert r2.status_code == 400

