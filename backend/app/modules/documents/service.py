from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db.audit import write_audit_event
from app.core.security.auth import Actor
from app.modules.documents.models import Document, DocumentVersion
from app.modules.documents.schemas import DocumentCreate, DocumentVersionCreate
from app.shared.utils import sa_model_to_dict


def list_documents(
    db: Session,
    *,
    fund_id: uuid.UUID,
    limit: int,
    offset: int,
    document_type: str | None,
    status: str | None,
) -> list[Document]:
    stmt = select(Document).where(Document.fund_id == fund_id)
    if document_type:
        stmt = stmt.where(Document.document_type == document_type)
    if status:
        stmt = stmt.where(Document.status == status)
    stmt = stmt.order_by(Document.created_at.desc()).offset(offset).limit(limit)
    return list(db.execute(stmt).scalars().all())


def create_document(db: Session, *, fund_id: uuid.UUID, actor: Actor, payload: DocumentCreate) -> Document:
    doc = Document(
        fund_id=fund_id,
        document_type=payload.document_type,
        title=payload.title,
        status=payload.status,
        current_version=0,
        meta=payload.meta,
        created_by=actor.actor_id,
        updated_by=actor.actor_id,
    )
    db.add(doc)
    db.flush()

    write_audit_event(
        db,
        fund_id=fund_id,
        action="documents.document.create",
        entity_type="document",
        entity_id=doc.id,
        before=None,
        after=sa_model_to_dict(doc),
    )
    db.commit()
    db.refresh(doc)
    return doc


def create_version(
    db: Session, *, fund_id: uuid.UUID, actor: Actor, document_id: uuid.UUID, payload: DocumentVersionCreate
) -> DocumentVersion:
    doc = db.execute(select(Document).where(Document.fund_id == fund_id, Document.id == document_id)).scalar_one()
    doc_before = sa_model_to_dict(doc)

    ver = DocumentVersion(
        fund_id=fund_id,
        document_id=doc.id,
        version_number=payload.version_number,
        blob_uri=payload.blob_uri,
        checksum=payload.checksum,
        file_size_bytes=payload.file_size_bytes,
        is_final=payload.is_final,
        meta=payload.meta,
        created_by=actor.actor_id,
        updated_by=actor.actor_id,
    )
    db.add(ver)
    db.flush()

    doc.current_version = max(doc.current_version, payload.version_number)
    doc.updated_by = actor.actor_id

    write_audit_event(
        db,
        fund_id=fund_id,
        action="documents.document_version.create",
        entity_type="document_version",
        entity_id=ver.id,
        before=None,
        after=sa_model_to_dict(ver),
    )
    write_audit_event(
        db,
        fund_id=fund_id,
        action="documents.document.update_current_version",
        entity_type="document",
        entity_id=doc.id,
        before=doc_before,
        after=sa_model_to_dict(doc),
    )
    db.commit()
    db.refresh(ver)
    return ver

