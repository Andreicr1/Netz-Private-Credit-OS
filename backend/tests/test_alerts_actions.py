from __future__ import annotations

from datetime import date, timedelta
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db.models import AuditEvent
from app.domain.portfolio.enums import ActionStatus, ObligationStatus
from app.domain.portfolio.models.obligations import AssetObligation
from app.domain.portfolio.services.obligation_monitor import check_overdue_obligations


def test_overdue_obligation_generates_alert_and_action(client, seeded_fund, db_session: Session):
    fund_id = seeded_fund["fund_id"]
    fund_uuid = uuid.UUID(fund_id)

    # create fund investment asset
    r = client.post(
        f"/funds/{fund_id}/assets",
        json={
            "asset_type": "FUND_INVESTMENT",
            "strategy": "FUND_SECONDARIES",
            "name": "Test Fund",
        },
    )
    assert r.status_code == 200
    asset_id = r.json()["id"]

    # attach fund investment (creates NAV obligation)
    r_attach = client.post(
        f"/funds/{fund_id}/assets/{asset_id}/fund-investment",
        json={
            "manager_name": "Manager A",
            "underlying_fund_name": "Underlying Fund B",
            "reporting_frequency": "QUARTERLY",
        },
    )
    assert r_attach.status_code == 200

    # list obligations
    obs = client.get(f"/funds/{fund_id}/obligations").json()
    assert len(obs) > 0

    # alerts initially empty
    alerts = client.get(f"/funds/{fund_id}/alerts").json()
    assert alerts == []

    # Force the first obligation to be overdue
    first_ob_id = uuid.UUID(obs[0]["id"])
    ob = db_session.execute(select(AssetObligation).where(AssetObligation.id == first_ob_id)).scalar_one()
    ob.due_date = date.today() - timedelta(days=1)
    ob.status = ObligationStatus.OPEN
    db_session.commit()

    generated = check_overdue_obligations(db_session)
    assert generated >= 1

    alerts2 = client.get(f"/funds/{fund_id}/alerts").json()
    assert len(alerts2) >= 1

    actions = client.get(f"/funds/{fund_id}/portfolio/actions").json()
    assert len(actions) >= 1

    # Update an action and ensure audit event written
    action_id = actions[0]["id"]
    r_upd = client.patch(
        f"/funds/{fund_id}/portfolio/actions/{action_id}",
        json={"status": ActionStatus.UNDER_REVIEW.value, "evidence_notes": "Reviewed"},
    )
    assert r_upd.status_code == 200

    audit = (
        db_session.execute(select(AuditEvent).where(AuditEvent.fund_id == fund_uuid, AuditEvent.action == "action.updated"))
        .scalars()
        .all()
    )
    assert len(audit) >= 1

