from __future__ import annotations

from enum import Enum


class Env(str, Enum):
    dev = "dev"
    prod = "prod"
    test = "test"


class AccessLevel(str, Enum):
    internal = "internal"
    investor = "investor"
    auditor = "auditor"
    compliance = "compliance"
    admin = "admin"


class Role(str, Enum):
    GP = "GP"
    COMPLIANCE = "COMPLIANCE"
    DIRECTOR = "DIRECTOR"
    AUDITOR = "AUDITOR"
    INVESTOR = "INVESTOR"
    ADMIN = "ADMIN"
    INVESTMENT_TEAM = "INVESTMENT_TEAM"


class ActionStatus(str, Enum):
    open = "Open"
    in_progress = "In Progress"
    pending_evidence = "Pending Evidence"
    under_review = "Under Review"
    closed = "Closed"


class DealStage(str, Enum):
    intake = "Intake"
    qualification = "Qualification"
    initial_review = "Initial Review"
    underwriting = "Underwriting"
    ic_memo_draft = "IC Memo Draft"
    ic_decision = "IC Decision"
    execution = "Execution"
    archived = "Archived"


class DecisionOutcome(str, Enum):
    approved = "approved"
    rejected = "rejected"
    conditional = "conditional"


class AlertType(str, Enum):
    portfolio = "portfolio"
    compliance = "compliance"
    system = "system"

