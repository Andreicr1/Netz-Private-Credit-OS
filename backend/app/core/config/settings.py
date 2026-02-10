from __future__ import annotations

from pydantic import AnyUrl
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.shared.enums import Env


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    env: Env = Env.dev
    log_level: str = "INFO"

    database_url: str = "postgresql+psycopg://postgres:postgres@postgres:5432/netz_os"

    # OIDC / Entra (prod)
    oidc_audience: str | None = None
    oidc_issuer: str | None = None
    oidc_jwks_url: AnyUrl | None = None

    # Dev-only actor header
    dev_actor_header: str = "X-DEV-ACTOR"

    # Azure Blob (canonical document repository)
    # Prefer canonical URL (Managed Identity via AAD). Example: https://<account>.blob.core.windows.net/
    STORAGE_ACCOUNT_URL: str | None = None
    # Legacy: kept to build URLs if STORAGE_ACCOUNT_URL not set
    AZURE_STORAGE_ACCOUNT: str | None = None
    # Legacy setting (EPIC 7): kept for backward compatibility with existing routes
    AZURE_STORAGE_CONTAINER: str = "evidence"
    # Canonical containers (não alterar nomes no Azure)
    AZURE_STORAGE_EVIDENCE_CONTAINER: str = "evidence"
    AZURE_STORAGE_DATAROOM_CONTAINER: str = "dataroom"
    AZURE_STORAGE_MONTHLY_REPORTS_CONTAINER: str = "monthly-reports"
    AZURE_STORAGE_SAS_TTL_MINUTES: int = 30

    # Azure AI Search (AAD / Managed Identity)
    AZURE_SEARCH_ENDPOINT: str | None = None  # e.g. https://<service>.search.windows.net
    SEARCH_INDEX_NAME: str | None = None  # metadata index name (e.g. fund-documents-index)
    SEARCH_CHUNKS_INDEX_NAME: str | None = None  # chunk index name (e.g. fund-document-chunks-index)

    # Azure AI Foundry / Azure OpenAI (AAD / Managed Identity)
    AZURE_OPENAI_ENDPOINT: str | None = None
    AZURE_OPENAI_MODEL: str = "gpt-4o"
    AZURE_OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    AZURE_OPENAI_API_VERSION: str = "2024-02-15-preview"

    # Key Vault (AAD / Managed Identity)
    KEYVAULT_URL: str | None = None


settings = Settings()

