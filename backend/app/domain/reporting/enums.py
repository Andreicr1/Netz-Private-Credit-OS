from enum import Enum


class ReportPackStatus(str, Enum):
    DRAFT = "DRAFT"
    GENERATED = "GENERATED"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


class ReportSectionType(str, Enum):
    NAV_SUMMARY = "NAV_SUMMARY"
    PORTFOLIO_EXPOSURE = "PORTFOLIO_EXPOSURE"
    OBLIGATIONS = "OBLIGATIONS"
    ACTIONS = "ACTIONS"
    BREACHES = "BREACHES"

