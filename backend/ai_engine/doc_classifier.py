from __future__ import annotations

import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.ai.models import DocumentClassification, DocumentRegistry
from app.modules.documents.models import DocumentChunk, DocumentVersion
from app.services.blob_storage import blob_uri, download_bytes
from app.services.text_extract import extract_text_from_docx, extract_text_from_pdf


DOC_TYPES: tuple[str, ...] = (
    "FUND_CONSTITUTIONAL",
    "REGULATORY_CIMA",
    "SERVICE_PROVIDER_CONTRACT",
    "INVESTMENT_MEMO",
    "DEAL_MARKETING",
    "RISK_POLICY_INTERNAL",
    "AUDIT_EVIDENCE",
    "INVESTOR_NARRATIVE",
    "OTHER",
)


def _read_text_content(db: Session, doc: DocumentRegistry) -> str:
    if doc.version_id:
        chunks = list(
            db.execute(
                select(DocumentChunk.text)
                .join(DocumentVersion, DocumentVersion.id == DocumentChunk.version_id)
                .where(
                    DocumentChunk.fund_id == doc.fund_id,
                    DocumentChunk.version_id == doc.version_id,
                )
                .limit(50)
            ).all()
        )
        text = "\n".join((item[0] or "") for item in chunks)
        if text.strip():
            return text

    try:
        uri = blob_uri(doc.container_name, doc.blob_path)
        data = download_bytes(blob_uri=uri)
        suffix = Path(doc.blob_path).suffix.lower()
        if suffix == ".pdf":
            return extract_text_from_pdf(data).text
        if suffix == ".docx":
            return extract_text_from_docx(data).text
        return data.decode("utf-8", errors="ignore")
    except Exception:
        return ""


def _classify(doc: DocumentRegistry, content_text: str) -> tuple[str, int, str]:
    filename = (doc.blob_path or "").lower()
    domain = (doc.domain_tag or "").lower()
    container = (doc.container_name or "").lower()
    content = (content_text or "").lower()

    basis: list[str] = []

    if "regulatory" in container or "cima" in filename or "cima" in content:
        basis.extend(["container", "content"])
        return "REGULATORY_CIMA", 95, "|".join(sorted(set(basis)))

    if "constitution" in container or any(token in filename for token in ["lpa", "constitutional", "fund-rules"]):
        basis.append("filename")
        return "FUND_CONSTITUTIONAL", 93, "|".join(sorted(set(basis)))

    if "service-providers" in container or any(token in filename for token in ["agreement", "contract", "engagement"]):
        basis.append("container")
        if any(token in content for token in ["administrator", "custodian", "counsel", "service provider"]):
            basis.append("content")
        return "SERVICE_PROVIDER_CONTRACT", 90, "|".join(sorted(set(basis)))

    if "pipeline" in container and any(token in content for token in ["investment memo", "ic memo", "committee"]):
        return "INVESTMENT_MEMO", 88, "container|content"

    if "investor-facing" in container and any(token in filename for token in ["deck", "brochure", "factsheet", "teaser"]):
        return "DEAL_MARKETING", 86, "container|filename"

    if "risk_policy" in domain or "risk-policy" in container or "policy" in filename:
        return "RISK_POLICY_INTERNAL", 90, "container|filename"

    if "portfolio-monitoring" in container or any(token in filename for token in ["audit", "evidence", "statement"]):
        return "AUDIT_EVIDENCE", 84, "container|filename"

    if "investor-facing" in container:
        return "INVESTOR_NARRATIVE", 82, "container"

    return "OTHER", 60, "container"


def classify_registered_documents(
    db: Session,
    *,
    fund_id: uuid.UUID,
    actor_id: str = "ai-engine",
) -> list[DocumentClassification]:
    docs = list(
        db.execute(
            select(DocumentRegistry)
            .where(DocumentRegistry.fund_id == fund_id)
            .order_by(DocumentRegistry.updated_at.desc())
        ).scalars().all()
    )

    saved: list[DocumentClassification] = []
    for doc in docs:
        content_text = _read_text_content(db, doc)
        doc_type, confidence, basis = _classify(doc, content_text)

        existing = db.execute(
            select(DocumentClassification).where(
                DocumentClassification.fund_id == fund_id,
                DocumentClassification.doc_id == doc.id,
            )
        ).scalar_one_or_none()

        payload = {
            "fund_id": fund_id,
            "access_level": "internal",
            "doc_id": doc.id,
            "doc_type": doc_type,
            "confidence_score": int(confidence),
            "classification_basis": basis,
            "created_by": actor_id,
            "updated_by": actor_id,
        }

        if existing is None:
            row = DocumentClassification(**payload)
            db.add(row)
            db.flush()
        else:
            for key, value in payload.items():
                if key == "created_by":
                    continue
                setattr(existing, key, value)
            row = existing
            db.flush()

        doc.detected_doc_type = doc_type
        doc.updated_by = actor_id
        saved.append(row)

    db.commit()
    return saved
