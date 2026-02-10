from __future__ import annotations


def test_deal_rejection_is_persisted(client, seeded_fund):
    fund_id = seeded_fund["fund_id"]

    r = client.post(
        f"/funds/{fund_id}/deals",
        json={
            "deal_type": "DIRECT_LOAN",
            "name": "Bad Deal",
        },
    )
    assert r.status_code == 200
    deal_id = r.json()["id"]

    r2 = client.patch(
        f"/funds/{fund_id}/deals/{deal_id}/decision",
        json={
            "stage": "REJECTED",
            "rejection_code": "OUT_OF_MANDATE",
            "rejection_notes": "Outside fund strategy.",
        },
    )
    assert r2.status_code == 200
    assert r2.json()["stage"] == "REJECTED"
    assert r2.json()["rejection_code"] == "OUT_OF_MANDATE"

    # Rejected deals must remain queryable forever.
    r3 = client.get(f"/funds/{fund_id}/deals")
    assert r3.status_code == 200
    assert any(d["id"] == deal_id for d in r3.json())

