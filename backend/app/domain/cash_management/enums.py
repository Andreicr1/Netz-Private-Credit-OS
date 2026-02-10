from __future__ import annotations

from enum import Enum


class CashTransactionType(str, Enum):
    EXPENSE = "EXPENSE"
    INVESTMENT = "INVESTMENT"
    CASH_MANAGEMENT = "CASH_MANAGEMENT"


class CashTransactionStatus(str, Enum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    SENT_TO_ADMIN = "SENT_TO_ADMIN"
    EXECUTED = "EXECUTED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"

