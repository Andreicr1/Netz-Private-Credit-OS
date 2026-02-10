from __future__ import annotations

import hashlib
import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db.audit import write_audit_event
from app.core.security.auth import Actor
from app.modules.documents.models import Document, DocumentVersion
from app.services.blob_storage import download_bytes, upload_bytes_idempotent
from app.services.chunking import simple_chunk_text
from app.services.embeddings import generate_embeddings
from app.services.search_index import AzureSearchMetadataClient
from app.services.text_extract import ExtractResult, extract_text_from_docx, extract_text_from_pdf
from app.shared.utils import sa_model_to_dict


@dataclass(frozen=True)
class DataroomUploadResult:
    document: Document
    version: DocumentVersion
    idempotent: bool


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _safe_filename(name: str) -> str:
    # minimal; keep stable and avoid path traversal
    return name.replace("\\", "_").replace("/", "_")


def upload_dataroom_document(
    db: Session,
    *,
    fund_id: uuid.UUID,
    actor: Actor,
    title: str,
    filename: str,
    content_type: str | None,
    data: bytes,
) -> DataroomUploadResult:
    sha = hashlib.sha256(data).hexdigest()

    existing = db.execute(
        select(Document).where(Document.fund_id == fund_id, Document.source == "dataroom", Document.sha256 == sha)
    ).scalar_one_or_none()

    # Deterministic blob name for idempotence
    safe = _safe_filename(filename)
    blob_name = f"{fund_id}/{sha}/{safe}"
    write_res = upload_bytes_idempotent(
        container=settings.AZURE_STORAGE_DATAROOM_CONTAINER,
        blob_name=blob_name,
        data=data,
        content_type=content_type,
        metadata={"fund_id": str(fund_id), "sha256": sha, "source": "dataroom"},
    )

    if existing:
        # Ensure we have a version record for v1 with the same checksum (idempotent)
        ver = db.execute(
            select(DocumentVersion).where(
                DocumentVersion.fund_id == fund_id,
                DocumentVersion.document_id == existing.id,
                DocumentVersion.checksum == sha,
            )
        ).scalar_one_or_none()
        if ver:
            return DataroomUploadResult(document=existing, version=ver, idempotent=True)

        # Fall back: create a new version number
        next_ver = existing.current_version + 1
        ver = DocumentVersion(
            fund_id=fund_id,
            access_level=existing.access_level,
            document_id=existing.id,
            version_number=next_ver,
            blob_uri=write_res.blob_uri,
            checksum=sha,
            file_size_bytes=write_res.size_bytes,
            is_final=False,
            content_type=content_type,
            meta={"etag": write_res.etag, "version_id": write_res.version_id, "source": "dataroom"},
            created_by=actor.actor_id,
            updated_by=actor.actor_id,
        )
        db.add(ver)
        db.flush()

        before = sa_model_to_dict(existing)
        existing.current_version = next_ver
        existing.updated_by = actor.actor_id

        write_audit_event(
            db,
            fund_id=fund_id,
            actor_id=actor.actor_id,
            action="dataroom.document_version.create",
            entity_type="document_version",
            entity_id=ver.id,
            before=None,
            after=sa_model_to_dict(ver),
        )
        write_audit_event(
            db,
            fund_id=fund_id,
            actor_id=actor.actor_id,
            action="dataroom.document.update_current_version",
            entity_type="document",
            entity_id=existing.id,
            before=before,
            after=sa_model_to_dict(existing),
        )
        db.commit()
        db.refresh(existing)
        db.refresh(ver)
        return DataroomUploadResult(document=existing, version=ver, idempotent=False)

    # Create new document + v1
    doc = Document(
        fund_id=fund_id,
        access_level="internal",
        source="dataroom",
        document_type="DATAROOM",
        title=title,
        status="uploaded",
        current_version=1,
        blob_uri=write_res.blob_uri,
        content_type=content_type,
        original_filename=safe,
        sha256=sha,
        meta={"etag": write_res.etag, "version_id": write_res.version_id},
        created_by=actor.actor_id,
        updated_by=actor.actor_id,
    )
    db.add(doc)
    db.flush()

    ver = DocumentVersion(
        fund_id=fund_id,
        access_level="internal",
        document_id=doc.id,
        version_number=1,
        blob_uri=write_res.blob_uri,
        checksum=sha,
        file_size_bytes=write_res.size_bytes,
        is_final=False,
        content_type=content_type,
        meta={"etag": write_res.etag, "version_id": write_res.version_id, "source": "dataroom"},
        created_by=actor.actor_id,
        updated_by=actor.actor_id,
    )
    db.add(ver)
    db.flush()

    write_audit_event(
        db,
        fund_id=fund_id,
        actor_id=actor.actor_id,
        action="dataroom.document.create",
        entity_type="document",
        entity_id=doc.id,
        before=None,
        after=sa_model_to_dict(doc),
    )
    write_audit_event(
        db,
        fund_id=fund_id,
        actor_id=actor.actor_id,
        action="dataroom.document_version.create",
        entity_type="document_version",
        entity_id=ver.id,
        before=None,
        after=sa_model_to_dict(ver),
    )

    db.commit()
    db.refresh(doc)
    db.refresh(ver)
    return DataroomUploadResult(document=doc, version=ver, idempotent=False)


