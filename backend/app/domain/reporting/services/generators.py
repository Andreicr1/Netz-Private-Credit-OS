from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domain.portfolio.enums import AssetType, ObligationStatus
from app.domain.portfolio.models.assets import PortfolioAsset
from app.domain.portfolio.models.obligations import AssetObligation


def generate_nav_summary(db: Session, fund_id: uuid.UUID) -> dict:
    return {"placeholder": "NAV computation not implemented"}


def generate_portfolio_exposure(db: Session, fund_id: uuid.UUID) -> dict:
    total_assets = db.execute(
        select(func.count()).select_from(PortfolioAsset).where(PortfolioAsset.fund_id == fund_id)
    ).scalar_one()
    direct_loans = db.execute(
        select(func.count())
        .select_from(PortfolioAsset)
        .where(PortfolioAsset.fund_id == fund_id, PortfolioAsset.asset_type == AssetType.DIRECT_LOAN)
    ).scalar_one()
    fund_investments = db.execute(
        select(func.count())
        .select_from(PortfolioAsset)
        .where(PortfolioAsset.fund_id == fund_id, PortfolioAsset.asset_type == AssetType.FUND_INVESTMENT)
    ).scalar_one()
    return {"assets": int(total_assets), "direct_loans": int(direct_loans), "fund_investments": int(fund_investments)}


def generate_open_actions(db: Session, fund_id: uuid.UUID) -> dict:
    # Placeholder for future: execution action system is not normalized here.
    return {"open_actions": 0}


def generate_overdue_obligations(db: Session, fund_id: uuid.UUID) -> dict:
    # Count obligations that are OVERDUE for assets in this fund (via join)
    overdue = (
        db.query(AssetObligation)
        .join(PortfolioAsset, PortfolioAsset.id == AssetObligation.asset_id)
        .filter(PortfolioAsset.fund_id == fund_id)
        .filter(AssetObligation.status == ObligationStatus.OVERDUE)
        .count()
    )
    return {"overdue": int(overdue)}

