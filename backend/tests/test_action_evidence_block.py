from __future__ import annotations


def test_action_cannot_close_without_evidence(client, seeded_fund):
    fund_id = seeded_fund["fund_id"]

    # create action
    r = client.post(
        f"/funds/{fund_id}/actions",
        json={"title": "Fix covenant breach"},
    )
    assert r.status_code == 200
    action_id = r.json()["id"]

    # attempt close without evidence
    r2 = client.patch(
        f"/funds/{fund_id}/actions/{action_id}",
        json={"status": "CLOSED"},
    )

    assert r2.status_code == 400
    assert "without evidence" in r2.json()["detail"]

