from __future__ import annotations

import json
import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.db.models import Fund
from app.domain.documents.enums import DocumentIngestionStatus
from app.modules.documents.models import Document, DocumentChunk, DocumentVersion
from app.services.search_index import ChunkSearchHit


def _dev_actor_header(actor_id: str, roles: list[str], fund_ids: list[uuid.UUID]) -> str:
    return json.dumps({"actor_id": actor_id, "roles": roles, "fund_ids": [str(x) for x in fund_ids]})


def test_ai_answer_without_citations_returns_insufficient(monkeypatch, client: TestClient, db_session: Session):
    fund_id = uuid.uuid4()
    db_session.add(Fund(id=fund_id, name="Fund X"))

    doc_id = uuid.uuid4()
    ver_id = uuid.uuid4()
    chunk_id = uuid.uuid4()

    db_session.add(
        Document(
            id=doc_id,
            fund_id=fund_id,
            access_level="internal",
            source="dataroom",
            document_type="DATAROOM",
            title="OM.pdf",
            status="uploaded",
            current_version=1,
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
            version_number=1,
            blob_uri="https://example.blob/dataroom/x/v1.pdf",
            blob_path="11 Offering Documents/x/v1.pdf",
            checksum="a" * 64,
            file_size_bytes=10,
            is_final=False,
            ingestion_status=DocumentIngestionStatus.INDEXED,
            created_by="t",
            updated_by="t",
        )
    )
    db_session.add(
        DocumentChunk(
            id=chunk_id,
            fund_id=fund_id,
            access_level="internal",
            document_id=doc_id,
            version_id=ver_id,
            chunk_index=0,
            text="Redemption terms are ...",
            embedding_vector=None,
            version_checksum="a" * 64,
            page_start=12,
            page_end=13,
            created_by="t",
            updated_by="t",
        )
    )
    db_session.commit()

    from app.modules.ai import routes as ai_routes

    class _DummySearch:
        def search(self, *, q: str, fund_id: str, root_folder: str | None, top: int = 5):
            return [
                ChunkSearchHit(
                    chunk_id=str(chunk_id),
                    fund_id=fund_id,
                    document_id=str(doc_id),
                    version_id=str(ver_id),
                    root_folder="11 Offering Documents",
                    folder_path="11 Offering Documents",
                    title="OM.pdf",
                    chunk_index=0,
                    content_text="Redemption terms are ...",
                    uploaded_at=None,
                    score=1.0,
                )
            ]

    monkeypatch.setattr(ai_routes, "AzureSearchChunksClient", lambda: _DummySearch())

    # LLM returns an answer but NO citations => must be rejected
    class _DummyLLM:
        def generate_answer(self, system_prompt: str, user_prompt: str):
            return type("R", (), {"output_text": '{"answer":"X","citations":[]}', "model": "dummy"})()

    monkeypatch.setattr(ai_routes, "FoundryResponsesClient", lambda: _DummyLLM())
    monkeypatch.setattr(ai_routes, "safe_parse_json_object", lambda s: json.loads(s))

    headers = {"X-DEV-ACTOR": _dev_actor_header("u1", ["GP"], [fund_id])}
    r = client.post(
        f"/funds/{fund_id}/ai/answer",
        headers=headers,
        json={"question": "What are the redemption terms?", "root_folder": "11 Offering Documents", "top_k": 5},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["answer"] == "Insufficient evidence in the Data Room"
    assert body["citations"] == []

