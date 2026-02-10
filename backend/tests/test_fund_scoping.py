from __future__ import annotations

import json
import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.db.models import Fund
from app.modules.portfolio.models import Borrower


def dev_actor_header(actor_id: str, roles: list[str], fund_ids: list[uuid.UUID]) -> str:
    return json.dumps({"actor_id": actor_id, "roles": roles, "fund_ids": [str(x) for x in fund_ids]})


def test_fund_scoping_list_endpoints(client: TestClient, db_session: Session):
    fund1 = uuid.uuid4()
    fund2 = uuid.uuid4()

    # Funds are global entities; for realism we persist them.
    db_session.add(Fund(id=fund1, name="Fund 1"))
    db_session.add(Fund(id=fund2, name="Fund 2"))

    db_session.add(Borrower(fund_id=fund1, legal_name="Borrower A"))
    db_session.commit()

    headers = {"X-DEV-ACTOR": dev_actor_header("u1", ["GP"], [fund1])}

    r1 = client.get(f"/funds/{fund1}/portfolio/borrowers", headers=headers)
    assert r1.status_code == 200
    assert len(r1.json()["items"]) == 1

    # Accessing a different fund should be forbidden (tenant isolation).
    r2 = client.get(f"/funds/{fund2}/portfolio/borrowers", headers=headers)
    assert r2.status_code == 403

