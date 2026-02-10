from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db.audit import write_audit_event
from app.core.db.session import get_db
from app.core.security.dependencies import require_fund_access
from app.core.security.rbac import require_role
from app.domain.reporting.enums import ReportPackStatus
from app.domain.reporting.models.report_packs import MonthlyReportPack


router = APIRouter(tags=["Investor Portal"], dependencies=[Depends(require_fund_access())])


@router.get("/funds/{fund_id}/investor/report-packs")
def list_published_packs(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["INVESTOR", "ADMIN"])),
):
    packs = (
        db.query(MonthlyReportPack)
        .filter_by(fund_id=fund_id, status=ReportPackStatus.PUBLISHED)
        .all()
    )

    write_audit_event(
        db=db,
        fund_id=fund_id,
        actor_id=actor.id,
        action="investor.report_pack.viewed",
        entity_type="MonthlyReportPack",
        entity_id=str(fund_id),
        before=None,
        after={"count": len(packs)},
    )
    db.commit()

    return packs

