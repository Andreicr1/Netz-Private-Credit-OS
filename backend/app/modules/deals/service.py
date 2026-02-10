from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db.audit import write_audit_event
from app.core.security.auth import Actor
from app.modules.deals import qualification
from app.modules.deals.models import (
    Deal,
    DealDecision,
    DealStageHistory,
    QualificationResult,
    QualificationRule,
)
from app.modules.deals.schemas import DealCreate, DealDecisionCreate, DealStagePatch, QualificationRunRequest
from app.shared.enums import DealStage, DecisionOutcome
from app.shared.utils import sa_model_to_dict


def list_deals(
    db: Session,
    *,
    fund_id: uuid.UUID,
    limit: int,
    offset: int,
    stage: str | None,
    is_archived: bool | None,
    rejection_reason_code: str | None,
) -> list[Deal]:
    stmt = select(Deal).where(Deal.fund_id == fund_id)
    if stage:
        stmt = stmt.where(Deal.stage == stage)
    if is_archived is not None:
        stmt = stmt.where(Deal.is_archived == is_archived)
    if rejection_reason_code:
        stmt = stmt.where(Deal.rejection_reason_code == rejection_reason_code)
    stmt = stmt.order_by(Deal.created_at.desc()).offset(offset).limit(limit)
    return list(db.execute(stmt).scalars().all())


def create_deal(db: Session, *, fund_id: uuid.UUID, actor: Actor, data: DealCreate) -> Deal:
    deal = Deal(
        fund_id=fund_id,
        title=data.title,
        borrower_name=data.borrower_name,
        requested_amount=data.requested_amount,
        currency=data.currency.upper(),
        stage=DealStage.intake.value,
        is_archived=False,
        meta=data.meta,
        created_by=actor.actor_id,
        updated_by=actor.actor_id,
    )
    db.add(deal)
    db.flush()

    write_audit_event(
        db,
        fund_id=fund_id,
        action="deals.deal.create",
        entity_type="deal",
        entity_id=deal.id,
        before=None,
        after=sa_model_to_dict(deal),
    )
    db.commit()
    db.refresh(deal)
    return deal


def patch_stage(db: Session, *, fund_id: uuid.UUID, actor: Actor, deal_id: uuid.UUID, patch: DealStagePatch) -> Deal:
    stmt = select(Deal).where(Deal.fund_id == fund_id, Deal.id == deal_id)
    deal = db.execute(stmt).scalar_one()

    before = sa_model_to_dict(deal)
    from_stage = deal.stage
    deal.stage = patch.to_stage
    if patch.to_stage == DealStage.archived.value:
        deal.is_archived = True
    deal.updated_by = actor.actor_id

    hist = DealStageHistory(
        fund_id=fund_id,
        deal_id=deal.id,
        from_stage=from_stage,
        to_stage=patch.to_stage,
        rationale=patch.rationale,
        created_by=actor.actor_id,
        updated_by=actor.actor_id,
    )
    db.add(hist)
    db.flush()

    write_audit_event(
        db,
        fund_id=fund_id,
        action="deals.deal.stage_patch",
        entity_type="deal",
        entity_id=deal.id,
        before=before,
        after=sa_model_to_dict(deal),
    )
    db.commit()
    db.refresh(deal)
    return deal


