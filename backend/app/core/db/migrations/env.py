from __future__ import annotations

import os
import sys
import json
import re
import urllib.parse
import urllib.request
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool
from sqlalchemy.engine.url import make_url

# Ensure `app.*` is importable when running alembic from `backend/`.
sys.path.append(os.path.abspath(os.getcwd()))

from app.core.config import settings  # noqa: E402
from app.core.db.base import Base  # noqa: E402

# Import all models so Base.metadata is complete.
from app.core.db import models as _core_models  # noqa: F401,E402
from app.modules.actions import models as _actions_models  # noqa: F401,E402
from app.modules.ai import models as _ai_models  # noqa: F401,E402
from app.modules.compliance import models as _compliance_models  # noqa: F401,E402
from app.modules.deals import models as _deals_models  # noqa: F401,E402
from app.modules.documents import models as _documents_models  # noqa: F401,E402
from app.modules.portfolio import models as _portfolio_models  # noqa: F401,E402
from app.domain.portfolio.models import assets as _domain_assets  # noqa: F401,E402
from app.domain.portfolio.models import fund_investments as _domain_fi  # noqa: F401,E402
from app.domain.portfolio.models import obligations as _domain_obligations  # noqa: F401,E402
from app.domain.portfolio.models import alerts as _domain_alerts  # noqa: F401,E402
from app.domain.portfolio.models import actions as _domain_actions  # noqa: F401,E402
from app.domain.deals.models import deals as _domain_deals  # noqa: F401,E402
from app.domain.deals.models import qualification as _domain_deal_qual  # noqa: F401,E402
from app.domain.deals.models import ic_memos as _domain_ic_memos  # noqa: F401,E402
from app.domain.documents.models import evidence as _domain_evidence  # noqa: F401,E402
from app.domain.reporting.models import report_packs as _domain_report_packs  # noqa: F401,E402
from app.domain.reporting.models import report_sections as _domain_report_sections  # noqa: F401,E402
from app.domain.reporting.models import nav_snapshots as _domain_nav_snapshots  # noqa: F401,E402
from app.domain.reporting.models import asset_valuation_snapshots as _domain_asset_valuations  # noqa: F401,E402
from app.domain.reporting.models import investor_statements as _domain_investor_statements  # noqa: F401,E402
from app.domain.cash_management.models import cash as _domain_cash  # noqa: F401,E402
from app.domain.cash_management.models import bank_statements as _domain_bank_statements  # noqa: F401,E402
from app.domain.cash_management.models import reconciliation_matches as _domain_recon_matches  # noqa: F401,E402


config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _resolve_keyvault_reference(raw_value: str) -> str:
    match = re.search(r"SecretUri=([^\)]+)", raw_value)
    if not match:
        raise RuntimeError("Invalid Key Vault reference format in DATABASE_URL")

    secret_uri = match.group(1)

    identity_endpoint = os.getenv("IDENTITY_ENDPOINT")
    identity_header = os.getenv("IDENTITY_HEADER")

    if identity_endpoint and identity_header:
        query = urllib.parse.urlencode({"resource": "https://vault.azure.net", "api-version": "2019-08-01"})
        token_url = f"{identity_endpoint}?{query}"
        token_headers = {"X-IDENTITY-HEADER": identity_header, "Metadata": "true"}
    else:
        query = urllib.parse.urlencode({"resource": "https://vault.azure.net", "api-version": "2018-02-01"})
        token_url = f"http://169.254.169.254/metadata/identity/oauth2/token?{query}"
        token_headers = {"Metadata": "true"}

    token_req = urllib.request.Request(token_url, headers=token_headers)
    with urllib.request.urlopen(token_req, timeout=10) as resp:
        token_payload = json.loads(resp.read().decode("utf-8"))

    access_token = token_payload.get("access_token")
    if not access_token:
        raise RuntimeError("Failed to obtain managed identity access token")

    secret_req = urllib.request.Request(secret_uri, headers={"Authorization": f"Bearer {access_token}"})
    with urllib.request.urlopen(secret_req, timeout=10) as resp:
        secret_payload = json.loads(resp.read().decode("utf-8"))

    secret_value = secret_payload.get("value")
    if not secret_value:
        raise RuntimeError("Failed to resolve DATABASE_URL from Key Vault secret")

    return secret_value


def get_url() -> str:
    candidates: list[str] = []

    if settings.database_url:
        candidates.append(settings.database_url)

    env_database_url = os.getenv("DATABASE_URL")
    if env_database_url and env_database_url not in candidates:
        candidates.append(env_database_url)

    ini_url = config.get_main_option("sqlalchemy.url")
    if ini_url and ini_url not in candidates:
        candidates.append(ini_url)

    for raw in candidates:
        candidate = raw.strip()

        if "@Microsoft.KeyVault(" in candidate:
            try:
                candidate = _resolve_keyvault_reference(candidate)
            except Exception as exc:
                print(f"[alembic] keyvault resolve failed: {type(exc).__name__}: {exc}", file=sys.stderr)
                continue

        try:
            make_url(candidate)
            return candidate
        except Exception:
            print(
                f"[alembic] skipping unparseable database url candidate: prefix={candidate[:48]!r}",
                file=sys.stderr,
            )

    raise RuntimeError("No valid SQLAlchemy database URL candidate for Alembic")


def run_migrations_offline() -> None:
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = get_url()

    connectable = engine_from_config(configuration, prefix="sqlalchemy.", poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

