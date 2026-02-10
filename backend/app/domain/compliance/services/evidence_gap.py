from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import uuid
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db.audit import write_audit_event
from app.modules.compliance.models import Obligation
from app.shared.utils import sa_model_to_dict


AI_GAP_PREFIX = "AI Evidence Gap:"


@dataclass(frozen=True)
class GapResult:
    has_gap: bool
    reason: str
    details: dict[str, Any]
    obligation_name: str | None = None
    obligation_description: str | None = None


def detect_evidence_gap(*, question: str, retrieved_chunks: list[dict[str, Any]]) -> GapResult:
    q = (question or "").strip().lower()
    if not retrieved_chunks:
        return GapResult(
            has_gap=True,
            reason="no_evidence",
            details={"question": question},
            obligation_name=f"{AI_GAP_PREFIX} Missing evidence for question",
            obligation_description=f"AI could not find evidence in Data Room for question: {question}",
        )

    # Heuristics (future: structured doc expectations and expiry rules)
    if "financial" in q or "statements" in q:
        # If chunks are not from Audit root folder, flag as gap
        roots = {c.get("root_folder") for c in retrieved_chunks}
        if "11 Audit" not in roots:
            return GapResult(
                has_gap=True,
                reason="expected_financials_not_found",
                details={"roots": sorted([r for r in roots if r])},
                obligation_name=f"{AI_GAP_PREFIX} Financial statements evidence missing",
                obligation_description="Expected evidence (financial statements) not found under Audit/Financial statements.",
            )

    # Outdated version detection (if current_version present in chunk detail and is higher)
    outdated = [c for c in retrieved_chunks if c.get("is_outdated")]
    if outdated:
        return GapResult(
            has_gap=True,
            reason="outdated_version",
            details={"outdated_count": len(outdated)},
            obligation_name=f"{AI_GAP_PREFIX} Outdated document version used",
            obligation_description="AI retrieval used outdated document version(s). Upload latest version and re-ingest.",
        )

    return GapResult(has_gap=False, reason="ok", details={})


def create_obligation_from_gap(
    db: Session,
    *,
    fund_id: uuid.UUID,
    actor_id: str,
    gap: GapResult,
) -> Obligation | None:
    if not gap.has_gap or not gap.obligation_name:
        return None

    # Idempotent: one active obligation per name
    existing = db.execute(
        select(Obligation).where(Obligation.fund_id == fund_id, Obligation.name == gap.obligation_name, Obligation.is_active.is_(True))
    ).scalar_one_or_none()
    if existing:
        return existing

    ob = Obligation(
        fund_id=fund_id,
        access_level="internal",
        name=gap.obligation_name,
        regulator="CIMA",
        description=gap.obligation_description,
        is_active=True,
        created_by=actor_id,
        updated_by=actor_id,
    )
    db.add(ob)
    db.flush()

    write_audit_event(
        db,
        fund_id=fund_id,
        actor_id=actor_id,
        action="COMPLIANCE_GAP_DETECTED",
        entity_type="fund",
        entity_id=str(fund_id),
        before=None,
        after={"reason": gap.reason, "details": gap.details, "obligation_name": gap.obligation_name},
    )
    write_audit_event(
        db,
        fund_id=fund_id,
        actor_id=actor_id,
        action="OBLIGATION_CREATED_FROM_AI",
        entity_type="obligation",
        entity_id=ob.id,
        before=None,
        after=sa_model_to_dict(ob),
    )
    db.commit()
    db.refresh(ob)
    return ob

