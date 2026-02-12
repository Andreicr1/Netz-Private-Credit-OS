from __future__ import annotations

from collections.abc import Generator
from functools import lru_cache
import importlib

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.core.db.base import Base


def _import_model_modules() -> None:
    module_names = [
        "app.core.db.models",
        "app.modules.actions.models",
        "app.modules.ai.models",
        "app.modules.compliance.models",
        "app.modules.deals.models",
        "app.modules.documents.models",
        "app.modules.portfolio.models",
        "app.domain.portfolio.models.assets",
        "app.domain.portfolio.models.fund_investments",
        "app.domain.portfolio.models.obligations",
        "app.domain.portfolio.models.alerts",
        "app.domain.portfolio.models.actions",
        "app.domain.deals.models.deals",
        "app.domain.deals.models.qualification",
        "app.domain.deals.models.ic_memos",
        "app.domain.documents.models.evidence",
        "app.domain.reporting.models.report_packs",
        "app.domain.reporting.models.report_sections",
        "app.domain.reporting.models.nav_snapshots",
        "app.domain.reporting.models.asset_valuation_snapshots",
        "app.domain.reporting.models.investor_statements",
        "app.domain.cash_management.models.cash",
        "app.domain.cash_management.models.bank_statements",
        "app.domain.cash_management.models.reconciliation_matches",
    ]
    for module_name in module_names:
        importlib.import_module(module_name)


@lru_cache(maxsize=1)
def get_engine():
    # Lazy init: evita derrubar o app no import caso env/KeyVault ainda esteja resolvendo.
    engine = create_engine(settings.database_url, pool_pre_ping=True)
    _import_model_modules()
    Base.metadata.create_all(bind=engine)
    return engine


def get_session_local() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), autoflush=False, autocommit=False, class_=Session)


def get_db() -> Generator[Session, None, None]:
    db = get_session_local()()
    try:
        yield db
    finally:
        db.close()

