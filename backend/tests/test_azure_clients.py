from __future__ import annotations

import types

import pytest


class _DummyCred:
    def __init__(self, *args, **kwargs):
        self.args = args
        self.kwargs = kwargs

    def get_token(self, scope: str):
        return types.SimpleNamespace(token="dummy-token")


def test_azure_clients_instantiate_without_keys(monkeypatch):
    # Patch DefaultAzureCredential in each module to ensure Managed Identity pattern is used.
    from app.core.config import settings

    settings.KEYVAULT_URL = "https://example.vault.azure.net/"
    settings.STORAGE_ACCOUNT_URL = "https://example.blob.core.windows.net/"
    settings.AZURE_SEARCH_ENDPOINT = "https://example.search.windows.net"
    settings.SEARCH_INDEX_NAME = "fund-documents-index"
    settings.SEARCH_CHUNKS_INDEX_NAME = "fund-document-chunks-index"
    settings.AZURE_OPENAI_ENDPOINT = "https://example.openai.azure.com/"

    import app.services.azure.keyvault_client as kv
    import app.services.azure.blob_client as bs
    import app.services.azure.search_client as sc
    import app.services.azure.foundry_responses_client as fc

    monkeypatch.setattr(kv, "DefaultAzureCredential", _DummyCred)
    monkeypatch.setattr(bs, "DefaultAzureCredential", _DummyCred)
    monkeypatch.setattr(sc, "DefaultAzureCredential", _DummyCred)
    monkeypatch.setattr(fc, "DefaultAzureCredential", _DummyCred)

    # These should build clients without requiring any key-based settings.
    _ = kv.get_secret_client()
    _ = bs.get_blob_service_client()
    _ = sc.get_metadata_index_client()
    _ = sc.get_chunks_index_client()
    _ = fc.get_foundry_client()

