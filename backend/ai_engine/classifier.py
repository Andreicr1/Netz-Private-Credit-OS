from __future__ import annotations

import datetime as dt
import uuid
from hashlib import sha1

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.modules.ai.models import DocumentRegistry
from app.modules.documents.models import Document, DocumentVersion
from app.services.search_index import AzureSearchMetadataClient


INSTITUTIONAL_TYPES: tuple[str, ...] = (
    "MARKETING_PROMOTIONAL",
    "LEGAL_BINDING",
    "REGULATORY_CIMA",
    "FINANCIAL_REPORTING",
    "OPERATIONAL_EVIDENCE",
    "INVESTMENT_COMMITTEE",
    "KYC_AML",
    "GOVERNANCE_BOARD",
)


def _now_utc() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _to_seconds_delta(reference: dt.datetime | None, now: dt.datetime) -> int | None:
    if reference is None:
        return None
    if reference.tzinfo is None:
        reference = reference.replace(tzinfo=dt.timezone.utc)
    return max(0, int((now - reference).total_seconds()))


def _normalize(value: str | None) -> str:
    return (value or "").strip().lower()


def _classify_document(*, title: str | None, root_folder: str | None, folder_path: str | None) -> str:
    text = " ".join([_normalize(title), _normalize(root_folder), _normalize(folder_path)])

    if any(token in text for token in ["cima", "regulatory", "regulation", "compliance manual"]):
        return "REGULATORY_CIMA"
    if any(token in text for token in ["lpa", "offering", "subscription", "admin agreement", "engagement", "custodian", "legal"]):
        return "LEGAL_BINDING"
    if any(token in text for token in ["marketing", "deck", "brochure", "teaser", "factsheet", "pitch"]):
        return "MARKETING_PROMOTIONAL"
    if any(token in text for token in ["audit", "financial", "statement", "nav", "valuation", "report"]):
        return "FINANCIAL_REPORTING"
    if any(token in text for token in ["investment committee", "ic memo", "approval memo"]):
        return "INVESTMENT_COMMITTEE"
    if any(token in text for token in ["kyc", "aml", "know your customer", "anti-money laundering"]):
        return "KYC_AML"
    if any(token in text for token in ["board", "minutes", "governance"]):
        return "GOVERNANCE_BOARD"
    return "OPERATIONAL_EVIDENCE"


def classify_documents(
    db: Session,
    *,
    fund_id: uuid.UUID,
    path: str | None = None,
    actor_id: str = "ai-engine",
) -> list[DocumentRegistry]:
    now = _now_utc()
    prefix = (path or "").strip().lower()

    stmt = (
        select(Document, DocumentVersion)
        .join(
            DocumentVersion,
            and_(
                DocumentVersion.document_id == Document.id,
                DocumentVersion.version_number == Document.current_version,
            ),
        )
        .where(
            Document.fund_id == fund_id,
            Document.source == "dataroom",
            DocumentVersion.fund_id == fund_id,
        )
        .order_by(Document.updated_at.desc())
    )
    rows = list(db.execute(stmt).all())

    saved: list[DocumentRegistry] = []
    for document, version in rows:
        if prefix:
            full_path = f"{(document.root_folder or '').strip()}/{(document.folder_path or '').strip()}".lower()
            if prefix not in full_path and prefix not in (document.root_folder or "").lower():
                continue

        institutional_type = _classify_document(
            title=document.title,
            root_folder=document.root_folder,
            folder_path=document.folder_path,
        )
        if institutional_type not in INSTITUTIONAL_TYPES:
            institutional_type = "OPERATIONAL_EVIDENCE"

        data_latency = _to_seconds_delta(version.uploaded_at or version.updated_at, now)
        source_key = f"{fund_id}:{version.id}:{institutional_type}"

        existing = db.execute(
            select(DocumentRegistry).where(
                DocumentRegistry.fund_id == fund_id,
                DocumentRegistry.version_id == version.id,
            )
        ).scalar_one_or_none()

        payload = {
            "fund_id": fund_id,
            "access_level": "internal",
            "document_id": document.id,
            "version_id": version.id,
            "blob_path": version.blob_path,
            "root_folder": document.root_folder,
            "folder_path": document.folder_path,
            "title": document.title,
            "institutional_type": institutional_type,
            "source_signals": {
                "rule": "keyword+folder",
                "hash": sha1(source_key.encode("utf-8")).hexdigest(),
            },
            "classifier_version": "wave-ai1-v1",
            "as_of": now,
            "data_latency": data_latency,
            "data_quality": "OK",
            "created_by": actor_id,
            "updated_by": actor_id,
        }

        if existing is None:
            row = DocumentRegistry(**payload)
            db.add(row)
            db.flush()
        else:
            for key, value in payload.items():
                if key == "created_by":
                    continue
                setattr(existing, key, value)
            row = existing
            db.flush()

        saved.append(row)

    if saved:
        try:
            search_docs = [
                {
                    "id": f"ai-doc-registry-{item.id}",
                    "fund_id": str(item.fund_id),
                    "title": item.title or "Untitled",
                    "content": f"{item.institutional_type} | {(item.root_folder or '')}/{(item.folder_path or '')}",
                    "doc_type": "AI_DOCUMENT_REGISTRY",
                    "version": str(item.version_id),
                    "uploaded_at": item.as_of.isoformat(),
                }
                for item in saved
            ]
            AzureSearchMetadataClient().upsert_documents(items=search_docs)
        except Exception:
            for item in saved:
                item.data_quality = "DEGRADED"
                item.updated_by = actor_id

    db.commit()
    return saved
