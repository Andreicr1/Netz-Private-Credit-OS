from __future__ import annotations

from dataclasses import dataclass

from app.core.config import settings
from app.services.azure.foundry_responses_client import get_foundry_client


@dataclass(frozen=True)
class EmbeddingResult:
    vectors: list[list[float]] | None
    provider: str
    model: str | None
    skipped_reason: str | None = None


def generate_embeddings(*, inputs: list[str]) -> EmbeddingResult:
    """
    Azure OpenAI embeddings via Managed Identity (AAD) if configured.
    If not configured, returns vectors=None with explicit skipped_reason.
    """
    if not inputs:
        return EmbeddingResult(vectors=[], provider="none", model=None)

    if not settings.AZURE_OPENAI_ENDPOINT:
        return EmbeddingResult(
            vectors=None,
            provider="none",
            model=None,
            skipped_reason="AZURE_OPENAI_ENDPOINT not configured",
        )

    client = get_foundry_client()
    model = settings.AZURE_OPENAI_EMBEDDING_MODEL
    resp = client.embeddings.create(model=model, input=inputs)
    items_sorted = sorted(resp.data, key=lambda x: x.index)
    vectors: list[list[float]] = [it.embedding for it in items_sorted]
    return EmbeddingResult(vectors=vectors, provider="azure-openai-aad", model=model)

