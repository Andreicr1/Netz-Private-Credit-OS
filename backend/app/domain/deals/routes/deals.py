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
from app.domain.deals.models.qualification import DealQualification
from app.domain.deals.schemas.deals import DealCreate, DealDecision, DealOut
from app.domain.deals.services.qualification import run_minimum_qualification


router = APIRouter(prefix="/funds/{fund_id}/deals", tags=["Deals"], dependencies=[Depends(require_fund_access())])


@router.post("", response_model=DealOut)
def create_deal(
    fund_id: uuid.UUID,
    payload: DealCreate,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["ADMIN", "INVESTMENT_TEAM"])),
):
    deal = Deal(fund_id=fund_id, **payload.model_dump())
    db.add(deal)
    db.flush()

    write_audit_event(
        db=db,
        fund_id=fund_id,
        actor_id=actor.id,
        action="deal.intake.created",
        entity_type="Deal",
        entity_id=str(deal.id),
        before=None,
        after=payload.model_dump(),
    )

    # Automatic deterministic qualification
    passed, summary, rejection_code = run_minimum_qualification(deal)
    qual = DealQualification(deal_id=deal.id, passed=passed, summary=summary)
    db.add(qual)
    db.flush()

    write_audit_event(
        db=db,
        fund_id=fund_id,
        actor_id="system",
        request_id="workflow",
        action="deal.qualification.persisted",
        entity_type="DealQualification",
        entity_id=str(qual.id),
        before=None,
        after={"deal_id": str(deal.id), "passed": passed, "summary": summary, "rejection_code": rejection_code.value if rejection_code else None},
    )

    if passed:
        deal.stage = DealStage.QUALIFIED
    else:
        deal.stage = DealStage.REJECTED
        deal.rejection_code = rejection_code
        deal.rejection_notes = summary

    db.flush()
    write_audit_event(
        db=db,
        fund_id=fund_id,
        actor_id="system",
        request_id="workflow",
        action="deal.stage.updated_by_qualification",
        entity_type="Deal",
        entity_id=str(deal.id),
        before=None,
        after={"stage": deal.stage.value, "rejection_code": deal.rejection_code.value if deal.rejection_code else None},
    )

    db.commit()
    db.refresh(deal)
    return deal


@router.get("", response_model=list[DealOut])
def list_deals(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["ADMIN", "INVESTMENT_TEAM", "AUDITOR"])),
):
    return db.query(Deal).filter(Deal.fund_id == fund_id).all()


@router.patch("/{deal_id}/decision", response_model=DealOut)
def decide_deal(
    fund_id: uuid.UUID,
    deal_id: uuid.UUID,
    payload: DealDecision,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["ADMIN", "INVESTMENT_TEAM", "COMPLIANCE"])),
):
    deal = db.query(Deal).filter(Deal.fund_id == fund_id, Deal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    before = {
        "stage": deal.stage.value if hasattr(deal.stage, "value") else deal.stage,
        "rejection_code": deal.rejection_code.value if deal.rejection_code else None,
        "rejection_notes": deal.rejection_notes,
    }

    deal.stage = payload.stage

    if payload.stage == DealStage.REJECTED:
        deal.rejection_code = payload.rejection_code
        deal.rejection_notes = payload.rejection_notes

    db.flush()

    write_audit_event(
        db=db,
        fund_id=fund_id,
        actor_id=actor.id,
        action="deal.decision.recorded",
        entity_type="Deal",
        entity_id=str(deal.id),
        before=before,
        after=payload.model_dump(),
    )

    db.commit()
    db.refresh(deal)
    return deal

