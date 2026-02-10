from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db.audit import write_audit_event
from app.core.security.auth import Actor
from app.modules.compliance.models import Obligation, ObligationStatus
from app.modules.compliance.schemas import ObligationCreate
from app.shared.utils import sa_model_to_dict


def create_obligation(db: Session, *, fund_id: uuid.UUID, actor: Actor, payload: ObligationCreate) -> Obligation:
    ob = Obligation(
        fund_id=fund_id,
        name=payload.name,
        regulator=payload.regulator,
        description=payload.description,
        is_active=payload.is_active,
        created_by=actor.actor_id,
        updated_by=actor.actor_id,
    )
    db.add(ob)
    db.flush()

    write_audit_event(
        db,
        fund_id=fund_id,
        action="compliance.obligation.create",
        entity_type="obligation",
        entity_id=ob.id,
        before=None,
        after=sa_model_to_dict(ob),
    )
    db.commit()
    db.refresh(ob)
    return ob


def list_obligation_status(db: Session, *, fund_id: uuid.UUID, limit: int, offset: int) -> list[ObligationStatus]:
    stmt = select(ObligationStatus).where(ObligationStatus.fund_id == fund_id).offset(offset).limit(limit)
    return list(db.execute(stmt).scalars().all())


def recompute_obligation_status(db: Session, *, fund_id: uuid.UUID, actor: Actor) -> list[ObligationStatus]:
    """
    Placeholder recompute. It ensures each obligation has a status row.
    Real computation will incorporate document evidence, expiries and periodicity.
    """
    obligations = list(db.execute(select(Obligation).where(Obligation.fund_id == fund_id, Obligation.is_active.is_(True))).scalars().all())

    statuses: list[ObligationStatus] = []
    for ob in obligations:
        existing = db.execute(
            select(ObligationStatus).where(ObligationStatus.fund_id == fund_id, ObligationStatus.obligation_id == ob.id)
        ).scalar_one_or_none()

        before = sa_model_to_dict(existing) if existing else None

        if existing is None:
            st = ObligationStatus(
                fund_id=fund_id,
                obligation_id=ob.id,
                status="unknown",
                details={"placeholder": True},
                created_by=actor.actor_id,
                updated_by=actor.actor_id,
            )
            db.add(st)
            db.flush()
        else:
            st = existing
            st.status = "unknown"
            st.details = {"placeholder": True}
            st.updated_by = actor.actor_id
            db.flush()

        write_audit_event(
            db,
            fund_id=fund_id,
            action="compliance.obligation_status.recompute",
            entity_type="obligation_status",
            entity_id=st.id,
            before=before,
            after=sa_model_to_dict(st),
        )
        statuses.append(st)

    db.commit()
    return statuses

