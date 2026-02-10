from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


WIRE_INSTRUCTIONS_USD: dict[str, Any] = {
    "intermediary_bank": {"name": "BNY Mellon", "swift": "IRVTUS3N"},
    "beneficiary_bank": {"name": "FundBank Cayman", "swift": "CAYIKYKY"},
    "beneficiary_account": "00750700",
    "payment_reference_default": "Netz Private Credit Fund",
    "normative_basis": [
        "Wire Instructions - Netz Private Credit (USD)",
    ],
}


@dataclass(frozen=True)
class InstructionPackage:
    html: str
    metadata: dict[str, Any]


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def generate_transfer_instruction_html(*, tx: dict[str, Any], approvals: list[dict[str, Any]]) -> InstructionPackage:
    """
    Gera um pacote HTML (auditável) para instrução de transferência.
    """
    wi = WIRE_INSTRUCTIONS_USD
    payment_ref = tx.get("payment_reference") or wi["payment_reference_default"]
    created_at = _utcnow_iso()

    approvals_rows = "\n".join(
        f"<tr><td>{a.get('approver_role')}</td><td>{a.get('approver_name')}</td><td>{a.get('approved_at')}</td></tr>"
        for a in approvals
    )

    html = f"""<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Transfer Instruction Package</title>
    <style>
      body {{ font-family: Arial, sans-serif; margin: 24px; }}
      h1, h2 {{ margin-bottom: 8px; }}
      table {{ border-collapse: collapse; width: 100%; }}
      td, th {{ border: 1px solid #ddd; padding: 8px; }}
      th {{ background: #f5f5f5; text-align: left; }}
      .muted {{ color: #666; font-size: 12px; }}
      .box {{ border: 1px solid #ddd; padding: 12px; margin: 12px 0; }}
    </style>
  </head>
  <body>
    <h1>Transfer Instruction Package (USD)</h1>
    <div class="muted">Generated at (UTC): {created_at}</div>

    <div class="box">
      <h2>Transaction</h2>
      <table>
        <tr><th>Transaction ID</th><td>{tx.get('id')}</td></tr>
        <tr><th>Type</th><td>{tx.get('type')}</td></tr>
        <tr><th>Amount</th><td>USD {tx.get('amount')}</td></tr>
        <tr><th>Payment Reference</th><td>{payment_ref}</td></tr>
        <tr><th>Beneficiary Name</th><td>{tx.get('beneficiary_name') or ''}</td></tr>
      </table>
    </div>

    <div class="box">
      <h2>Wire Instructions</h2>
      <table>
        <tr><th>Intermediary Bank</th><td>{wi['intermediary_bank']['name']}</td></tr>
        <tr><th>Intermediary SWIFT</th><td>{wi['intermediary_bank']['swift']}</td></tr>
        <tr><th>Beneficiary Bank</th><td>{wi['beneficiary_bank']['name']}</td></tr>
        <tr><th>Beneficiary SWIFT</th><td>{wi['beneficiary_bank']['swift']}</td></tr>
        <tr><th>Account</th><td>{wi['beneficiary_account']}</td></tr>
        <tr><th>For Further Credit To / Payment Reference</th><td>{payment_ref}</td></tr>
      </table>
    </div>

    <div class="box">
      <h2>Approvals (Manual Record)</h2>
      <div class="muted">APPROVED only if 2 director sign-offs attached (and IC approvals when applicable).</div>
      <table>
        <tr><th>Role</th><th>Name</th><th>Approved At (UTC)</th></tr>
        {approvals_rows}
      </table>
    </div>
  </body>
</html>
"""

    meta = {
        "generated_at_utc": created_at,
        "wire_instructions": wi,
        "transaction_id": tx.get("id"),
    }
    return InstructionPackage(html=html, metadata=meta)

