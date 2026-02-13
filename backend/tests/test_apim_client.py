from __future__ import annotations

import pytest

from app.core.http.apim_client import (
    APIM_SUBSCRIPTION_HEADER,
    apim_request,
    build_apim_headers,
    get_apim_subscription_key,
)


def test_get_apim_subscription_key_missing_logs_and_raises(monkeypatch, caplog):
    monkeypatch.delenv("APIM_SUBSCRIPTION_KEY", raising=False)

    with pytest.raises(RuntimeError):
        get_apim_subscription_key()

    assert "APIM_SUBSCRIPTION_KEY" in caplog.text


def test_build_apim_headers_uses_environment(monkeypatch):
    monkeypatch.setenv("APIM_SUBSCRIPTION_KEY", "test-key")

    headers = build_apim_headers({"Accept": "application/json"})

    assert headers[APIM_SUBSCRIPTION_HEADER] == "test-key"
    assert headers["Accept"] == "application/json"


def test_apim_request_injects_subscription_header(monkeypatch):
    monkeypatch.setenv("APIM_SUBSCRIPTION_KEY", "test-key")

    captured: dict[str, str] = {}

    class _DummyResponse:
        status_code = 200

    def _fake_request(*, method, url, headers, **kwargs):
        captured["method"] = method
        captured["url"] = url
        captured.update(headers)
        return _DummyResponse()

    monkeypatch.setattr("app.core.http.apim_client.requests.request", _fake_request)

    response = apim_request("GET", "/api/health")

    assert response.status_code == 200
    assert captured["method"] == "GET"
    assert captured["url"].endswith("/api/health")
    assert captured[APIM_SUBSCRIPTION_HEADER] == "test-key"
