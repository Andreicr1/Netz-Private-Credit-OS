from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.modules.deals.models import Deal


@dataclass(frozen=True)
class QualificationEval:
    result: str  # pass/fail/flag
    reasons: list[dict[str, Any]]


def evaluate_rule(rule_config: dict[str, Any], deal: Deal) -> QualificationEval:
    """
    Minimal, explicit, auditable qualification evaluator.

    Supported rule_config keys (optional):
    - min_amount: float
    - max_amount: float
    - allowed_currencies: [str]
    - require_borrower_name: bool
    - always_flag: bool
    - fail_reason_code: str
    - flag_reason_code: str
    """
    reasons: list[dict[str, Any]] = []

    def add(code: str, message: str, level: str) -> None:
        reasons.append({"code": code, "message": message, "level": level})

    if rule_config.get("always_flag") is True:
        add(rule_config.get("flag_reason_code", "QUAL_FLAG"), "Regra configurada para flag.", "flag")
        return QualificationEval(result="flag", reasons=reasons)

    if rule_config.get("require_borrower_name") is True and not deal.borrower_name:
        add(rule_config.get("fail_reason_code", "MISSING_BORROWER"), "Borrower ausente.", "fail")
        return QualificationEval(result="fail", reasons=reasons)

    amount = float(deal.requested_amount) if deal.requested_amount is not None else None
    min_amount = rule_config.get("min_amount")
    if amount is not None and min_amount is not None and amount < float(min_amount):
        add(rule_config.get("fail_reason_code", "AMOUNT_TOO_SMALL"), "Valor abaixo do mínimo do mandato.", "fail")
        return QualificationEval(result="fail", reasons=reasons)

    max_amount = rule_config.get("max_amount")
    if amount is not None and max_amount is not None and amount > float(max_amount):
        add(rule_config.get("fail_reason_code", "AMOUNT_TOO_LARGE"), "Valor acima do máximo do mandato.", "fail")
        return QualificationEval(result="fail", reasons=reasons)

    allowed = rule_config.get("allowed_currencies")
    if allowed and deal.currency not in set(str(c).upper() for c in allowed):
        add(rule_config.get("fail_reason_code", "CURRENCY_NOT_ALLOWED"), "Moeda fora do mandato.", "fail")
        return QualificationEval(result="fail", reasons=reasons)

    add("OK", "Qualificação passou.", "pass")
    return QualificationEval(result="pass", reasons=reasons)

