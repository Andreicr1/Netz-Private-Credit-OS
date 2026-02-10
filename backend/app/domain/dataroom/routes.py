from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.db.session import get_db
from app.core.security.dependencies import get_actor
from app.core.security.rbac import require_role
from app.services.dataroom_ingest import ingest_document_version, upload_dataroom_document
from app.services.search_index import AzureSearchMetadataClient


router = APIRouter(prefix="/api/dataroom", tags=["Dataroom"])


def _require_fund_access_from_value(fund_id: uuid.UUID, actor=Depends(get_actor)) -> uuid.UUID:
    if not actor.can_access_fund(fund_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden for this fund")
    return fund_id


@router.post("/documents")
async def upload_document(
    fund_id: uuid.UUID = Form(...),
    title: str | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    actor=Depends(require_role(["INVESTMENT_TEAM", "COMPLIANCE", "GP", "ADMIN"])),
):
    _require_fund_access_from_value(fund_id, actor)
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="file is empty")
    res = upload_dataroom_document(
        db,
        fund_id=fund_id,
        actor=actor,
        title=title or file.filename or "Dataroom Document",
        filename=file.filename or "document",
        content_type=file.content_type,
        data=data,
    )
    return {
        "document_id": str(res.document.id),
        "version_number": res.version.version_number,
        "idempotent": res.idempotent,
        "sha256": res.document.sha256,
        "blob_uri": res.document.blob_uri,
    }


@router.post("/documents/{document_id}/ingest")
def ingest_document(
    document_id: uuid.UUID,
    fund_id: uuid.UUID = Query(...),
    version_number: int | None = Query(None),
    store_artifacts_in_evidence: bool = Query(True),
    db: Session = Depends(get_db),
    actor=Depends(require_role(["INVESTMENT_TEAM", "COMPLIANCE", "GP", "ADMIN"])),
):
    _require_fund_access_from_value(fund_id, actor)
    try:
        return ingest_document_version(
            db,
            fund_id=fund_id,
            actor=actor,
            document_id=document_id,
            version_number=version_number,
            store_artifacts_in_evidence=store_artifacts_in_evidence,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/search")
def search(
    fund_id: uuid.UUID = Query(...),
    q: str = Query(..., min_length=2, max_length=400),
    top: int = Query(5, ge=1, le=20),
    actor=Depends(require_role(["INVESTMENT_TEAM", "COMPLIANCE", "GP", "ADMIN", "AUDITOR"])),
):
    _require_fund_access_from_value(fund_id, actor)
    client = AzureSearchMetadataClient()
    hits = client.search(q=q, fund_id=str(fund_id), top=top)
    return {"query": q, "count": len(hits), "hits": [h.__dict__ for h in hits]}

