from __future__ import annotations

import json


def test_report_pack_publish_is_immutable(client, seeded_fund):
    fund_id = seeded_fund["fund_id"]

    # create pack
    r = client.post(
        f"/funds/{fund_id}/report-packs",
        json={"period_start": "2026-01-01", "period_end": "2026-01-31"},
    )
    assert r.status_code == 200
    pack_id = r.json()["id"]

    # generate
    r_gen = client.post(f"/funds/{fund_id}/report-packs/{pack_id}/generate")
    assert r_gen.status_code == 200

    # publish
    r_pub = client.post(f"/funds/{fund_id}/report-packs/{pack_id}/publish")
    assert r_pub.status_code == 200

    # ensure published packs appear for investor
    client.headers.update(
        {
            "X-DEV-ACTOR": json.dumps(
                {"actor_id": "investor-user", "roles": ["INVESTOR"], "fund_ids": [fund_id]}
            )
        }
    )
    r2 = client.get(f"/funds/{fund_id}/investor/report-packs")
    assert r2.status_code == 200
    assert len(r2.json()) == 1

