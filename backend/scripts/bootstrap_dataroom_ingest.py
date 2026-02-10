from __future__ import annotations

import argparse
import hashlib
import mimetypes
import os
import sys
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

# Ensure `backend/` is importable when running as a script.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings  # noqa: E402
from app.core.db.audit import write_audit_event  # noqa: E402
from app.core.db.session import get_engine  # noqa: E402
from app.domain.documents.constants import CANONICAL_ROOT_FOLDERS  # noqa: E402
from app.domain.documents.enums import DocumentDomain, DocumentIngestionStatus  # noqa: E402
from app.modules.documents.models import Document, DocumentRootFolder, DocumentVersion  # noqa: E402
from app.services.blob_storage import upload_bytes_append_only  # noqa: E402
from app.shared.utils import sa_model_to_dict  # noqa: E402


@dataclass(frozen=True)
class ImportCounts:
    total_files: int
    imported_files: int
    skipped_files: int
    changed_files: int
    errors: int


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _iter_files(local_root: Path) -> Iterable[Path]:
    for p in local_root.rglob("*"):
        if p.is_file():
            yield p


def _allowed_root_folders(db: Session, *, fund_id: uuid.UUID) -> set[str]:
    rows = db.execute(
        select(DocumentRootFolder.name).where(DocumentRootFolder.fund_id == fund_id, DocumentRootFolder.is_active == True)  # noqa: E712
    ).all()
    custom = {r[0] for r in rows}
    return set(CANONICAL_ROOT_FOLDERS).union(custom)


def _split_mapping(local_root: Path, file_path: Path) -> tuple[str, str, str]:
    """
    Maps a local file path to (root_folder, folder_path_remaining, title).
    Example: Data Room/5 KYC/Investor A/passport.pdf ->
      root_folder="5 KYC", folder_path_remaining="Investor A", title="passport.pdf"
    """
    rel = file_path.relative_to(local_root)
    parts = rel.parts
    if len(parts) < 2:
        raise ValueError(f"Invalid file location (must be under a root folder): {rel.as_posix()}")
    root_folder = parts[0]
    title = parts[-1]
    folder_path_remaining = "/".join(parts[1:-1])
    return root_folder, folder_path_remaining, title


