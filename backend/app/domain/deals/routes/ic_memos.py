from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db.audit import write_audit_event
from app.core.db.session import get_db
from app.core.security.dependencies import require_fund_access
from app.core.security.rbac import require_role
from app.domain.deals.models.deals import Deal
from app.domain.deals.models.ic_memos import ICMemo


router = APIRouter(tags=["IC Memos"], dependencies=[Depends(require_fund_access())])


@router.post("/funds/{fund_id}/deals/{deal_id}/ic-memo")
def create_ic_memo(
    fund_id: uuid.UUID,
    deal_id: uuid.UUID,
    payload: dict,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["INVESTMENT_TEAM", "ADMIN"])),
):
    deal = db.query(Deal).filter(Deal.fund_id == fund_id, Deal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    if "executive_summary" not in payload:
        raise HTTPException(status_code=400, detail="executive_summary is required")

    memo = ICMemo(
        deal_id=deal_id,
        executive_summary=payload["executive_summary"],
        risks=payload.get("risks"),
        mitigants=payload.get("mitigants"),
    )
    db.add(memo)
    db.flush()

    write_audit_event(
        db=db,
        fund_id=fund_id,
        actor_id=actor.id,
        action="ic_memo.created",
        entity_type="ICMemo",
        entity_id=str(memo.id),
        before=None,
        after={"deal_id": str(deal_id)},
    )

    db.commit()
    return {"memo_id": str(memo.id)}

