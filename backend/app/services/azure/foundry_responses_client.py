from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Callable

from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from openai import OpenAI

from app.core.config import settings


@dataclass(frozen=True)
class FoundryHealth:
    ok: bool
    detail: str | None = None


@dataclass(frozen=True)
class FoundryResult:
    output_text: str
    model: str
    raw: Any


def _token_provider() -> Callable[[], str]:
    """
    Azure OpenAI (Responses API) uses an AAD bearer token.
    We provide it via azure-identity's get_bearer_token_provider.
    """
    cred = DefaultAzureCredential(exclude_interactive_browser_credential=True)
    return get_bearer_token_provider(cred, "https://cognitiveservices.azure.com/.default")


def get_foundry_client() -> OpenAI:
    if not settings.AZURE_OPENAI_ENDPOINT:
        raise ValueError("AZURE_OPENAI_ENDPOINT not configured")
    base_url = settings.AZURE_OPENAI_ENDPOINT.rstrip("/") + "/openai/v1/"
    return OpenAI(base_url=base_url, api_key=_token_provider())


class FoundryResponsesClient:
    def __init__(self) -> None:
        if not settings.AZURE_OPENAI_MODEL:
            raise ValueError("AZURE_OPENAI_MODEL not configured")
        self._client = get_foundry_client()

    def generate_answer(self, *, system_prompt: str, user_prompt: str) -> FoundryResult:
        model = settings.AZURE_OPENAI_MODEL
        resp = self._client.responses.create(
            model=model,
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        return FoundryResult(output_text=resp.output_text, model=model, raw=resp)


def safe_parse_json_object(text: str) -> dict[str, Any]:
    """
    Robustly parse a JSON object from model output (Responses API output_text).
    """
    t = (text or "").strip()
    if t.startswith("```"):
        t = t.strip("`").strip()
        if t.lower().startswith("json"):
            t = t[4:].strip()
    return json.loads(t)


def health_check_foundry() -> FoundryHealth:
    try:
        c = FoundryResponsesClient()
        _ = c.generate_answer(system_prompt="Return JSON: {\"answer\":\"ok\",\"citations\":[{\"chunk_id\":\"x\",\"rationale\":\"y\"}]}", user_prompt="Ping")
        return FoundryHealth(ok=True)
    except Exception as e:
        msg = str(e) or repr(e)
        return FoundryHealth(ok=False, detail=f"{type(e).__name__}: {msg}")

