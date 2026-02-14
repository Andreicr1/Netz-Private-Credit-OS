from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.ai.models import DocumentClassification, DocumentGovernanceProfile, DocumentRegistry


AUTHORITY_RANK = {
    "NARRATIVE": 1,
    "INTELLIGENCE": 2,
    "EVIDENCE": 3,
    "POLICY": 4,
    "BINDING": 5,
}

DOC_TYPE_AUTHORITY_OVERRIDE = {
    "REGULATORY_CIMA": "BINDING",
    "FUND_CONSTITUTIONAL": "BINDING",
    "SERVICE_PROVIDER_CONTRACT": "BINDING",
    "INVESTOR_NARRATIVE": "NARRATIVE",
    "DEAL_MARKETING": "NARRATIVE",
}


def _resolve_authority(container_authority: str, doc_type: str) -> str:
    container_level = container_authority if container_authority in AUTHORITY_RANK else "EVIDENCE"
    override = DOC_TYPE_AUTHORITY_OVERRIDE.get(doc_type)

    if override is None:
        return container_level

    if container_level == "INTELLIGENCE" and override == "BINDING":
        return "INTELLIGENCE"

    return max([container_level, override], key=lambda value: AUTHORITY_RANK[value])


def _binding_scope(doc_type: str) -> str:
    if doc_type in {"REGULATORY_CIMA", "FUND_CONSTITUTIONAL", "RISK_POLICY_INTERNAL"}:
        return "FUND"
    if doc_type == "SERVICE_PROVIDER_CONTRACT":
        return "SERVICE_PROVIDER"
    if doc_type in {"INVESTMENT_MEMO", "DEAL_MARKETING"}:
        return "MANAGER"
    return "FUND"


def _jurisdiction(doc: DocumentRegistry, classification: DocumentClassification) -> str | None:
    source = f"{doc.container_name} {doc.blob_path} {classification.doc_type}".lower()
    if "cima" in source or "cayman" in source:
        return "Cayman Islands"
    if "uk" in source:
        return "United Kingdom"
    if "us" in source:
        return "United States"
    return None


def resolve_authority_profiles(
    db: Session,
    *,
    fund_id: uuid.UUID,
    actor_id: str = "ai-engine",
) -> list[DocumentGovernanceProfile]:
    rows = list(
        db.execute(
            select(DocumentRegistry, DocumentClassification)
            .join(DocumentClassification, DocumentClassification.doc_id == DocumentRegistry.id)
            .where(
                DocumentRegistry.fund_id == fund_id,
                DocumentClassification.fund_id == fund_id,
            )
        ).all()
    )

    saved: list[DocumentGovernanceProfile] = []
    for document, classification in rows:
        resolved = _resolve_authority(document.authority, classification.doc_type)
        profile_payload = {
            "fund_id": fund_id,
            "access_level": "internal",
            "doc_id": document.id,
            "resolved_authority": resolved,
            "binding_scope": _binding_scope(classification.doc_type),
            "shareability_final": document.shareability,
            "jurisdiction": _jurisdiction(document, classification),
            "created_by": actor_id,
            "updated_by": actor_id,
        }

        existing = db.execute(
            select(DocumentGovernanceProfile).where(
                DocumentGovernanceProfile.fund_id == fund_id,
                DocumentGovernanceProfile.doc_id == document.id,
            )
        ).scalar_one_or_none()

        if existing is None:
            row = DocumentGovernanceProfile(**profile_payload)
            db.add(row)
            db.flush()
        else:
            for key, value in profile_payload.items():
                if key == "created_by":
                    continue
                setattr(existing, key, value)
            row = existing
            db.flush()

        saved.append(row)

    db.commit()
    return saved