def decide(
    db: Session, *, fund_id: uuid.UUID, actor: Actor, deal_id: uuid.UUID, payload: DealDecisionCreate
) -> DealDecision:
    stmt = select(Deal).where(Deal.fund_id == fund_id, Deal.id == deal_id)
    deal = db.execute(stmt).scalar_one()
    deal_before = sa_model_to_dict(deal)

    outcome = DecisionOutcome(payload.outcome)

    decision = DealDecision(
        fund_id=fund_id,
        deal_id=deal.id,
        outcome=outcome.value,
        reason_code=payload.reason_code,
        rationale=payload.rationale,
        created_by=actor.actor_id,
        updated_by=actor.actor_id,
    )
    db.add(decision)
    db.flush()

    # Institutional defaults (can be refined later):
    from_stage = deal.stage
    deal.stage = DealStage.ic_decision.value
    if outcome == DecisionOutcome.approved:
        deal.stage = DealStage.execution.value
    elif outcome == DecisionOutcome.rejected:
        deal.stage = DealStage.archived.value
        deal.is_archived = True
        deal.rejection_reason_code = payload.reason_code or "IC_REJECTED"
        deal.rejection_rationale = payload.rationale
    elif outcome == DecisionOutcome.conditional:
        deal.stage = DealStage.execution.value

    deal.updated_by = actor.actor_id

    hist = DealStageHistory(
        fund_id=fund_id,
        deal_id=deal.id,
        from_stage=from_stage,
        to_stage=deal.stage,
        rationale=f"IC decision: {outcome.value}",
        created_by=actor.actor_id,
        updated_by=actor.actor_id,
    )
    db.add(hist)
    db.flush()

    write_audit_event(
        db,
        fund_id=fund_id,
        action="deals.deal.decision",
        entity_type="deal_decision",
        entity_id=decision.id,
        before=None,
        after=sa_model_to_dict(decision),
    )
    write_audit_event(
        db,
        fund_id=fund_id,
        action="deals.deal.update_after_decision",
        entity_type="deal",
        entity_id=deal.id,
        before=deal_before,
        after=sa_model_to_dict(deal),
    )

    db.commit()
    db.refresh(decision)
    return decision


def run_qualification(
    db: Session, *, fund_id: uuid.UUID, actor: Actor, req: QualificationRunRequest
) -> tuple[Deal, list[QualificationResult], bool]:
    deal = db.execute(select(Deal).where(Deal.fund_id == fund_id, Deal.id == req.deal_id)).scalar_one()
    deal_before = sa_model_to_dict(deal)

    rules_stmt = select(QualificationRule).where(QualificationRule.fund_id == fund_id, QualificationRule.is_active.is_(True))
    if req.rule_ids:
        rules_stmt = rules_stmt.where(QualificationRule.id.in_(req.rule_ids))
    rules = list(db.execute(rules_stmt).scalars().all())

    results: list[QualificationResult] = []
    any_fail = False
    any_flag = False

    for rule in rules:
        eval_out = qualification.evaluate_rule(rule.rule_config, deal)
        if eval_out.result == "fail":
            any_fail = True
        if eval_out.result == "flag":
            any_flag = True

        r = QualificationResult(
            fund_id=fund_id,
            deal_id=deal.id,
            rule_id=rule.id,
            result=eval_out.result,
            reasons=eval_out.reasons,
            created_by=actor.actor_id,
            updated_by=actor.actor_id,
        )
        db.add(r)
        db.flush()
        results.append(r)

        write_audit_event(
            db,
            fund_id=fund_id,
            action="deals.qualification.result",
            entity_type="qualification_result",
            entity_id=r.id,
            before=None,
            after=sa_model_to_dict(r),
        )

    auto_archived = False
    from_stage = deal.stage
    deal.stage = DealStage.qualification.value
    if any_fail:
        auto_archived = True
        deal.stage = DealStage.archived.value
        deal.is_archived = True
        deal.rejection_reason_code = "QUALIFICATION_FAIL"
        deal.rejection_rationale = "Deal rejeitado automaticamente por regras de qualificação."
    deal.updated_by = actor.actor_id

    hist = DealStageHistory(
        fund_id=fund_id,
        deal_id=deal.id,
        from_stage=from_stage,
        to_stage=deal.stage,
        rationale="Qualification run",
        created_by=actor.actor_id,
        updated_by=actor.actor_id,
    )
    db.add(hist)
    db.flush()

    write_audit_event(
        db,
        fund_id=fund_id,
        action="deals.qualification.run",
        entity_type="deal",
        entity_id=deal.id,
        before=deal_before,
        after=sa_model_to_dict(deal),
    )

    db.commit()
    db.refresh(deal)
    return deal, results, auto_archived

