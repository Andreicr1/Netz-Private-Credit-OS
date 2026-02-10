from __future__ import annotations

import hashlib
from dataclasses import dataclass

from azure.core.exceptions import ResourceExistsError
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobClient, BlobServiceClient, ContentSettings

from app.core.config import settings


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


def _service_client() -> BlobServiceClient:
    # Uses Managed Identity on Azure App Service (DefaultAzureCredential).
    # In local dev, can use Azure CLI login (`az login`) or environment creds.
    cred = DefaultAzureCredential(exclude_interactive_browser_credential=True)
    return BlobServiceClient(account_url=_account_url(), credential=cred)


def blob_uri(container: str, blob_name: str) -> str:
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
    cred = DefaultAzureCredential(exclude_interactive_browser_credential=True)
    bc = BlobClient.from_blob_url(blob_uri, credential=cred)
    stream = bc.download_blob()
    return stream.readall()

