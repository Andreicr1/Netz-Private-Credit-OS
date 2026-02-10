from __future__ import annotations

from app.domain.deals.enums import RejectionCode


def run_minimum_qualification(deal) -> tuple[bool, str, RejectionCode | None]:
    """
    Deterministic minimum filters.
    Later replaced by configurable rule engine.
    """

    # Keep the placeholder deterministic and enumerable.
    if str(deal.deal_type) == "DealType.FUND_INVESTMENT" or str(deal.deal_type) == "FUND_INVESTMENT":
        return True, "Fund investment meets minimum mandate filters.", None

    return False, "Deal rejected: out of mandate.", RejectionCode.OUT_OF_MANDATE

