from __future__ import annotations

import json
import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.db.models import Fund
from app.domain.compliance.services.evidence_gap import AI_GAP_PREFIX
from app.modules.compliance.models import Obligation


def _dev_actor_header(actor_id: str, roles: list[str], fund_ids: list[uuid.UUID]) -> str:
    return json.dumps({"actor_id": actor_id, "roles": roles, "fund_ids": [str(x) for x in fund_ids]})


def test_insufficient_evidence_creates_compliance_obligation(monkeypatch, client: TestClient, db_session: Session):
    fund_id = uuid.uuid4()
    db_session.add(Fund(id=fund_id, name="Fund X"))
    db_session.commit()

    from app.modules.ai import routes as ai_routes

    class _DummySearch:
        def search(self, *, q: str, fund_id: str, root_folder: str | None, top: int = 5):
            return []  # no evidence => gap

    monkeypatch.setattr(ai_routes, "AzureSearchChunksClient", lambda: _DummySearch())

    headers = {"X-DEV-ACTOR": _dev_actor_header("u1", ["COMPLIANCE"], [fund_id])}
    r = client.post(
        f"/funds/{fund_id}/ai/answer",
        headers=headers,
        json={"question": "Provide latest financial statements", "root_folder": "11 Audit", "top_k": 5},
    )
    assert r.status_code == 200
    assert r.json()["answer"] == "Insufficient evidence in the Data Room"

    obs = db_session.query(Obligation).filter(Obligation.fund_id == fund_id, Obligation.name.like(f"{AI_GAP_PREFIX}%")).all()
    assert len(obs) >= 1

