from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote

from azure.core.exceptions import ResourceExistsError
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobClient, BlobSasPermissions, BlobServiceClient, ContentSettings, generate_blob_sas

from app.core.config import settings
from app.shared.enums import Env


@dataclass(frozen=True)
class BlobWriteResult:
    blob_uri: str
    etag: str | None
    version_id: str | None
    sha256: str
    size_bytes: int


def _account_url() -> str:
    if settings.STORAGE_ACCOUNT_URL:
        return settings.STORAGE_ACCOUNT_URL.rstrip("/")
    if not settings.AZURE_STORAGE_ACCOUNT:
        raise ValueError("STORAGE_ACCOUNT_URL or AZURE_STORAGE_ACCOUNT not configured")
    return f"https://{settings.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net"


def _use_local_storage() -> bool:
    if settings.env == Env.prod:
        return False
    # In non-prod environments, treat placeholder configuration as "not configured".
    # This keeps unit tests and local runs deterministic and avoids accidental network calls.
    if settings.STORAGE_ACCOUNT_URL and "example.blob.core.windows.net" in settings.STORAGE_ACCOUNT_URL:
        return True
    if settings.AZURE_STORAGE_ACCOUNT and settings.AZURE_STORAGE_ACCOUNT.lower() == "example":
        return True
    return not (settings.STORAGE_ACCOUNT_URL or settings.AZURE_STORAGE_ACCOUNT)


def _local_base_dir() -> Path:
    # repo_root/tmp/local_blob_storage/<container>/<blob_name>
    repo_root = Path(__file__).resolve().parents[3]
    return repo_root / "tmp" / "local_blob_storage"


def _local_blob_path(*, container: str, blob_name: str) -> Path:
    # blob_name may contain '/' which we treat as folders.
    return _local_base_dir() / container / Path(blob_name)


def _service_client() -> BlobServiceClient:
    # Uses Managed Identity on Azure App Service (DefaultAzureCredential).
    # In local dev, can use Azure CLI login (`az login`) or environment creds.
    if _use_local_storage():
        raise RuntimeError("Local storage mode does not use Azure BlobServiceClient")
    cred = DefaultAzureCredential(exclude_interactive_browser_credential=True)
    return BlobServiceClient(account_url=_account_url(), credential=cred)


def blob_uri(container: str, blob_name: str) -> str:
    if _use_local_storage():
        return f"local://{container}/{blob_name}"
    base = _account_url()
    return f"{base}/{container}/{blob_name}"


def upload_bytes(
    *,
    container: str,
    blob_name: str,
    data: bytes,
    content_type: str | None,
    overwrite: bool = False,
    metadata: dict[str, str] | None = None,
) -> BlobWriteResult:
    sha = hashlib.sha256(data).hexdigest()

    if _use_local_storage():
        path = _local_blob_path(container=container, blob_name=blob_name)
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists() and not overwrite:
            raise ResourceExistsError("Blob already exists")
        path.write_bytes(data)
        return BlobWriteResult(
            blob_uri=blob_uri(container, blob_name),
            etag=None,
            version_id=None,
            sha256=sha,
            size_bytes=len(data),
        )

    svc = _service_client()
    bc: BlobClient = svc.get_blob_client(container=container, blob=blob_name)

    content_settings = ContentSettings(content_type=content_type) if content_type else None
    resp = bc.upload_blob(
        data,
        overwrite=overwrite,
        metadata=metadata,
        content_settings=content_settings,
    )

    props = bc.get_blob_properties()
    return BlobWriteResult(
        blob_uri=blob_uri(container, blob_name),
        etag=(props.etag.strip('"') if props.etag else None),
        version_id=getattr(props, "version_id", None),
        sha256=sha,
        size_bytes=len(data),
    )


def exists(*, container: str, blob_name: str) -> bool:
    if _use_local_storage():
        return _local_blob_path(container=container, blob_name=blob_name).exists()
    svc = _service_client()
    bc: BlobClient = svc.get_blob_client(container=container, blob=blob_name)
    try:
        bc.get_blob_properties()
        return True
    except Exception:
        return False


def upload_bytes_idempotent(
    *,
    container: str,
    blob_name: str,
    data: bytes,
    content_type: str | None,
    metadata: dict[str, str] | None = None,
) -> BlobWriteResult:
    """
    Idempotent write: if blob already exists, return its properties (no overwrite).
    Uses the provided bytes only to compute sha256 and size for auditing purposes.
    """
    sha = hashlib.sha256(data).hexdigest()

    if _use_local_storage():
        path = _local_blob_path(container=container, blob_name=blob_name)
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            path.write_bytes(data)
        return BlobWriteResult(
            blob_uri=blob_uri(container, blob_name),
            etag=None,
            version_id=None,
            sha256=sha,
            size_bytes=len(data),
        )

    svc = _service_client()
    bc: BlobClient = svc.get_blob_client(container=container, blob=blob_name)
    content_settings = ContentSettings(content_type=content_type) if content_type else None
    try:
        bc.upload_blob(data, overwrite=False, metadata=metadata, content_settings=content_settings)
    except ResourceExistsError:
        pass

    props = bc.get_blob_properties()
    return BlobWriteResult(
        blob_uri=blob_uri(container, blob_name),
        etag=(props.etag.strip('"') if props.etag else None),
        version_id=getattr(props, "version_id", None),
        sha256=sha,
        size_bytes=len(data),
    )


