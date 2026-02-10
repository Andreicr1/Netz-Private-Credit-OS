from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db.audit import write_audit_event
from app.core.db.session import get_db
from app.core.security.dependencies import require_fund_access
from app.core.security.rbac import require_role
from app.domain.deals.enums import DealStage
from app.domain.deals.models.deals import Deal
from app.domain.deals.services.conversion import convert_deal_to_asset


router = APIRouter(tags=["Deal Conversion"], dependencies=[Depends(require_fund_access())])


@router.post("/funds/{fund_id}/deals/{deal_id}/convert")
def convert_deal(
    fund_id: uuid.UUID,
    deal_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["ADMIN", "INVESTMENT_TEAM"])),
):
    deal = db.query(Deal).filter(Deal.fund_id == fund_id, Deal.id == deal_id).first()

    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    if deal.stage != DealStage.APPROVED:
        raise HTTPException(status_code=400, detail="Deal must be APPROVED before conversion")

    if deal.asset_id:
        raise HTTPException(status_code=409, detail="Deal already converted")

    try:
        asset = convert_deal_to_asset(db, deal)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    deal.asset_id = asset.id
    deal.stage = DealStage.CONVERTED_TO_ASSET
    db.flush()

    write_audit_event(
        db=db,
        fund_id=fund_id,
        actor_id=actor.id,
        action="deal.converted_to_asset",
        entity_type="Deal",
        entity_id=str(deal.id),
        before=None,
        after={"asset_id": str(asset.id)},
    )

    db.commit()
    return {"deal_id": str(deal.id), "asset_id": str(asset.id)}

