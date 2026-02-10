from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db.audit import write_audit_event
from app.domain.portfolio.enums import AlertSeverity, AlertType, ObligationStatus
from app.domain.portfolio.models.actions import Action
from app.domain.portfolio.models.alerts import Alert
from app.domain.portfolio.models.assets import PortfolioAsset
from app.domain.portfolio.models.obligations import AssetObligation


def check_overdue_obligations(db: Session) -> int:
    """
    Workflow loop: detect overdue obligations and generate Alerts + Actions.

    Auditability:
    - writes audit events with actor_id='system' and request_id='workflow'
    Idempotency:
    - does not duplicate alerts/actions for the same obligation
    """
    today = date.today()

    overdue = (
        db.query(AssetObligation, PortfolioAsset.fund_id)
        .join(PortfolioAsset, PortfolioAsset.id == AssetObligation.asset_id)
        .filter(
            AssetObligation.status == ObligationStatus.OPEN,
            AssetObligation.due_date < today,
        )
        .all()
    )

    generated = 0
    for ob, fund_id in overdue:
        # If an overdue alert already exists for this obligation, skip.
        existing_alert = (
            db.query(Alert)
            .filter(
                Alert.obligation_id == ob.id,
                Alert.alert_type == AlertType.OBLIGATION_OVERDUE,
            )
            .first()
        )
        if existing_alert:
            # Ensure obligation is marked overdue even if alert exists.
            if ob.status != ObligationStatus.OVERDUE:
                before = {"status": ob.status.value}
                ob.status = ObligationStatus.OVERDUE
                db.flush()
                write_audit_event(
                    db=db,
                    fund_id=fund_id,
                    actor_id="system",
                    request_id="workflow",
                    action="obligation.status_overdue",
                    entity_type="AssetObligation",
                    entity_id=str(ob.id),
                    before=before,
                    after={"status": ob.status.value},
                )
                db.commit()
            continue

        alert = Alert(
            asset_id=ob.asset_id,
            obligation_id=ob.id,
            alert_type=AlertType.OBLIGATION_OVERDUE,
            severity=AlertSeverity.HIGH,
        )
        db.add(alert)
        db.flush()

        write_audit_event(
            db=db,
            fund_id=fund_id,
            actor_id="system",
            request_id="workflow",
            action="alert.generated.overdue_obligation",
            entity_type="Alert",
            entity_id=str(alert.id),
            before=None,
            after={
                "asset_id": str(ob.asset_id),
                "obligation_id": str(ob.id),
                "alert_type": AlertType.OBLIGATION_OVERDUE.value,
                "severity": AlertSeverity.HIGH.value,
            },
        )

        action = Action(
            asset_id=ob.asset_id,
            alert_id=alert.id,
            title=f"Resolve overdue obligation: {ob.obligation_type.value}",
            evidence_required=True,
        )
        db.add(action)
        db.flush()

        write_audit_event(
            db=db,
            fund_id=fund_id,
            actor_id="system",
            request_id="workflow",
            action="action.generated.from_alert",
            entity_type="Action",
            entity_id=str(action.id),
            before=None,
            after={
                "asset_id": str(ob.asset_id),
                "alert_id": str(alert.id),
                "title": action.title,
                "evidence_required": True,
            },
        )

        before = {"status": ob.status.value}
        ob.status = ObligationStatus.OVERDUE
        db.flush()

        write_audit_event(
            db=db,
            fund_id=fund_id,
            actor_id="system",
            request_id="workflow",
            action="obligation.updated",
            entity_type="AssetObligation",
            entity_id=str(ob.id),
            before=before,
            after={"status": ob.status.value},
        )

        db.commit()
        generated += 1

    return generated