def _extract_text(*, content_type: str | None, filename: str, data: bytes) -> ExtractResult:
    ct = (content_type or "").lower()
    fn = filename.lower()
    if "pdf" in ct or fn.endswith(".pdf"):
        return extract_text_from_pdf(data)
    if "word" in ct or fn.endswith(".docx"):
        return extract_text_from_docx(data)
    # fallback: treat as utf-8 text if possible
    try:
        return ExtractResult(text=data.decode("utf-8", errors="replace"), method="utf-8-fallback", page_count=None)
    except Exception:
        return ExtractResult(text="", method="unsupported", page_count=None)


def ingest_document_version(
    db: Session,
    *,
    fund_id: uuid.UUID,
    actor: Actor,
    document_id: uuid.UUID,
    version_number: int | None = None,
    store_artifacts_in_evidence: bool = True,
) -> dict[str, Any]:
    doc = db.execute(select(Document).where(Document.fund_id == fund_id, Document.id == document_id)).scalar_one()
    ver_num = version_number or doc.current_version
    ver = db.execute(
        select(DocumentVersion).where(
            DocumentVersion.fund_id == fund_id,
            DocumentVersion.document_id == document_id,
            DocumentVersion.version_number == ver_num,
        )
    ).scalar_one()

    before_ver = sa_model_to_dict(ver)
    ver.ingest_status = "INGESTING"
    ver.updated_by = actor.actor_id
    write_audit_event(
        db,
        fund_id=fund_id,
        actor_id=actor.actor_id,
        action="dataroom.ingest.started",
        entity_type="document_version",
        entity_id=ver.id,
        before=before_ver,
        after=sa_model_to_dict(ver),
    )
    db.commit()

    if not ver.blob_uri:
        before = sa_model_to_dict(ver)
        ver.ingest_status = "FAILED"
        ver.ingest_error = {"error": "missing_blob_uri"}
        ver.updated_by = actor.actor_id
        write_audit_event(
            db,
            fund_id=fund_id,
            actor_id=actor.actor_id,
            action="dataroom.ingest.failed",
            entity_type="document_version",
            entity_id=ver.id,
            before=before,
            after=sa_model_to_dict(ver),
        )
        db.commit()
        raise ValueError("document_version.blob_uri is missing")

    data = download_bytes(blob_uri=ver.blob_uri)
    return ingest_from_bytes(
        db,
        fund_id=fund_id,
        actor=actor,
        document_id=document_id,
        version_number=ver_num,
        filename=doc.original_filename or "document",
        content_type=ver.content_type or doc.content_type,
        data=data,
        store_artifacts_in_evidence=store_artifacts_in_evidence,
    )


