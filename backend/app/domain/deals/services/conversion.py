from __future__ import annotations

from sqlalchemy.orm import Session

from app.domain.deals.models.deals import Deal
from app.domain.portfolio.enums import AssetType, Strategy
from app.domain.portfolio.models.assets import PortfolioAsset


def convert_deal_to_asset(db: Session, deal: Deal) -> PortfolioAsset:
    """
    Approved deals become canonical PortfolioAssets.

    Strategy mapping will be refined later.
    """

    try:
        asset_type = AssetType[deal.deal_type.value]
    except Exception as e:
        raise ValueError(f"Unsupported deal_type for conversion: {deal.deal_type}") from e

    asset = PortfolioAsset(
        fund_id=deal.fund_id,
        asset_type=asset_type,
        strategy=Strategy.CORE_DIRECT_LENDING,
        name=deal.name,
    )

    db.add(asset)
    db.flush()
    db.refresh(asset)
    return asset

