from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db.audit import write_audit_event
from app.core.security.auth import Actor
from app.modules.portfolio import models
from app.modules.portfolio.schemas import (
    AlertCreate,
    BorrowerCreate,
    CovenantCreate,
    CovenantTestCreate,
    LoanCreate,
)
from app.shared.utils import sa_model_to_dict


def list_borrowers(db: Session, *, fund_id: uuid.UUID, limit: int, offset: int) -> list[models.Borrower]:
    stmt = select(models.Borrower).where(models.Borrower.fund_id == fund_id).offset(offset).limit(limit)
    return list(db.execute(stmt).scalars().all())


def create_borrower(db: Session, *, fund_id: uuid.UUID, actor: Actor, data: BorrowerCreate) -> models.Borrower:
    borrower = models.Borrower(
        fund_id=fund_id,
        legal_name=data.legal_name,
        tax_id=data.tax_id,
        country=data.country,
        industry=data.industry,
        notes=data.notes,
        created_by=actor.actor_id,
        updated_by=actor.actor_id,
    )
    db.add(borrower)
    db.flush()

    write_audit_event(
        db,
        fund_id=fund_id,
        action="portfolio.borrower.create",
        entity_type="borrower",
        entity_id=borrower.id,
        before=None,
        after=sa_model_to_dict(borrower),
    )
    db.commit()
    db.refresh(borrower)
    return borrower


def list_loans(db: Session, *, fund_id: uuid.UUID, limit: int, offset: int) -> list[models.Loan]:
    stmt = select(models.Loan).where(models.Loan.fund_id == fund_id).offset(offset).limit(limit)
    return list(db.execute(stmt).scalars().all())


def create_loan(db: Session, *, fund_id: uuid.UUID, actor: Actor, data: LoanCreate) -> models.Loan:
    loan = models.Loan(
        fund_id=fund_id,
        borrower_id=data.borrower_id,
        external_reference=data.external_reference,
        principal_amount=data.principal_amount,
        currency=data.currency,
        interest_rate_bps=data.interest_rate_bps,
        start_date=data.start_date,
        maturity_date=data.maturity_date,
        status=data.status,
        created_by=actor.actor_id,
        updated_by=actor.actor_id,
    )
    db.add(loan)
    db.flush()

    write_audit_event(
        db,
        fund_id=fund_id,
        action="portfolio.loan.create",
        entity_type="loan",
        entity_id=loan.id,
        before=None,
        after=sa_model_to_dict(loan),
    )
    db.commit()
    db.refresh(loan)
    return loan


def list_covenants(db: Session, *, fund_id: uuid.UUID, limit: int, offset: int) -> list[models.Covenant]:
    stmt = select(models.Covenant).where(models.Covenant.fund_id == fund_id).offset(offset).limit(limit)
    return list(db.execute(stmt).scalars().all())


def create_covenant(db: Session, *, fund_id: uuid.UUID, actor: Actor, data: CovenantCreate) -> models.Covenant:
    covenant = models.Covenant(
        fund_id=fund_id,
        loan_id=data.loan_id,
        name=data.name,
        covenant_type=data.covenant_type,
        threshold=data.threshold,
        comparator=data.comparator,
        frequency=data.frequency,
        is_active=data.is_active,
        created_by=actor.actor_id,
        updated_by=actor.actor_id,
    )
    db.add(covenant)
    db.flush()

    write_audit_event(
        db,
        fund_id=fund_id,
        action="portfolio.covenant.create",
        entity_type="covenant",
        entity_id=covenant.id,
        before=None,
        after=sa_model_to_dict(covenant),
    )
    db.commit()
    db.refresh(covenant)
    return covenant


def create_covenant_test(
    db: Session, *, fund_id: uuid.UUID, actor: Actor, data: CovenantTestCreate
) -> models.CovenantTest:
    test = models.CovenantTest(
        fund_id=fund_id,
        covenant_id=data.covenant_id,
        tested_at=data.tested_at,
        value=data.value,
        passed=data.passed,
        notes=data.notes,
        inputs=data.inputs,
        created_by=actor.actor_id,
        updated_by=actor.actor_id,
    )
    db.add(test)
    db.flush()

    breach = None
    if data.passed is False:
        breach = models.CovenantBreach(
            fund_id=fund_id,
            covenant_test_id=test.id,
            breach_detected_at=data.tested_at,
            severity=data.breach_severity,
            details=data.breach_details,
            created_by=actor.actor_id,
            updated_by=actor.actor_id,
        )
        db.add(breach)
        db.flush()

    write_audit_event(
        db,
        fund_id=fund_id,
        action="portfolio.covenant_test.create",
        entity_type="covenant_test",
        entity_id=test.id,
        before=None,
        after=sa_model_to_dict(test),
    )
    if breach is not None:
        write_audit_event(
            db,
            fund_id=fund_id,
            action="portfolio.covenant_breach.create",
            entity_type="covenant_breach",
            entity_id=breach.id,
            before=None,
            after=sa_model_to_dict(breach),
        )

    db.commit()
    db.refresh(test)
    return test


def list_breaches(db: Session, *, fund_id: uuid.UUID, limit: int, offset: int) -> list[models.CovenantBreach]:
    stmt = (
        select(models.CovenantBreach)
        .where(models.CovenantBreach.fund_id == fund_id)
        .order_by(models.CovenantBreach.breach_detected_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(db.execute(stmt).scalars().all())


def list_alerts(db: Session, *, fund_id: uuid.UUID, limit: int, offset: int) -> list[models.Alert]:
    stmt = select(models.Alert).where(models.Alert.fund_id == fund_id).offset(offset).limit(limit)
    return list(db.execute(stmt).scalars().all())


def create_alert(db: Session, *, fund_id: uuid.UUID, actor: Actor, data: AlertCreate) -> models.Alert:
    alert = models.Alert(
        fund_id=fund_id,
        alert_type=data.alert_type,
        severity=data.severity,
        message=data.message,
        entity_type=data.entity_type,
        entity_id=data.entity_id,
        status=data.status,
        data=data.data,
        created_by=actor.actor_id,
        updated_by=actor.actor_id,
    )
    db.add(alert)
    db.flush()

    write_audit_event(
        db,
        fund_id=fund_id,
        action="portfolio.alert.create",
        entity_type="alert",
        entity_id=alert.id,
        before=None,
        after=sa_model_to_dict(alert),
    )
    db.commit()
    db.refresh(alert)
    return alert

