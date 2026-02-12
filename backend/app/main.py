from __future__ import annotations

from fastapi import APIRouter, Depends, FastAPI, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.logging import configure_logging
from app.core.middleware.request_id import RequestIdMiddleware
from app.core.middleware.audit import set_actor
from app.core.config import settings
from app.services.azure.blob_client import health_check_storage
from app.services.azure.keyvault_client import health_check_keyvault
from app.services.azure.search_client import health_check_search
from app.services.azure.foundry_responses_client import health_check_foundry
from app.core.db.session import get_db
from app.core.db.models import Fund, User, UserFundRole
from app.core.security.dependencies import require_fund_access
from app.shared.enums import Env, Role
from app.modules.actions.routes import router as actions_router
from app.modules.ai.routes import router as ai_router
from app.modules.compliance.routes import router as compliance_router
from app.modules.deals.routes import router as deals_router
from app.modules.documents.routes import router as documents_router
from app.modules.portfolio.routes import router as portfolio_router
from app.modules.signatures.routes import router as signatures_router
from app.domain.documents.routes.ingest import router as documents_ingest_router
from app.domain.portfolio.routes.assets import router as assets_router
from app.domain.portfolio.routes.alerts import router as alerts_router
from app.domain.portfolio.routes.actions import router as portfolio_actions_router
from app.domain.portfolio.routes.fund_investments import router as fund_investments_router
from app.domain.portfolio.routes.obligations import router as obligations_router
from app.domain.deals.routes.deals import router as domain_deals_router
from app.domain.deals.routes.conversion import router as conversion_router
from app.domain.deals.routes.ic_memos import router as ic_memos_router
from app.domain.actions.routes.actions import router as governed_actions_router
from app.domain.documents.routes.uploads import router as evidence_upload_router
from app.domain.documents.routes.auditor import router as auditor_router
from app.domain.documents.routes.evidence import router as evidence_router
from app.domain.reporting.routes.report_packs import router as report_packs_router
from app.domain.reporting.routes.investor_portal import router as investor_portal_router
from app.domain.reporting.routes.evidence_pack import router as evidence_pack_router
from app.domain.reporting.routes.reports import router as reports_router
from app.domain.dataroom.routes import router as dataroom_router
from app.domain.cash_management.routes import router as cash_router


class DevSeedRequest(BaseModel):
    fund_name: str = Field(default="Netz Private Credit Fund", min_length=2, max_length=200)
    user_email: str = Field(default="dev@local", min_length=3, max_length=320)
    display_name: str = Field(default="Dev User", min_length=2, max_length=200)
    roles: list[Role] = Field(default_factory=lambda: [Role.ADMIN])


def create_app() -> FastAPI:
    configure_logging()

    app = FastAPI(title="Netz Private Credit OS - Backend", version="0.1.0")
    app.add_middleware(RequestIdMiddleware)

    @app.get("/health", tags=["admin"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/health/azure", tags=["admin"])
    def health_azure() -> dict[str, str]:
        storage = health_check_storage()
        search = health_check_search()
        foundry = health_check_foundry()
        kv = health_check_keyvault()
        out: dict[str, str] = {
            "storage": "ok" if storage.ok else "fail",
            "search": "ok" if search.ok else "fail",
            "foundry": "ok" if foundry.ok else "fail",
            "keyvault": "ok" if kv.ok else "fail",
        }
        # Provide diagnostics without leaking secrets/values.
        if not storage.ok and storage.detail:
            out["storage_detail"] = storage.detail
        if not search.ok and search.detail:
            out["search_detail"] = search.detail
        if not foundry.ok and foundry.detail:
            out["foundry_detail"] = foundry.detail
        if not kv.ok and kv.detail:
            out["keyvault_detail"] = kv.detail
        return out

    @app.post("/admin/dev/seed", tags=["admin"])
    def dev_seed(payload: DevSeedRequest, db: Session = Depends(get_db)) -> dict:
        if settings.env != Env.dev:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

        # bootstrap actor (no auth required for first seed in dev)
        set_actor("dev-seed", [Role.ADMIN.value])

        fund = Fund(name=payload.fund_name, description="dev seed", is_active=True, created_by="dev-seed", updated_by="dev-seed")
        user = User(email=payload.user_email, display_name=payload.display_name, is_active=True, created_by="dev-seed", updated_by="dev-seed")
        db.add(fund)
        db.add(user)
        db.flush()

        for r in payload.roles:
            db.add(
                UserFundRole(
                    user_id=user.id,
                    fund_id=fund.id,
                    role=r.value,
                    created_by="dev-seed",
                    updated_by="dev-seed",
                )
            )
        db.commit()

        return {
            "fund_id": str(fund.id),
            "user_id": str(user.id),
            "dev_actor_header_name": settings.dev_actor_header,
            "dev_actor_header_value": {
                "actor_id": str(user.id),
                "roles": [r.value for r in payload.roles],
                "fund_ids": [str(fund.id)],
            },
            "note": "Use este payload como JSON no header X-DEV-ACTOR (somente em ENV=dev).",
        }

    fund_router = APIRouter(
        prefix="/funds/{fund_id}",
        dependencies=[Depends(require_fund_access())],
    )
    fund_router.include_router(portfolio_router)
    fund_router.include_router(deals_router)
    fund_router.include_router(actions_router)
    fund_router.include_router(compliance_router)
    fund_router.include_router(documents_router)
    fund_router.include_router(documents_ingest_router)
    fund_router.include_router(ai_router)
    fund_router.include_router(signatures_router)
    app.include_router(fund_router)

    # Azure Static Web Apps (linked backend) proxies requests under /api/*.
    # Provide /api aliases without breaking existing routes.
    app.include_router(fund_router, prefix="/api")

    # Domain portfolio (asset-first + subtype extensions)
    app.include_router(assets_router)
    app.include_router(fund_investments_router)
    app.include_router(obligations_router)
    app.include_router(alerts_router)
    app.include_router(portfolio_actions_router)
    app.include_router(domain_deals_router)
    app.include_router(conversion_router)
    app.include_router(ic_memos_router)
    app.include_router(governed_actions_router)
    app.include_router(evidence_upload_router)
    app.include_router(auditor_router)
    app.include_router(evidence_router)
    app.include_router(report_packs_router)
    app.include_router(investor_portal_router)
    app.include_router(evidence_pack_router)
    app.include_router(reports_router)
    app.include_router(dataroom_router)
    app.include_router(cash_router)

    # /api aliases for all domain routers.
    app.include_router(assets_router, prefix="/api")
    app.include_router(fund_investments_router, prefix="/api")
    app.include_router(obligations_router, prefix="/api")
    app.include_router(alerts_router, prefix="/api")
    app.include_router(portfolio_actions_router, prefix="/api")
    app.include_router(domain_deals_router, prefix="/api")
    app.include_router(conversion_router, prefix="/api")
    app.include_router(ic_memos_router, prefix="/api")
    app.include_router(governed_actions_router, prefix="/api")
    app.include_router(evidence_upload_router, prefix="/api")
    app.include_router(auditor_router, prefix="/api")
    app.include_router(evidence_router, prefix="/api")
    app.include_router(report_packs_router, prefix="/api")
    app.include_router(investor_portal_router, prefix="/api")
    app.include_router(evidence_pack_router, prefix="/api")
    app.include_router(reports_router, prefix="/api")
    # NOTE: dataroom_router already uses prefix '/api/dataroom' (avoid '/api/api/...').
    app.include_router(cash_router, prefix="/api")

    return app


app = create_app()

