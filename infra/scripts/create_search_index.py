import json
import os
import sys
import urllib.error
import urllib.request


def _put_index(*, service: str, index_name: str, api_version: str, api_key: str, payload: dict) -> int:
    url = f"https://{service}.search.windows.net/indexes('{index_name}')?api-version={api_version}"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method="PUT",
        headers={
            "Content-Type": "application/json",
            "api-key": api_key,
            "Prefer": "return=representation",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            if resp.status not in (200, 201):
                print(f"Unexpected status for {index_name}: {resp.status}", file=sys.stderr)
                return 2
            return 0
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"HTTPError {e.code} for {index_name}: {body}", file=sys.stderr)
        return 1


def main() -> int:
    service = os.environ["SEARCH_SERVICE"]
    index_name = os.environ["SEARCH_INDEX"]
    chunks_index = os.environ.get("SEARCH_CHUNKS_INDEX", "fund-document-chunks-index")
    api_version = os.environ.get("SEARCH_API_VERSION", "2025-09-01")
    api_key = os.environ["SEARCH_ADMIN_KEY"]

    payload = {
        "name": index_name,
        "fields": [
            {"name": "id", "type": "Edm.String", "key": True},
            {"name": "fund_id", "type": "Edm.String", "filterable": True},
            {"name": "document_id", "type": "Edm.String", "filterable": True},
            {"name": "title", "type": "Edm.String", "searchable": True},
            {"name": "content", "type": "Edm.String", "searchable": True},
            {"name": "doc_type", "type": "Edm.String", "filterable": True},
            {"name": "version", "type": "Edm.String", "filterable": True},
            {"name": "uploaded_at", "type": "Edm.DateTimeOffset", "filterable": True},
            {"name": "root_folder", "type": "Edm.String", "filterable": True},
            {"name": "folder_path", "type": "Edm.String", "filterable": True},
            {"name": "domain", "type": "Edm.String", "filterable": True},
            {"name": "version_blob_path", "type": "Edm.String", "filterable": True},
        ],
    }

    chunks_payload = {
        "name": chunks_index,
        "fields": [
            {"name": "chunk_id", "type": "Edm.String", "key": True},
            {"name": "fund_id", "type": "Edm.String", "filterable": True},
            {"name": "document_id", "type": "Edm.String", "filterable": True},
            {"name": "version_id", "type": "Edm.String", "filterable": True},
            {"name": "root_folder", "type": "Edm.String", "filterable": True},
            {"name": "folder_path", "type": "Edm.String", "filterable": True},
            {"name": "title", "type": "Edm.String", "searchable": True},
            {"name": "chunk_index", "type": "Edm.Int32", "filterable": True},
            {"name": "content_text", "type": "Edm.String", "searchable": True},
            {"name": "uploaded_at", "type": "Edm.DateTimeOffset", "filterable": True},
        ],
    }

    r1 = _put_index(service=service, index_name=index_name, api_version=api_version, api_key=api_key, payload=payload)
    if r1 != 0:
        return r1
    r2 = _put_index(
        service=service, index_name=chunks_index, api_version=api_version, api_key=api_key, payload=chunks_payload
    )
    return r2


if __name__ == "__main__":
    raise SystemExit(main())