def ingest_from_bytes(
    db: Session,
    *,
    fund_id: uuid.UUID,
    actor: Actor,
    document_id: uuid.UUID,
    version_number: int,
    filename: str,
    content_type: str | None,
    data: bytes,
    store_artifacts_in_evidence: bool = True,
) -> dict[str, Any]:
    doc = db.execute(select(Document).where(Document.fund_id == fund_id, Document.id == document_id)).scalar_one()
    ver = db.execute(
        select(DocumentVersion).where(
            DocumentVersion.fund_id == fund_id,
            DocumentVersion.document_id == document_id,
            DocumentVersion.version_number == version_number,
        )
    ).scalar_one()

    extract = _extract_text(content_type=content_type, filename=filename, data=data)
    chunks = simple_chunk_text(text=extract.text)
    emb = generate_embeddings(inputs=[c.content for c in chunks])

    uploaded_at = _utcnow().isoformat()
    # Index each chunk as a separate Search doc; key is deterministic and stable.
    search_docs: list[dict[str, Any]] = []
    for c in chunks:
        search_docs.append(
            {
                "id": f"{fund_id}:{document_id}:{version_number}:{c.chunk_id}",
                "fund_id": str(fund_id),
                "title": doc.title,
                "content": c.content,
                "doc_type": doc.document_type,
                "version": str(version_number),
                "uploaded_at": uploaded_at,
            }
        )

    # Optional evidence artifacts
    artifacts: dict[str, Any] = {
        "doc_id": str(document_id),
        "version": version_number,
        "sha256": ver.checksum,
        "extract": {"method": extract.method, "page_count": extract.page_count, "text_len": len(extract.text)},
        "chunking": {"chunks": len(chunks), "max_chars": 1200, "overlap": 200},
        "embeddings": {
            "provider": emb.provider,
            "model": emb.model,
            "generated": bool(emb.vectors is not None),
            "skipped_reason": emb.skipped_reason,
            "vectors_count": (len(emb.vectors) if emb.vectors is not None else None),
        },
        "search": {"index": getattr(settings, "SEARCH_INDEX_NAME", None)},
        "timestamp_utc": uploaded_at,
    }

    extracted_text_blob_uri = None
    manifest_blob_uri = None
    embeddings_blob_uri = None
    if store_artifacts_in_evidence:
        # Store extracted text + manifest JSON in evidence
        extracted_blob_name = f"{fund_id}/dataroom/{document_id}/v{version_number}/extracted.txt"
        manifest_blob_name = f"{fund_id}/dataroom/{document_id}/v{version_number}/ingest_manifest.json"
        extracted_res = upload_bytes_idempotent(
            container=settings.AZURE_STORAGE_EVIDENCE_CONTAINER,
            blob_name=extracted_blob_name,
            data=extract.text.encode("utf-8"),
            content_type="text/plain; charset=utf-8",
            metadata={"fund_id": str(fund_id), "document_id": str(document_id), "kind": "extracted_text"},
        )
        manifest_res = upload_bytes_idempotent(
            container=settings.AZURE_STORAGE_EVIDENCE_CONTAINER,
            blob_name=manifest_blob_name,
            data=json.dumps(artifacts, ensure_ascii=False, indent=2).encode("utf-8"),
            content_type="application/json",
            metadata={"fund_id": str(fund_id), "document_id": str(document_id), "kind": "ingest_manifest"},
        )
        extracted_text_blob_uri = extracted_res.blob_uri
        manifest_blob_uri = manifest_res.blob_uri
        if emb.vectors is not None:
            embeddings_blob_name = f"{fund_id}/dataroom/{document_id}/v{version_number}/embeddings.json"
            emb_res = upload_bytes_idempotent(
                container=settings.AZURE_STORAGE_EVIDENCE_CONTAINER,
                blob_name=embeddings_blob_name,
                data=json.dumps({"vectors": emb.vectors}, ensure_ascii=False).encode("utf-8"),
                content_type="application/json",
                metadata={"fund_id": str(fund_id), "document_id": str(document_id), "kind": "embeddings"},
            )
            embeddings_blob_uri = emb_res.blob_uri

    # Index in Azure AI Search (AAD / Managed Identity)
    search_client = AzureSearchMetadataClient()
    search_client.upsert_documents(items=search_docs)

    before = sa_model_to_dict(ver)
    ver.extracted_text_blob_uri = extracted_text_blob_uri
    ver.indexed_at = _utcnow()
    ver.ingest_status = "INDEXED"
    ver.ingest_error = None
    ver.meta = {**(ver.meta or {}), "ingest_manifest_blob_uri": manifest_blob_uri}
    if embeddings_blob_uri:
        ver.meta["embeddings_blob_uri"] = embeddings_blob_uri
    ver.updated_by = actor.actor_id

    write_audit_event(
        db,
        fund_id=fund_id,
        actor_id=actor.actor_id,
        action="dataroom.ingest.completed",
        entity_type="document_version",
        entity_id=ver.id,
        before=before,
        after=sa_model_to_dict(ver),
    )
    db.commit()
    db.refresh(ver)

    return {
        "document_id": str(document_id),
        "version_number": version_number,
        "chunks_indexed": len(search_docs),
        "extracted_text_blob_uri": extracted_text_blob_uri,
        "ingest_manifest_blob_uri": manifest_blob_uri,
        "embeddings_blob_uri": embeddings_blob_uri,
        "indexed_at": ver.indexed_at.isoformat() if ver.indexed_at else None,
    }

