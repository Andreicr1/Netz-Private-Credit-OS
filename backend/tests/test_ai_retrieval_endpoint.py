from __future__ import annotations

import json
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.db.models import AuditEvent, Fund
from app.domain.documents.enums import DocumentIngestionStatus
from app.modules.documents.models import Document, DocumentVersion
from app.services.search_index import ChunkSearchHit


def _dev_actor_header(actor_id: str, roles: list[str], fund_ids: list[uuid.UUID]) -> str:
    return json.dumps({"actor_id": actor_id, "roles": roles, "fund_ids": [str(x) for x in fund_ids]})


def test_ai_retrieve_returns_chunks_and_writes_audit(monkeypatch, client: TestClient, db_session: Session):
    fund_id = uuid.uuid4()
    db_session.add(Fund(id=fund_id, name="Fund X"))

    doc_id = uuid.uuid4()
    ver_id = uuid.uuid4()
    db_session.add(
        Document(
            id=doc_id,
            fund_id=fund_id,
            access_level="internal",
            source="dataroom",
            document_type="DATAROOM",
            title="Offering Memo.pdf",
            status="uploaded",
            current_version=2,
            root_folder="11 Offering Documents",
            folder_path="11 Offering Documents",
            created_by="t",
            updated_by="t",
        )
    )
    db_session.add(
        DocumentVersion(
            id=ver_id,
            fund_id=fund_id,
            access_level="internal",
            document_id=doc_id,
            version_number=2,
            blob_uri="https://example.blob/dataroom/x/v2.pdf",
            blob_path="11 Offering Documents/x/v2.pdf",
            checksum="a" * 64,
            file_size_bytes=10,
            is_final=False,
            ingestion_status=DocumentIngestionStatus.INDEXED,
            created_by="t",
            updated_by="t",
        )
    )
    db_session.commit()

    # Patch search client
    from app.modules.ai import routes as ai_routes

    class _DummyChunksClient:
        def search(self, *, q: str, fund_id: str, root_folder: str | None, top: int = 5):
            return [
                ChunkSearchHit(
                    chunk_id=str(uuid.uuid4()),
                    fund_id=fund_id,
                    document_id=str(doc_id),
                    version_id=str(ver_id),
                    root_folder="11 Offering Documents",
                    folder_path="11 Offering Documents",
                    title="Offering Memo.pdf",
                    chunk_index=0,
                    content_text="Redemption terms are ...",
                    uploaded_at=None,
                    score=1.0,
                )
            ]

    monkeypatch.setattr(ai_routes, "AzureSearchChunksClient", lambda: _DummyChunksClient())

    headers = {"X-DEV-ACTOR": _dev_actor_header("u1", ["GP"], [fund_id])}
    r = client.post(
        f"/funds/{fund_id}/ai/retrieve",
        headers=headers,
        json={"query": "What are the redemption terms?", "root_folder": "11 Offering Documents", "top_k": 5},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["results"]) == 1
    assert body["results"][0]["version_id"] == str(ver_id)
    assert "dataroom/" in (body["results"][0]["source_blob"] or "")

    evs = db_session.query(AuditEvent).filter(AuditEvent.fund_id == fund_id).all()
    actions = {e.action for e in evs}
    assert "AI_RETRIEVAL_QUERY" in actions
    assert "AI_RETRIEVAL_RESULTS_RETURNED" in actions


def test_ai_retrieve_rbac_blocks_investor(monkeypatch, client: TestClient, db_session: Session):
    fund_id = uuid.uuid4()
    db_session.add(Fund(id=fund_id, name="Fund X"))
    db_session.commit()

    # Search client won't be called due to RBAC
    headers = {"X-DEV-ACTOR": _dev_actor_header("u2", ["INVESTOR"], [fund_id])}
    r = client.post(f"/funds/{fund_id}/ai/retrieve", headers=headers, json={"query": "abc", "top_k": 5})
    assert r.status_code == 403

