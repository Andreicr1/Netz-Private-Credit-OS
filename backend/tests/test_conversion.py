from __future__ import annotations


def test_approved_deal_converts_to_asset(client, seeded_fund):
    fund_id = seeded_fund["fund_id"]

    # create deal
    r = client.post(
        f"/funds/{fund_id}/deals",
        json={
            "deal_type": "FUND_INVESTMENT",
            "name": "Deal Fund X",
        },
    )
    assert r.status_code == 200
    deal_id = r.json()["id"]

    # approve deal
    client.patch(
        f"/funds/{fund_id}/deals/{deal_id}/decision",
        json={"stage": "APPROVED"},
    )

    # convert
    r2 = client.post(f"/funds/{fund_id}/deals/{deal_id}/convert")
    assert r2.status_code == 200
    assert "asset_id" in r2.json()

