from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db.audit import get_audit_log
from app.core.db.audit import write_audit_event
from app.core.db.models import AuditEvent
from app.core.security.auth import Actor
from app.modules.compliance.models import Obligation, ObligationStatus
from app.modules.compliance.schemas import ObligationCreate
from app.modules.documents.models import Document, DocumentVersion
from app.shared.utils import sa_model_to_dict


WORKFLOW_OPEN = "OPEN"
WORKFLOW_IN_PROGRESS = "IN_PROGRESS"
WORKFLOW_CLOSED = "CLOSED"

AUDIT_ACTION_EVIDENCE_LINKED = "compliance.obligation.evidence.linked"
AUDIT_ACTION_MARK_IN_PROGRESS = "compliance.obligation.workflow.mark_in_progress"
AUDIT_ACTION_CLOSED = "compliance.obligation.workflow.closed"


def _workflow_actions() -> set[str]:
    return {AUDIT_ACTION_MARK_IN_PROGRESS, AUDIT_ACTION_CLOSED}


def _compute_workflow_status_from_action(action: str) -> str:
    if action == AUDIT_ACTION_CLOSED:
        return WORKFLOW_CLOSED
    if action == AUDIT_ACTION_MARK_IN_PROGRESS:
        return WORKFLOW_IN_PROGRESS
    return WORKFLOW_OPEN


def get_workflow_status_map(db: Session, *, fund_id: uuid.UUID, obligation_ids: list[uuid.UUID]) -> dict[uuid.UUID, str]:
    if not obligation_ids:
        return {}

    id_strs = [str(i) for i in obligation_ids]
    stmt = (
        select(AuditEvent)
        .where(
            AuditEvent.fund_id == fund_id,
            AuditEvent.entity_type == "obligation",
            AuditEvent.entity_id.in_(id_strs),
            AuditEvent.action.in_(sorted(_workflow_actions())),
        )
        .order_by(AuditEvent.created_at.desc())
    )

    out: dict[uuid.UUID, str] = {i: WORKFLOW_OPEN for i in obligation_ids}
    for ev in db.execute(stmt).scalars().all():
        oid = uuid.UUID(ev.entity_id)
        if oid in out and out[oid] == WORKFLOW_OPEN:
            out[oid] = _compute_workflow_status_from_action(ev.action)
    return out


def list_obligations(db: Session, *, fund_id: uuid.UUID, limit: int, offset: int) -> list[Obligation]:
    stmt = select(Obligation).where(Obligation.fund_id == fund_id).order_by(Obligation.updated_at.desc()).offset(offset).limit(limit)
    return list(db.execute(stmt).scalars().all())


def get_obligation(db: Session, *, fund_id: uuid.UUID, obligation_id: uuid.UUID) -> Obligation:
    ob = db.execute(select(Obligation).where(Obligation.fund_id == fund_id, Obligation.id == obligation_id)).scalar_one_or_none()
    if ob is None:
        raise ValueError("Obligation not found")
    return ob


def link_evidence_document(
    db: Session,
    *,
    fund_id: uuid.UUID,
    actor: Actor,
    obligation_id: uuid.UUID,
    document_id: uuid.UUID,
    version_id: uuid.UUID | None,
) -> None:
    _ = get_obligation(db, fund_id=fund_id, obligation_id=obligation_id)

    doc = db.execute(select(Document).where(Document.fund_id == fund_id, Document.id == document_id)).scalar_one_or_none()
    if doc is None:
        raise ValueError("Document not found")
    if doc.source != "dataroom":
        raise ValueError("Only Data Room documents can be linked as evidence")

    ver: DocumentVersion | None = None
    if version_id is not None:
        ver = db.execute(
            select(DocumentVersion).where(DocumentVersion.fund_id == fund_id, DocumentVersion.id == version_id, DocumentVersion.document_id == document_id)
        ).scalar_one_or_none()
        if ver is None:
            raise ValueError("Document version not found")

    write_audit_event(
        db,
        fund_id=fund_id,
        actor_id=actor.actor_id,
        action=AUDIT_ACTION_EVIDENCE_LINKED,
        entity_type="obligation",
        entity_id=obligation_id,
        before=None,
        after={
            "document_id": str(document_id),
            "version_id": str(version_id) if version_id else None,
            "document_title": doc.title,
            "root_folder": doc.root_folder,
            "folder_path": doc.folder_path,
            "version_number": ver.version_number if ver else None,
        },
    )
    db.commit()


def list_linked_evidence(
    db: Session,
    *,
    fund_id: uuid.UUID,
    obligation_id: uuid.UUID,
    limit: int = 200,
) -> list[AuditEvent]:
    _ = get_obligation(db, fund_id=fund_id, obligation_id=obligation_id)
    stmt = (
        select(AuditEvent)
        .where(
            AuditEvent.fund_id == fund_id,
            AuditEvent.entity_type == "obligation",
            AuditEvent.entity_id == str(obligation_id),
            AuditEvent.action == AUDIT_ACTION_EVIDENCE_LINKED,
        )
        .order_by(AuditEvent.created_at.asc())
        .limit(limit)
    )
    return list(db.execute(stmt).scalars().all())


def mark_in_progress(db: Session, *, fund_id: uuid.UUID, actor: Actor, obligation_id: uuid.UUID) -> None:
    _ = get_obligation(db, fund_id=fund_id, obligation_id=obligation_id)

    write_audit_event(
        db,
        fund_id=fund_id,
        actor_id=actor.actor_id,
        action=AUDIT_ACTION_MARK_IN_PROGRESS,
        entity_type="obligation",
        entity_id=obligation_id,
        before=None,
        after={"workflow_status": WORKFLOW_IN_PROGRESS},
    )
    db.commit()


def close_obligation(db: Session, *, fund_id: uuid.UUID, actor: Actor, obligation_id: uuid.UUID) -> None:
    _ = get_obligation(db, fund_id=fund_id, obligation_id=obligation_id)

    evidence_events = list_linked_evidence(db, fund_id=fund_id, obligation_id=obligation_id, limit=1)
    if not evidence_events:
        write_audit_event(
            db,
            fund_id=fund_id,
            actor_id=actor.actor_id,
            action="compliance.obligation.close_blocked_missing_evidence",
            entity_type="obligation",
            entity_id=obligation_id,
            before=None,
            after={"attempted_workflow_status": WORKFLOW_CLOSED},
        )
        db.commit()
        raise ValueError("Cannot close Obligation without linked evidence")

    write_audit_event(
        db,
        fund_id=fund_id,
        actor_id=actor.actor_id,
        action=AUDIT_ACTION_CLOSED,
        entity_type="obligation",
        entity_id=obligation_id,
        before=None,
        after={"workflow_status": WORKFLOW_CLOSED},
    )
    db.commit()


def get_obligation_audit(db: Session, *, fund_id: uuid.UUID, obligation_id: uuid.UUID, limit: int = 200) -> list[AuditEvent]:
    _ = get_obligation(db, fund_id=fund_id, obligation_id=obligation_id)
    return get_audit_log(db, fund_id=fund_id, entity_id=obligation_id, entity_type="obligation", limit=limit)


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

