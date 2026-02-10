from __future__ import annotations

from enum import Enum


class AssetType(str, Enum):
    DIRECT_LOAN = "DIRECT_LOAN"
    FUND_INVESTMENT = "FUND_INVESTMENT"


class Strategy(str, Enum):
    CORE_DIRECT_LENDING = "CORE_DIRECT_LENDING"
    FUND_SECONDARIES = "FUND_SECONDARIES"


class ReportingFrequency(str, Enum):
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    SEMI_ANNUAL = "SEMI_ANNUAL"
    ANNUAL = "ANNUAL"


class ObligationType(str, Enum):
    NAV_REPORT = "NAV_REPORT"
    CAPITAL_CALL_NOTICE = "CAPITAL_CALL_NOTICE"
    VALUATION_UPDATE = "VALUATION_UPDATE"
    COVENANT_TEST = "COVENANT_TEST"  # future


class ObligationStatus(str, Enum):
    OPEN = "OPEN"
    PENDING_EVIDENCE = "PENDING_EVIDENCE"
    SATISFIED = "SATISFIED"
    OVERDUE = "OVERDUE"
    WAIVED = "WAIVED"


class AlertSeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class AlertType(str, Enum):
    OBLIGATION_OVERDUE = "OBLIGATION_OVERDUE"
    NAV_MISSING = "NAV_MISSING"
    COVENANT_BREACH = "COVENANT_BREACH"


class ActionStatus(str, Enum):
    OPEN = "OPEN"
    PENDING_EVIDENCE = "PENDING_EVIDENCE"
    UNDER_REVIEW = "UNDER_REVIEW"
    CLOSED = "CLOSED"
    WAIVED = "WAIVED"

