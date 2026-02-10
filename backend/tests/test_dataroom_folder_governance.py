from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.db.models import AuditEvent
from app.modules.documents.models import Document, DocumentVersion


class _DummyWriteRes:
    def __init__(self, blob_uri: str, sha256: str, size_bytes: int = 10):
        self.blob_uri = blob_uri
        self.etag = "etag"
        self.version_id = "vid"
        self.sha256 = sha256
        self.size_bytes = size_bytes


class _DummySearch:
    def __init__(self):
        self.items = []

    def upsert_dataroom_metadata(self, *, items):
        self.items.extend(items)


@pytest.fixture()
def patch_external(monkeypatch):
    # Patch blob upload and search client so tests don't call Azure.
    from app.domain.documents import service as doc_service

    def _fake_upload_bytes_append_only(*, container, blob_name, data, content_type, metadata=None):
        # deterministic sha for assertions
        sha = "a" * 64
        return _DummyWriteRes(blob_uri=f"https://example.blob/{container}/{blob_name}", sha256=sha, size_bytes=len(data))

    monkeypatch.setattr(doc_service, "upload_bytes_append_only", _fake_upload_bytes_append_only)

    dummy = _DummySearch()

    class _DummyAzureSearchMetadataClient:
        def __init__(self):
            pass

        def upsert_dataroom_metadata(self, *, items):
            dummy.upsert_dataroom_metadata(items=items)

    monkeypatch.setattr(doc_service, "AzureSearchMetadataClient", _DummyAzureSearchMetadataClient)
    # Ensure indexing path is executed
    from app.core.config import settings

    settings.AZURE_SEARCH_ENDPOINT = "https://dummy.search.windows.net"
    settings.SEARCH_INDEX_NAME = "fund-documents-index"

    return dummy


def _dev_actor(fund_id: str, role: str = "ADMIN") -> dict[str, str]:
    return {"X-DEV-ACTOR": json.dumps({"actor_id": "u1", "roles": [role], "fund_ids": [fund_id]})}


def test_upload_invalid_root_fails(client: TestClient, seeded_fund: dict, patch_external):
    fund_id = seeded_fund["fund_id"]
    files = {"file": ("x.pdf", b"%PDF-1.4 dummy", "application/pdf")}
    data = {"root_folder": "99 Not Allowed", "title": "Doc X", "domain": "KYC"}
    r = client.post(f"/funds/{fund_id}/documents/upload", files=files, data=data, headers=_dev_actor(fund_id))
    assert r.status_code == 400


def test_upload_and_append_only_versioning(client: TestClient, seeded_fund: dict, db_session: Session, patch_external):
    fund_id = seeded_fund["fund_id"]
    files = {"file": ("om.pdf", b"%PDF-1.4 dummy", "application/pdf")}
    data = {"root_folder": "11 Audit", "subfolder_path": "Moore/2026", "title": "Audit Report", "domain": "AUDIT"}

    r1 = client.post(f"/funds/{fund_id}/documents/upload", files=files, data=data, headers=_dev_actor(fund_id))
    assert r1.status_code == 200, r1.text
    doc_id_1 = r1.json()["document_id"]
    blob_1 = r1.json()["blob_path"]
    assert blob_1.endswith("/v1.pdf")
    assert "11 Audit/Moore/2026" in blob_1

    r2 = client.post(f"/funds/{fund_id}/documents/upload", files=files, data=data, headers=_dev_actor(fund_id))
    assert r2.status_code == 200, r2.text
    doc_id_2 = r2.json()["document_id"]
    blob_2 = r2.json()["blob_path"]
    assert doc_id_2 == doc_id_1
    assert blob_2.endswith("/v2.pdf")

    # DB assertions
    doc = db_session.query(Document).filter(Document.id == uuid.UUID(doc_id_1)).one()
    assert doc.current_version == 2

    vers = (
        db_session.query(DocumentVersion)
        .filter(DocumentVersion.document_id == uuid.UUID(doc_id_1))
        .order_by(DocumentVersion.version_number.asc())
        .all()
    )
    assert [v.version_number for v in vers] == [1, 2]
    assert vers[0].blob_path.endswith("/v1.pdf")
    assert vers[1].blob_path.endswith("/v2.pdf")

    # Search sync called twice
    assert len(patch_external.items) == 2
    assert patch_external.items[0]["root_folder"] == "11 Audit"
    assert patch_external.items[0]["folder_path"].startswith("11 Audit/")


def test_admin_can_create_root_folder_and_upload(client: TestClient, seeded_fund: dict, db_session: Session, patch_external):
    fund_id = seeded_fund["fund_id"]
    new_root = "13 Side Letters"
    r = client.post(
        f"/funds/{fund_id}/documents/root-folders",
        json={"name": new_root},
        headers=_dev_actor(fund_id, role="ADMIN"),
    )
    assert r.status_code == 201, r.text

    # Now upload under new root should succeed
    files = {"file": ("x.pdf", b"%PDF-1.4 dummy", "application/pdf")}
    data = {"root_folder": new_root, "title": "Side Letter A", "domain": "OTHER"}
    r2 = client.post(f"/funds/{fund_id}/documents/upload", files=files, data=data, headers=_dev_actor(fund_id))
    assert r2.status_code == 200, r2.text

    # Audit event exists
    events = db_session.query(AuditEvent).filter(AuditEvent.fund_id == uuid.UUID(fund_id)).all()
    actions = {e.action for e in events}
    assert "ROOT_FOLDER_CREATED" in actions


def test_list_documents_filters(client: TestClient, seeded_fund: dict, patch_external):
    fund_id = seeded_fund["fund_id"]
    files = {"file": ("x.pdf", b"%PDF-1.4 dummy", "application/pdf")}

    client.post(
        f"/funds/{fund_id}/documents/upload",
        files=files,
        data={"root_folder": "5 KYC", "title": "KYC Pack", "domain": "KYC"},
        headers=_dev_actor(fund_id),
    )
    client.post(
        f"/funds/{fund_id}/documents/upload",
        files=files,
        data={"root_folder": "11 Audit", "title": "Audit 2026", "domain": "AUDIT"},
        headers=_dev_actor(fund_id),
    )

    r = client.get(f"/funds/{fund_id}/documents?root_folder=11%20Audit", headers=_dev_actor(fund_id))
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 1
    assert items[0]["root_folder"] == "11 Audit"

    r2 = client.get(f"/funds/{fund_id}/documents?q=KYC", headers=_dev_actor(fund_id))
    assert r2.status_code == 200
    assert len(r2.json()["items"]) == 1