def upload_bytes_append_only(
    *,
    container: str,
    blob_name: str,
    data: bytes,
    content_type: str | None,
    metadata: dict[str, str] | None = None,
) -> BlobWriteResult:
    """
    Append-only write: will fail if blob already exists.
    Use for versioned dataroom documents (never overwrite).
    """
    sha = hashlib.sha256(data).hexdigest()

    if _use_local_storage():
        path = _local_blob_path(container=container, blob_name=blob_name)
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists():
            raise ResourceExistsError("Blob already exists")
        path.write_bytes(data)
        return BlobWriteResult(
            blob_uri=blob_uri(container, blob_name),
            etag=None,
            version_id=None,
            sha256=sha,
            size_bytes=len(data),
        )

    svc = _service_client()
    bc: BlobClient = svc.get_blob_client(container=container, blob=blob_name)
    content_settings = ContentSettings(content_type=content_type) if content_type else None
    bc.upload_blob(
        data,
        overwrite=False,
        metadata=metadata,
        content_settings=content_settings,
    )
    props = bc.get_blob_properties()
    return BlobWriteResult(
        blob_uri=blob_uri(container, blob_name),
        etag=(props.etag.strip('"') if props.etag else None),
        version_id=getattr(props, "version_id", None),
        sha256=sha,
        size_bytes=len(data),
    )


def download_bytes(*, blob_uri: str) -> bytes:
    if blob_uri.startswith("local://"):
        rel = blob_uri.removeprefix("local://")
        container, _, blob_name = rel.partition("/")
        if not container or not blob_name:
            raise ValueError("Invalid local blob URI")
        path = _local_blob_path(container=container, blob_name=blob_name)
        return path.read_bytes()

    cred = DefaultAzureCredential(exclude_interactive_browser_credential=True)
    bc = BlobClient.from_blob_url(blob_uri, credential=cred)
    stream = bc.download_blob()
    return stream.readall()


@dataclass(frozen=True)
class BlobEntry:
    """Represents a blob or virtual folder in a container listing."""
    name: str
    is_folder: bool
    size_bytes: int | None = None
    content_type: str | None = None
    last_modified: str | None = None


def list_blobs(
    *,
    container: str,
    prefix: str | None = None,
    delimiter: str = "/",
) -> list[BlobEntry]:
    """
    List blobs and virtual folders under a prefix in a container.
    Uses delimiter-based listing (virtual directory browsing).
    """
    if _use_local_storage():
        base = _local_base_dir() / container
        if prefix:
            base = base / Path(prefix)
        entries: list[BlobEntry] = []
        if base.is_dir():
            for child in sorted(base.iterdir()):
                if child.is_dir():
                    rel = child.name + "/"
                    entries.append(BlobEntry(name=(prefix or "") + rel, is_folder=True))
                else:
                    entries.append(BlobEntry(
                        name=(prefix or "") + child.name,
                        is_folder=False,
                        size_bytes=child.stat().st_size,
                        content_type=None,
                        last_modified=None,
                    ))
        return entries

    svc = _service_client()
    container_client = svc.get_container_client(container)
    entries = []

    blobs_iter = container_client.walk_blobs(name_starts_with=prefix or "", delimiter=delimiter)
    for item in blobs_iter:
        # BlobPrefix (virtual folder) has .prefix attribute
        if hasattr(item, "prefix"):
            entries.append(BlobEntry(name=item.prefix, is_folder=True))
        else:
            lm = None
            if item.last_modified:
                lm = item.last_modified.isoformat()
            entries.append(BlobEntry(
                name=item.name,
                is_folder=False,
                size_bytes=item.size,
                content_type=getattr(item.content_settings, "content_type", None) if item.content_settings else None,
                last_modified=lm,
            ))

    return entries


def generate_read_link(
    *,
    container: str,
    blob_name: str,
    ttl_minutes: int | None = None,
    as_download: bool = False,
) -> str:
    """
    Generate a time-limited read link for a blob.
    Uses user delegation SAS in Azure and local URI passthrough in local mode.
    """
    if _use_local_storage():
        return blob_uri(container, blob_name)

    svc = _service_client()
    ttl = int(ttl_minutes or settings.AZURE_STORAGE_SAS_TTL_MINUTES or 30)
    now = datetime.now(timezone.utc)
    start = now - timedelta(minutes=2)
    expiry = now + timedelta(minutes=ttl)

    user_delegation_key = svc.get_user_delegation_key(key_start_time=start, key_expiry_time=expiry)

    content_disposition = None
    if as_download:
        filename = Path(blob_name).name or "document"
        content_disposition = f'attachment; filename="{filename}"'

    sas = generate_blob_sas(
        account_name=svc.account_name,
        container_name=container,
        blob_name=blob_name,
        user_delegation_key=user_delegation_key,
        permission=BlobSasPermissions(read=True),
        start=start,
        expiry=expiry,
        content_disposition=content_disposition,
    )

    safe_blob_name = quote(blob_name, safe="/")
    return f"{_account_url()}/{container}/{safe_blob_name}?{sas}"

