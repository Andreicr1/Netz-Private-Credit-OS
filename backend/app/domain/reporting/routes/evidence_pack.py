from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db.session import get_db
from app.core.security.dependencies import require_fund_access
from app.core.security.rbac import require_role
from app.modules.ai.models import AIAnswer, AIAnswerCitation, AIQuestion


router = APIRouter(tags=["Evidence Pack"], dependencies=[Depends(require_fund_access())])


@router.post("/funds/{fund_id}/reports/evidence-pack")
def export_evidence_pack(
    fund_id: uuid.UUID,
    payload: dict | None = None,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["ADMIN", "GP", "COMPLIANCE", "AUDITOR"])),
):
    """
    v1 output: JSON manifest (future EPIC: PDF binder).
    """
    payload = payload or {}
    limit = int(payload.get("limit", 20))
    limit = max(1, min(200, limit))

    answers = list(
        db.execute(select(AIAnswer).where(AIAnswer.fund_id == fund_id).order_by(AIAnswer.created_at_utc.desc()).limit(limit)).scalars().all()
    )
    answer_ids = [a.id for a in answers]
    questions = list(
        db.execute(select(AIQuestion).where(AIQuestion.fund_id == fund_id, AIQuestion.id.in_([a.question_id for a in answers]))).scalars().all()
    )
    by_q = {q.id: q for q in questions}

    citations = []
    if answer_ids:
        citations = list(
            db.execute(select(AIAnswerCitation).where(AIAnswerCitation.fund_id == fund_id, AIAnswerCitation.answer_id.in_(answer_ids))).scalars().all()
        )
    by_answer: dict[uuid.UUID, list[AIAnswerCitation]] = {}
    for c in citations:
        by_answer.setdefault(c.answer_id, []).append(c)

    manifest = {
        "fund_id": str(fund_id),
        "generated_by": getattr(actor, "id", None),
        "items": [],
    }
    for a in answers:
        q = by_q.get(a.question_id)
        item = {
            "question_id": str(a.question_id),
            "answer_id": str(a.id),
            "question": q.question_text if q else None,
            "answer": a.answer_text,
            "created_at_utc": a.created_at_utc.isoformat() if a.created_at_utc else None,
            "citations": [
                {
                    "chunk_id": str(c.chunk_id),
                    "document_id": str(c.document_id),
                    "version_id": str(c.version_id),
                    "page_start": c.page_start,
                    "page_end": c.page_end,
                    "excerpt": c.excerpt,
                    "source_blob": c.source_blob,
                }
                for c in by_answer.get(a.id, [])
            ],
        }
        manifest["items"].append(item)
    return manifest

