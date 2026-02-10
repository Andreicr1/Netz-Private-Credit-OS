from __future__ import annotations

from enum import Enum


class CashTransactionType(str, Enum):
    LP_SUBSCRIPTION = "LP_SUBSCRIPTION"
    CAPITAL_CALL = "CAPITAL_CALL"
    FUND_EXPENSE = "FUND_EXPENSE"
    INVESTMENT = "INVESTMENT"
    TRANSFER_INTERNAL = "TRANSFER_INTERNAL"
    BANK_FEE = "BANK_FEE"
    OTHER = "OTHER"
    # Legacy (for backward compatibility)
    EXPENSE = "FUND_EXPENSE"
    CASH_MANAGEMENT = "TRANSFER_INTERNAL"


class CashTransactionDirection(str, Enum):
    INFLOW = "INFLOW"
    OUTFLOW = "OUTFLOW"


class CashTransactionStatus(str, Enum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    SENT_TO_ADMIN = "SENT_TO_ADMIN"
    EXECUTED = "EXECUTED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class JustificationType(str, Enum):
    OFFERING_MEMO_CLAUSE = "OFFERING_MEMO_CLAUSE"
    INVESTMENT_MEMO_APPROVAL = "INVESTMENT_MEMO_APPROVAL"
    OTHER_SUPPORTING_DOC = "OTHER_SUPPORTING_DOC"


class ReconciliationStatus(str, Enum):
    UNMATCHED = "UNMATCHED"
    MATCHED = "MATCHED"
    DISCREPANCY = "DISCREPANCY"

