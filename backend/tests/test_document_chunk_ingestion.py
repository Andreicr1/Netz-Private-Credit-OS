from __future__ import annotations

import json
import uuid

import pytest
from sqlalchemy.orm import Session

from app.core.db.models import AuditEvent
from app.domain.documents.enums import DocumentIngestionStatus
from app.modules.documents.models import Document, DocumentChunk, DocumentVersion


class _DummySearch:
    def __init__(self):
        self.items = []

    def upsert_chunks(self, *, items):
        self.items.extend(items)


def test_ingestion_worker_generates_chunks_and_indexes(monkeypatch, db_session: Session):
    fund_id = uuid.uuid4()
    doc_id = uuid.uuid4()
    ver_id = uuid.uuid4()

    doc = Document(
        id=doc_id,
        fund_id=fund_id,
        access_level="internal",
        source="dataroom",
        document_type="DATAROOM",
        title="om.pdf",
        status="uploaded",
        current_version=1,
        root_folder="11 Offering Documents",
        folder_path="11 Offering Documents",
        created_by="t",
        updated_by="t",
    )
    ver = DocumentVersion(
        id=ver_id,
        fund_id=fund_id,
        access_level="internal",
        document_id=doc_id,
        version_number=1,
        blob_uri="https://example.blob/dataroom/om/v1.pdf",
        blob_path="dataroom/11 Offering Documents/om/v1.pdf",
        checksum="a" * 64,
        file_size_bytes=10,
        is_final=False,
        uploaded_by="u1",
        uploaded_at=None,
        ingestion_status=DocumentIngestionStatus.PENDING,
        created_by="u1",
        updated_by="u1",
    )
    db_session.add(doc)
    db_session.add(ver)
    db_session.commit()

    # Patch external calls in worker
    from app.domain.documents.services import ingestion_worker as w
    from app.services.document_text_extractor import ExtractedPdfText

    monkeypatch.setattr(w, "download_bytes", lambda blob_uri: b"%PDF-1.4 dummy")
    monkeypatch.setattr(
        w,
        "extract_pdf_pages",
        lambda data: ExtractedPdfText(pages=["[PAGE 1]\nRedemption terms...", "[PAGE 2]\nMore text..."]),
    )

    dummy = _DummySearch()

    class _DummyClient:
        def __init__(self):
            pass

        def upsert_chunks(self, *, items):
            dummy.upsert_chunks(items=items)

    monkeypatch.setattr(w, "AzureSearchChunksClient", _DummyClient)

    # Run ingestion
    w.process_version(db_session, fund_id=fund_id, version_id=ver_id, actor_id="worker-test")

    # Chunks persisted
    chunks = db_session.query(DocumentChunk).filter(DocumentChunk.fund_id == fund_id, DocumentChunk.version_id == ver_id).all()
    assert len(chunks) >= 1
    assert chunks[0].text

    # Version status updated
    v2 = db_session.query(DocumentVersion).filter(DocumentVersion.id == ver_id).one()
    assert v2.ingestion_status == DocumentIngestionStatus.INDEXED
    assert v2.indexed_at is not None

    # Search upsert called
    assert len(dummy.items) == len(chunks)
    assert all(it["fund_id"] == str(fund_id) for it in dummy.items)

    # Audit events
    evs = db_session.query(AuditEvent).filter(AuditEvent.fund_id == fund_id).all()
    actions = {e.action for e in evs}
    assert "DOCUMENT_TEXT_EXTRACTED" in actions
    assert "DOCUMENT_CHUNKED" in actions
    assert "DOCUMENT_CHUNKS_INDEXED" in actions

