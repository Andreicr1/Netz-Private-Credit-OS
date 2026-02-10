from __future__ import annotations

import json
import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.db.models import Fund


def _dev_actor_header(actor_id: str, roles: list[str], fund_ids: list[uuid.UUID]) -> str:
    return json.dumps({"actor_id": actor_id, "roles": roles, "fund_ids": [str(x) for x in fund_ids]})


def test_auditor_cannot_query_deals_root(monkeypatch, client: TestClient, db_session: Session):
    fund_id = uuid.uuid4()
    db_session.add(Fund(id=fund_id, name="Fund X"))
    db_session.commit()

    headers = {"X-DEV-ACTOR": _dev_actor_header("aud1", ["AUDITOR"], [fund_id])}
    r = client.post(
        f"/funds/{fund_id}/ai/answer",
        headers=headers,
        json={"question": "Show IC memo details", "root_folder": "2 Deals & Managers", "top_k": 5},
    )
    assert r.status_code == 403

