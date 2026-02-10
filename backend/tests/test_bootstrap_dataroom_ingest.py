from __future__ import annotations

import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.db.models import AuditEvent
from app.modules.documents.models import Document, DocumentVersion
from scripts.bootstrap_dataroom_ingest import bootstrap_import


class _UploadSpyResult:
    def __init__(self, blob_uri: str):
        self.blob_uri = blob_uri
        self.etag = "etag"
        self.version_id = "vid"
        self.sha256 = "x" * 64
        self.size_bytes = 1


class _UploadSpy:
    def __init__(self):
        self.calls: list[dict] = []

    def __call__(self, *, container: str, blob_name: str, data: bytes, content_type: str | None, metadata=None):
        self.calls.append(
            {"container": container, "blob_name": blob_name, "size": len(data), "content_type": content_type, "metadata": metadata}
        )
        return _UploadSpyResult(blob_uri=f"https://example.blob/{container}/{blob_name}")


def _write_pdf(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def test_bootstrap_import_creates_registry_and_is_idempotent(db_session: Session, tmp_path: Path):
    fund_id = uuid.uuid4()
    local_root = tmp_path / "Data Room"

    _write_pdf(local_root / "5 KYC" / "Investor A" / "passport.pdf", b"%PDF-1.4 A")
    _write_pdf(local_root / "11 Audit" / "Moore" / "2026" / "audit.pdf", b"%PDF-1.4 B")
    _write_pdf(local_root / "1 Corporate Documentation" / "incorporation.pdf", b"%PDF-1.4 C")

    spy = _UploadSpy()

    counts1 = bootstrap_import(
        db=db_session,
        fund_id=fund_id,
        local_path=local_root,
        root_prefix="dataroom/",
        actor_id="bootstrap-cli",
        upload_func=spy,
    )
    assert counts1.total_files == 3
    assert counts1.imported_files == 3
    assert counts1.skipped_files == 0

    docs = db_session.query(Document).filter(Document.fund_id == fund_id).all()
    assert len(docs) == 3

    vers = db_session.query(DocumentVersion).join(Document, Document.id == DocumentVersion.document_id).filter(Document.fund_id == fund_id).all()
    assert len(vers) == 3
    assert all(v.version_number == 1 for v in vers)

    assert len(spy.calls) == 3
    assert all(c["blob_name"].startswith("dataroom/") for c in spy.calls)
    assert all(c["blob_name"].endswith("/v1.pdf") for c in spy.calls)

    # Rerun: idempotent (no new versions, no uploads)
    spy2 = _UploadSpy()
    counts2 = bootstrap_import(
        db=db_session,
        fund_id=fund_id,
        local_path=local_root,
        root_prefix="dataroom/",
        actor_id="bootstrap-cli",
        upload_func=spy2,
    )
    assert counts2.imported_files == 0
    assert counts2.changed_files == 0
    assert counts2.skipped_files == 3
    assert len(spy2.calls) == 0

    vers2 = db_session.query(DocumentVersion).join(Document, Document.id == DocumentVersion.document_id).filter(Document.fund_id == fund_id).all()
    assert len(vers2) == 3

    # Change one file -> new version + upload called
    _write_pdf(local_root / "5 KYC" / "Investor A" / "passport.pdf", b"%PDF-1.4 A CHANGED")
    spy3 = _UploadSpy()
    counts3 = bootstrap_import(
        db=db_session,
        fund_id=fund_id,
        local_path=local_root,
        root_prefix="dataroom/",
        actor_id="bootstrap-cli",
        upload_func=spy3,
    )
    assert counts3.changed_files == 1
    assert len(spy3.calls) == 1
    assert spy3.calls[0]["blob_name"].endswith("/v2.pdf")

    # Single aggregate audit event written each run
    events = db_session.query(AuditEvent).filter(AuditEvent.fund_id == fund_id, AuditEvent.action == "DATAROOM_BOOTSTRAP_IMPORT").all()
    assert len(events) == 3