def bootstrap_import(
    *,
    db: Session,
    fund_id: uuid.UUID,
    local_path: Path,
    root_prefix: str,
    actor_id: str = "bootstrap-cli",
    strict_roots: bool = True,
    upload_func: Callable[..., object] = upload_bytes_append_only,
) -> ImportCounts:
    local_root = local_path.resolve()
    if not local_root.exists() or not local_root.is_dir():
        raise ValueError(f"--local-path does not exist or is not a directory: {local_root}")

    allowed_roots = _allowed_root_folders(db, fund_id=fund_id)
    rp = root_prefix.strip().replace("\\", "/")
    rp = rp.strip("/")
    rp = f"{rp}/" if rp else ""

    total = imported = skipped = changed = errors = 0

    for file_path in _iter_files(local_root):
        total += 1
        try:
            root_folder, folder_path_remaining, title = _split_mapping(local_root, file_path)

            if root_folder not in allowed_roots:
                msg = f"Invalid root_folder '{root_folder}' for file {file_path}"
                if strict_roots:
                    raise ValueError(msg)
                skipped += 1
                continue

            # EPIC 3A.2: start with PDFs only (consistent with v{n}.pdf convention).
            if file_path.suffix.lower() != ".pdf":
                skipped += 1
                continue

            sha = _sha256_file(file_path)

            # Persist full folder_path in DB consistently with EPIC 3A (root included).
            folder_path_full = root_folder if not folder_path_remaining else f"{root_folder}/{folder_path_remaining}"

            doc = db.execute(
                select(Document).where(
                    Document.fund_id == fund_id,
                    Document.root_folder == root_folder,
                    Document.folder_path == folder_path_full,
                    Document.title == title,
                )
            ).scalar_one_or_none()

            if not doc:
                doc = Document(
                    fund_id=fund_id,
                    access_level="internal",
                    source="dataroom",
                    document_type="DATAROOM",
                    title=title,
                    status="uploaded",
                    current_version=0,
                    root_folder=root_folder,
                    folder_path=folder_path_full,
                    domain=DocumentDomain.OTHER,
                    original_filename=title,
                    content_type="application/pdf",
                    created_by=actor_id,
                    updated_by=actor_id,
                )
                db.add(doc)
                db.flush()

            last_ver = db.execute(
                select(DocumentVersion)
                .where(DocumentVersion.fund_id == fund_id, DocumentVersion.document_id == doc.id)
                .order_by(DocumentVersion.version_number.desc())
                .limit(1)
            ).scalar_one_or_none()

            if last_ver and (last_ver.checksum == sha):
                skipped += 1
                continue

            next_ver = (int(last_ver.version_number) + 1) if last_ver else 1

            # Blob path: {root_prefix}{root_folder}/{folder_path_remaining}/{document_id}/v{n}.pdf
            sub = folder_path_remaining.strip().replace("\\", "/").strip("/")
            blob_rel = f"{root_folder}/{sub}/{doc.id}/v{next_ver}.pdf" if sub else f"{root_folder}/{doc.id}/v{next_ver}.pdf"
            blob_name = f"{rp}{blob_rel}"

            data = file_path.read_bytes()
            mime = mimetypes.guess_type(file_path.name)[0] or "application/pdf"

            write_res = upload_func(
                container=settings.AZURE_STORAGE_DATAROOM_CONTAINER,
                blob_name=blob_name,
                data=data,
                content_type=mime,
                metadata={"fund_id": str(fund_id), "document_id": str(doc.id), "version": str(next_ver)},
            )

            ver = DocumentVersion(
                fund_id=fund_id,
                access_level="internal",
                document_id=doc.id,
                version_number=next_ver,
                blob_uri=getattr(write_res, "blob_uri", None),
                blob_path=blob_name,
                checksum=sha,
                file_size_bytes=len(data),
                is_final=False,
                meta={"source": "bootstrap", "local_path": str(file_path)},
                content_type=mime,
                uploaded_by=actor_id,
                uploaded_at=_utcnow(),
                ingestion_status=DocumentIngestionStatus.PENDING,
                created_by=actor_id,
                updated_by=actor_id,
            )
            db.add(ver)
            db.flush()

            doc_before = sa_model_to_dict(doc)
            doc.current_version = next_ver
            doc.sha256 = sha
            doc.blob_uri = getattr(write_res, "blob_uri", None)
            doc.updated_by = actor_id

            if last_ver:
                changed += 1
            else:
                imported += 1

            # Commit per file for durability; bootstrap is one-time.
            db.commit()

        except Exception:
            db.rollback()
            errors += 1
            raise

    # Single aggregate audit event
    write_audit_event(
        db,
        fund_id=fund_id,
        actor_id=actor_id,
        actor_roles=["SYSTEM"],
        request_id="bootstrap-cli",
        action="DATAROOM_BOOTSTRAP_IMPORT",
        entity_type="fund",
        entity_id=str(fund_id),
        before=None,
        after={
            "local_path": str(local_root),
            "root_prefix": root_prefix,
            "total_files": total,
            "imported_files": imported,
            "changed_files": changed,
            "skipped_files": skipped,
            "errors": errors,
        },
    )
    db.commit()

    return ImportCounts(
        total_files=total,
        imported_files=imported,
        skipped_files=skipped,
        changed_files=changed,
        errors=errors,
    )


def _build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Bootstrap ingest local Data Room into Blob + Postgres registry (idempotent).")
    p.add_argument("--fund-id", required=True, help="Fund UUID")
    p.add_argument("--local-path", required=True, help="Local Data Room root folder path")
    p.add_argument("--root-prefix", default="dataroom/", help="Blob prefix inside the container (default: dataroom/)")
    p.add_argument("--non-strict-roots", action="store_true", help="Skip files under unknown root folders instead of failing.")
    return p


def main() -> int:
    args = _build_arg_parser().parse_args()
    fund_id = uuid.UUID(args.fund_id)
    local_path = Path(args.local_path)

    engine = get_engine()
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, class_=Session)
    with SessionLocal() as db:
        counts = bootstrap_import(
            db=db,
            fund_id=fund_id,
            local_path=local_path,
            root_prefix=args.root_prefix,
            actor_id="bootstrap-cli",
            strict_roots=not args.non_strict_roots,
        )

    print(
        f"DATAROOM_BOOTSTRAP_IMPORT fund_id={fund_id} total={counts.total_files} "
        f"imported={counts.imported_files} changed={counts.changed_files} skipped={counts.skipped_files} errors={counts.errors}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

