from __future__ import annotations

import logging
import os
from typing import Any

import requests

APIM_GATEWAY_BASE_URL = "https://netz-prod-api-apim.azure-api.net"
APIM_SUBSCRIPTION_HEADER = "Ocp-Apim-Subscription-Key"

logger = logging.getLogger(__name__)


def get_apim_subscription_key() -> str:
    key = os.environ.get("APIM_SUBSCRIPTION_KEY")
    if not key:
        logger.error(
            "Missing required environment variable APIM_SUBSCRIPTION_KEY for APIM outbound calls"
        )
        raise RuntimeError("Missing required environment variable: APIM_SUBSCRIPTION_KEY")
    return key


def build_apim_headers(extra_headers: dict[str, str] | None = None) -> dict[str, str]:
    headers = {APIM_SUBSCRIPTION_HEADER: get_apim_subscription_key()}
    if extra_headers:
        headers.update(extra_headers)
    return headers


def apim_request(method: str, path_or_url: str, **kwargs: Any) -> requests.Response:
    if path_or_url.startswith("http://") or path_or_url.startswith("https://"):
        url = path_or_url
    else:
        url = f"{APIM_GATEWAY_BASE_URL.rstrip('/')}/{path_or_url.lstrip('/')}"

    headers = dict(kwargs.pop("headers", {}) or {})
    headers = build_apim_headers(headers)

    return requests.request(method=method, url=url, headers=headers, **kwargs)
