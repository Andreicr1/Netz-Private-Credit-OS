from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from azure.search.documents import SearchClient

from app.services.azure.search_client import get_chunks_index_client, get_metadata_index_client


@dataclass(frozen=True)
class SearchHit:
    id: str
    fund_id: str | None
    document_id: str | None
    title: str | None
    content: str | None
    doc_type: str | None
    version: str | None
    uploaded_at: str | None
    root_folder: str | None = None
    folder_path: str | None = None
    domain: str | None = None
    version_blob_path: str | None = None
    score: float | None = None


class AzureSearchMetadataClient:
    def __init__(self) -> None:
        self._client: SearchClient = get_metadata_index_client()

    def upsert_dataroom_metadata(self, *, items: list[dict[str, Any]]) -> None:
        if not items:
            return
        # mergeOrUpload equivalent
        self._client.merge_or_upload_documents(documents=items)

    def upsert_documents(self, *, items: list[dict[str, Any]]) -> None:
        """
        Generic upsert for the metadata index (used by legacy dataroom_ingest).
        """
        if not items:
            return
        self._client.merge_or_upload_documents(documents=items)

    def search(self, *, q: str, fund_id: str | None, top: int = 5) -> list[SearchHit]:
        filt = f"fund_id eq '{fund_id}'" if fund_id else None
        rows = self._client.search(search_text=q, filter=filt, top=top)
        hits: list[SearchHit] = []
        for row in rows:
            hits.append(
                SearchHit(
                    id=row.get("id"),
                    fund_id=row.get("fund_id"),
                    document_id=row.get("document_id"),
                    title=row.get("title"),
                    content=row.get("content"),
                    doc_type=row.get("doc_type"),
                    version=row.get("version"),
                    uploaded_at=row.get("uploaded_at"),
                    root_folder=row.get("root_folder"),
                    folder_path=row.get("folder_path"),
                    domain=row.get("domain"),
                    version_blob_path=row.get("version_blob_path"),
                    score=row.get("@search.score"),
                )
            )
        return hits


@dataclass(frozen=True)
class ChunkSearchHit:
    chunk_id: str
    fund_id: str | None
    document_id: str | None
    version_id: str | None
    root_folder: str | None
    folder_path: str | None
    title: str | None
    chunk_index: int | None
    content_text: str | None
    uploaded_at: str | None
    score: float | None = None


class AzureSearchChunksClient:
    def __init__(self) -> None:
        self._client: SearchClient = get_chunks_index_client()

    def upsert_chunks(self, *, items: list[dict[str, Any]]) -> None:
        if not items:
            return
        self._client.merge_or_upload_documents(documents=items)

    def search(self, *, q: str, fund_id: str, root_folder: str | None, top: int = 5) -> list[ChunkSearchHit]:
        filt = [f"fund_id eq '{fund_id}'"]
        if root_folder:
            filt.append(f"root_folder eq '{root_folder}'")
        rows = self._client.search(search_text=q, filter=" and ".join(filt), top=top)
        hits: list[ChunkSearchHit] = []
        for row in rows:
            hits.append(
                ChunkSearchHit(
                    chunk_id=row.get("chunk_id") or row.get("id"),
                    fund_id=row.get("fund_id"),
                    document_id=row.get("document_id"),
                    version_id=row.get("version_id"),
                    root_folder=row.get("root_folder"),
                    folder_path=row.get("folder_path"),
                    title=row.get("title"),
                    chunk_index=row.get("chunk_index"),
                    content_text=row.get("content_text"),
                    uploaded_at=row.get("uploaded_at"),
                    score=row.get("@search.score"),
                )
            )
        return hits


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

