from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db.session import get_db
from app.core.security.dependencies import require_fund_access
from app.core.security.rbac import require_role
from app.domain.portfolio.models.assets import PortfolioAsset
from app.domain.portfolio.models.alerts import Alert
from app.domain.portfolio.schemas.alerts import AlertOut


router = APIRouter(tags=["Alerts"], dependencies=[Depends(require_fund_access())])


@router.get("/funds/{fund_id}/alerts", response_model=list[AlertOut])
def list_alerts(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["ADMIN", "COMPLIANCE", "AUDITOR"])),
):
    return (
        db.query(Alert)
        .join(PortfolioAsset, PortfolioAsset.id == Alert.asset_id)
        .filter(PortfolioAsset.fund_id == fund_id)
        .all()
    )

