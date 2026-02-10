from __future__ import annotations

import os
import sys
import json
import uuid
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import Session, sessionmaker

# Make `backend/` importable regardless of pytest import mode.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
from app.core.db.base import Base
from app.core.db.models import Fund
from app.core.db.session import get_db
from app.main import create_app
from app.shared.enums import Env

# Ensure model modules are imported so Base.metadata is complete.
from app.core.db import models as _core_models  # noqa: F401
from app.modules.actions import models as _actions_models  # noqa: F401
from app.modules.ai import models as _ai_models  # noqa: F401
from app.modules.compliance import models as _compliance_models  # noqa: F401
from app.modules.deals import models as _deals_models  # noqa: F401
from app.modules.documents import models as _documents_models  # noqa: F401
from app.modules.portfolio import models as _portfolio_models  # noqa: F401
from app.domain.portfolio.models import assets as _domain_assets  # noqa: F401
from app.domain.portfolio.models import fund_investments as _domain_fi  # noqa: F401
from app.domain.portfolio.models import obligations as _domain_obligations  # noqa: F401
from app.domain.portfolio.models import alerts as _domain_alerts  # noqa: F401
from app.domain.portfolio.models import actions as _domain_actions  # noqa: F401
from app.domain.deals.models import deals as _domain_deals  # noqa: F401
from app.domain.deals.models import qualification as _domain_deal_qual  # noqa: F401
from app.domain.deals.models import ic_memos as _domain_ic_memos  # noqa: F401
from app.domain.documents.models import evidence as _domain_evidence  # noqa: F401
from app.domain.reporting.models import report_packs as _domain_report_packs  # noqa: F401
from app.domain.reporting.models import report_sections as _domain_report_sections  # noqa: F401
from app.domain.cash_management.models import cash as _domain_cash  # noqa: F401


@pytest.fixture()
def db_engine():
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture()
def db_session(db_engine) -> Generator[Session, None, None]:
    TestingSessionLocal = sessionmaker(bind=db_engine, autoflush=False, autocommit=False, class_=Session)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def client(db_session: Session) -> TestClient:
    settings.env = Env.dev
    app = create_app()

    def _override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    return TestClient(app)


@pytest.fixture()
def seeded_fund(client: TestClient, db_session: Session) -> dict:
    fund_id = uuid.uuid4()
    db_session.add(Fund(id=fund_id, name="Seeded Fund"))
    db_session.commit()

    # Default client header so tests can call routes without passing headers.
    client.headers.update(
        {"X-DEV-ACTOR": json.dumps({"actor_id": "seed-user", "roles": ["ADMIN"], "fund_ids": [str(fund_id)]})}
    )
    return {"fund_id": str(fund_id)}

