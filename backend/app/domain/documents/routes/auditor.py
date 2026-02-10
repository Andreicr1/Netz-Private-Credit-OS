from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db.session import get_db
from app.core.security.dependencies import require_fund_access
from app.core.security.rbac import require_role
from app.domain.documents.models.evidence import EvidenceDocument


router = APIRouter(tags=["Auditor"], dependencies=[Depends(require_fund_access())])


@router.get("/funds/{fund_id}/auditor/evidence")
def list_all_evidence(
    fund_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor=Depends(require_role(["AUDITOR", "ADMIN"])),
):
    return db.query(EvidenceDocument).filter(EvidenceDocument.fund_id == fund_id).all()

