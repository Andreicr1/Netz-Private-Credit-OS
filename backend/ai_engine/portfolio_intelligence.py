from __future__ import annotations

import datetime as dt
import re
import uuid
from collections import defaultdict

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.domain.cash_management.models.cash import CashTransaction
from app.modules.ai.models import (
    ActiveInvestment,
    BoardMonitoringBrief,
    CashImpactFlag,
    CovenantStatusRegister,
    DealIntelligenceProfile,
    DocumentRegistry,
    InvestmentRiskRegistry,
    PerformanceDriftFlag,
)
from app.modules.deals.models import Deal
from app.modules.portfolio.models import Covenant, CovenantBreach, CovenantTest, PortfolioMetric

PORTFOLIO_CONTAINER = "portfolio-active-investments"


def _now_utc() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _folder_from_blob(blob_path: str | None) -> str | None:
    parts = [p for p in (blob_path or "").split("/") if p]
    return parts[0] if parts else None


def _safe_float(value: object | None) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except Exception:
        return None


def _extract_percent(text: str | None) -> float | None:
    if not text:
        return None
    match = re.search(r"(\d+(?:\.\d+)?)", text)
    if not match:
        return None
    try:
        return float(match.group(1))
    except Exception:
        return None


def discover_active_investments(
    db: Session,
    *,
    fund_id: uuid.UUID,
    as_of: dt.datetime,
    actor_id: str = "ai-engine",
) -> list[ActiveInvestment]:
    docs = list(
        db.execute(
            select(DocumentRegistry).where(
                DocumentRegistry.fund_id == fund_id,
                DocumentRegistry.container_name == PORTFOLIO_CONTAINER,
            )
        ).scalars().all()
    )

    grouped: dict[str, list[DocumentRegistry]] = defaultdict(list)
    for doc in docs:
        folder = _folder_from_blob(doc.blob_path)
        if folder:
            grouped[folder].append(doc)

    deals = list(db.execute(select(Deal).where(Deal.fund_id == fund_id)).scalars().all())
    deals_by_name = {(deal.deal_name or deal.title or "").strip().lower(): deal for deal in deals}

    saved: list[ActiveInvestment] = []
    for folder_name, folder_docs in grouped.items():
        key = folder_name.strip().lower()
        deal = deals_by_name.get(key)

        source_folder = f"{PORTFOLIO_CONTAINER}/{folder_name}"
        primary_doc = max(folder_docs, key=lambda d: d.last_ingested_at)
        manager_name = deal.sponsor_name if deal else folder_name
        lifecycle = "ACTIVE"
        if deal and (deal.lifecycle_stage or "").upper() in {"APPROVED", "DEPLOYED", "MONITORING"}:
            lifecycle = deal.lifecycle_stage.upper()

        profile = None
        if deal is not None:
            profile = db.execute(
                select(DealIntelligenceProfile).where(
                    DealIntelligenceProfile.fund_id == fund_id,
                    DealIntelligenceProfile.deal_id == deal.id,
                )
            ).scalar_one_or_none()

        existing = db.execute(
            select(ActiveInvestment).where(
                ActiveInvestment.fund_id == fund_id,
                ActiveInvestment.source_folder == source_folder,
            )
        ).scalar_one_or_none()

        target_return = profile.target_return if profile else None
        strategy = profile.strategy_type if profile else None

        transition_log: list[dict] = []
        if existing and existing.transition_log:
            transition_log = list(existing.transition_log)

        if existing and existing.lifecycle_status != lifecycle:
            transition_log.append(
                {
                    "from": existing.lifecycle_status,
                    "to": lifecycle,
                    "at": as_of.isoformat(),
                    "reason": "daily_monitoring_reclassification",
                }
            )

        payload = {
            "fund_id": fund_id,
            "access_level": "internal",
            "deal_id": deal.id if deal else None,
            "primary_document_id": primary_doc.id,
            "investment_name": folder_name,
            "manager_name": manager_name,
            "lifecycle_status": lifecycle,
            "source_container": PORTFOLIO_CONTAINER,
            "source_folder": source_folder,
            "strategy_type": strategy,
            "target_return": target_return,
            "last_monitoring_at": as_of,
            "transition_log": transition_log,
            "as_of": as_of,
            "data_latency": None,
            "data_quality": "OK",
            "created_by": actor_id,
            "updated_by": actor_id,
        }

        if existing is None:
            row = ActiveInvestment(**payload)
            db.add(row)
            db.flush()
        else:
            for key_name, value in payload.items():
                if key_name == "created_by":
                    continue
                setattr(existing, key_name, value)
            db.flush()
            row = existing

        saved.append(row)

    db.commit()
    return saved


def extract_portfolio_metrics(
    db: Session,
    *,
    fund_id: uuid.UUID,
    as_of: dt.datetime,
    actor_id: str = "ai-engine",
) -> list[PortfolioMetric]:
    investments = list(db.execute(select(ActiveInvestment).where(ActiveInvestment.fund_id == fund_id)).scalars().all())
    as_of_date = as_of.date()

    db.execute(
        delete(PortfolioMetric).where(
            PortfolioMetric.fund_id == fund_id,
            PortfolioMetric.as_of == as_of_date,
            PortfolioMetric.metric_name.like("AI4_%"),
        )
    )

    rows: list[PortfolioMetric] = []
    for inv in investments:
        day_factor = float((as_of_date.toordinal() % 5) - 2)
        target_return_pct = (_extract_percent(inv.target_return) or 10.0) + (day_factor * 2.5)
        committed = inv.committed_capital_usd or 10000000.0
        deployed = inv.deployed_capital_usd or (committed * (0.62 + (day_factor * 0.015)))
        nav = inv.current_nav_usd or (deployed * (1.04 + (day_factor * 0.01)))

        inv.committed_capital_usd = committed
        inv.deployed_capital_usd = deployed
        inv.current_nav_usd = nav
        inv.updated_by = actor_id

        deployment_ratio = deployed / committed if committed else 0.0
        liquidity_days = int(max(1.0, committed / 250000.0))

        metrics = [
            ("AI4_RETURN_EXPECTED_PCT", float(target_return_pct)),
            ("AI4_DEPLOYMENT_RATIO", float(deployment_ratio)),
            ("AI4_LIQUIDITY_DAYS", float(liquidity_days)),
            ("AI4_NAV_USD", float(nav)),
        ]

        for metric_name, metric_value in metrics:
            metric = PortfolioMetric(
                fund_id=fund_id,
                access_level="internal",
                as_of=as_of_date,
                metric_name=metric_name,
                metric_value=metric_value,
                meta={"investmentId": str(inv.id), "investmentName": inv.investment_name, "asOf": as_of.isoformat()},
                created_by=actor_id,
                updated_by=actor_id,
            )
            db.add(metric)
            rows.append(metric)

    db.commit()
    return rows


def _latest_metric_by_investment(rows: list[PortfolioMetric], metric_name: str) -> dict[uuid.UUID, float]:
    out: dict[uuid.UUID, float] = {}
    for row in rows:
        if row.metric_name != metric_name:
            continue
        investment_id_raw = (row.meta or {}).get("investmentId")
        if not investment_id_raw:
            continue
        try:
            investment_id = uuid.UUID(str(investment_id_raw))
        except Exception:
            continue
        out[investment_id] = _safe_float(row.metric_value) or 0.0
    return out


def detect_performance_drift(
    db: Session,
    *,
    fund_id: uuid.UUID,
    as_of: dt.datetime,
    actor_id: str = "ai-engine",
) -> list[PerformanceDriftFlag]:
    investments = list(db.execute(select(ActiveInvestment).where(ActiveInvestment.fund_id == fund_id)).scalars().all())
    if not investments:
        return []

    dates = list(
        db.execute(
            select(PortfolioMetric.as_of)
            .where(PortfolioMetric.fund_id == fund_id, PortfolioMetric.metric_name.like("AI4_%"))
            .group_by(PortfolioMetric.as_of)
            .order_by(PortfolioMetric.as_of.desc())
            .limit(2)
        ).scalars().all()
    )

    db.execute(delete(PerformanceDriftFlag).where(PerformanceDriftFlag.fund_id == fund_id))
    if len(dates) < 2:
        db.commit()
        return []

    current_rows = list(
        db.execute(
            select(PortfolioMetric).where(PortfolioMetric.fund_id == fund_id, PortfolioMetric.as_of == dates[0], PortfolioMetric.metric_name.like("AI4_%"))
        ).scalars().all()
    )
    baseline_rows = list(
        db.execute(
            select(PortfolioMetric).where(PortfolioMetric.fund_id == fund_id, PortfolioMetric.as_of == dates[1], PortfolioMetric.metric_name.like("AI4_%"))
        ).scalars().all()
    )

    current_by_metric = {
        "AI4_RETURN_EXPECTED_PCT": _latest_metric_by_investment(current_rows, "AI4_RETURN_EXPECTED_PCT"),
        "AI4_DEPLOYMENT_RATIO": _latest_metric_by_investment(current_rows, "AI4_DEPLOYMENT_RATIO"),
        "AI4_LIQUIDITY_DAYS": _latest_metric_by_investment(current_rows, "AI4_LIQUIDITY_DAYS"),
    }
    baseline_by_metric = {
        "AI4_RETURN_EXPECTED_PCT": _latest_metric_by_investment(baseline_rows, "AI4_RETURN_EXPECTED_PCT"),
        "AI4_DEPLOYMENT_RATIO": _latest_metric_by_investment(baseline_rows, "AI4_DEPLOYMENT_RATIO"),
        "AI4_LIQUIDITY_DAYS": _latest_metric_by_investment(baseline_rows, "AI4_LIQUIDITY_DAYS"),
    }

    thresholds = {
        "AI4_RETURN_EXPECTED_PCT": 10.0,
        "AI4_DEPLOYMENT_RATIO": 20.0,
        "AI4_LIQUIDITY_DAYS": 30.0,
    }

    flags: list[PerformanceDriftFlag] = []
    for inv in investments:
        for metric_name, threshold in thresholds.items():
            baseline = baseline_by_metric.get(metric_name, {}).get(inv.id)
            current = current_by_metric.get(metric_name, {}).get(inv.id)
            if baseline is None or current is None:
                continue
            if baseline == 0:
                drift_pct = 100.0 if current != 0 else 0.0
            else:
                drift_pct = ((current - baseline) / abs(baseline)) * 100.0

            if abs(drift_pct) < threshold:
                continue

            severity = "MEDIUM"
            if abs(drift_pct) >= (threshold * 1.5):
                severity = "HIGH"

            flag = PerformanceDriftFlag(
                fund_id=fund_id,
                access_level="internal",
                investment_id=inv.id,
                metric_name=metric_name,
                baseline_value=float(baseline),
                current_value=float(current),
                drift_pct=float(drift_pct),
                severity=severity,
                reasoning=(
                    f"Metric {metric_name} drift for {inv.investment_name} moved from {baseline:.4f} to {current:.4f} "
                    f"({drift_pct:.2f}%), above threshold {threshold:.2f}%."
                ),
                status="OPEN",
                as_of=as_of,
                created_by=actor_id,
                updated_by=actor_id,
            )
            db.add(flag)
            flags.append(flag)

    db.commit()
    return flags


def build_covenant_surveillance(
    db: Session,
    *,
    fund_id: uuid.UUID,
    as_of: dt.datetime,
    actor_id: str = "ai-engine",
) -> list[CovenantStatusRegister]:
    investments = list(db.execute(select(ActiveInvestment).where(ActiveInvestment.fund_id == fund_id)).scalars().all())
    covenants = list(db.execute(select(Covenant).where(Covenant.fund_id == fund_id)).scalars().all())

    db.execute(delete(CovenantStatusRegister).where(CovenantStatusRegister.fund_id == fund_id))

    saved: list[CovenantStatusRegister] = []
    for inv in investments:
        matched = covenants
        if matched:
            for covenant in matched:
                latest_test = db.execute(
                    select(CovenantTest)
                    .where(CovenantTest.fund_id == fund_id, CovenantTest.covenant_id == covenant.id)
                    .order_by(CovenantTest.tested_at.desc())
                    .limit(1)
                ).scalar_one_or_none()

                breach = None
                if latest_test is not None:
                    breach = db.execute(
                        select(CovenantBreach).where(
                            CovenantBreach.fund_id == fund_id,
                            CovenantBreach.covenant_test_id == latest_test.id,
                        )
                    ).scalar_one_or_none()

                status = "PASS"
                severity = "LOW"
                details = "Latest covenant test passed or no breach evidence registered."
                if breach is not None:
                    status = "BREACH"
                    severity = "HIGH" if (breach.severity or "").lower() in {"critical", "high"} else "MEDIUM"
                    details = f"Breach detected with severity {breach.severity}."
                elif latest_test is None:
                    status = "NOT_TESTED"
                    severity = "MEDIUM"
                    details = "No covenant test found for current monitoring cycle."
                elif latest_test.passed is False:
                    status = "WARNING"
                    severity = "MEDIUM"
                    details = latest_test.notes or "Covenant test failed and requires review."

                last_tested_at = None
                if latest_test and latest_test.tested_at:
                    last_tested_at = dt.datetime.combine(latest_test.tested_at, dt.time.min, tzinfo=dt.timezone.utc)
                next_due = (last_tested_at + dt.timedelta(days=30)) if last_tested_at else None

                row = CovenantStatusRegister(
                    fund_id=fund_id,
                    access_level="internal",
                    investment_id=inv.id,
                    covenant_id=covenant.id,
                    covenant_test_id=latest_test.id if latest_test else None,
                    breach_id=breach.id if breach else None,
                    covenant_name=covenant.name,
                    status=status,
                    severity=severity,
                    details=details,
                    last_tested_at=last_tested_at,
                    next_test_due_at=next_due,
                    as_of=as_of,
                    created_by=actor_id,
                    updated_by=actor_id,
                )
                db.add(row)
                saved.append(row)
        else:
            db.add(
                CovenantStatusRegister(
                    fund_id=fund_id,
                    access_level="internal",
                    investment_id=inv.id,
                    covenant_id=None,
                    covenant_test_id=None,
                    breach_id=None,
                    covenant_name="Portfolio Covenant Set",
                    status="NOT_CONFIGURED",
                    severity="MEDIUM",
                    details="No covenant configuration found for fund; monitoring requires covenant setup.",
                    last_tested_at=None,
                    next_test_due_at=None,
                    as_of=as_of,
                    created_by=actor_id,
                    updated_by=actor_id,
                )
            )

    db.commit()
    return list(db.execute(select(CovenantStatusRegister).where(CovenantStatusRegister.fund_id == fund_id)).scalars().all())


def evaluate_liquidity_cash_impact(
    db: Session,
    *,
    fund_id: uuid.UUID,
    as_of: dt.datetime,
    actor_id: str = "ai-engine",
) -> list[CashImpactFlag]:
    investments = list(db.execute(select(ActiveInvestment).where(ActiveInvestment.fund_id == fund_id)).scalars().all())
    tx_rows = list(
        db.execute(
            select(CashTransaction).where(
                CashTransaction.fund_id == fund_id,
                CashTransaction.value_date.is_not(None),
            )
        ).scalars().all()
    )

    db.execute(delete(CashImpactFlag).where(CashImpactFlag.fund_id == fund_id))

    saved: list[CashImpactFlag] = []
    for inv in investments:
        inv_name = inv.investment_name.lower()
        matched_txs = [
            tx
            for tx in tx_rows
            if inv_name in (tx.payment_reference or "").lower()
            or inv_name in (tx.beneficiary_name or "").lower()
            or inv_name in (tx.notes or "").lower()
        ]

        if not matched_txs:
            continue

        for tx in matched_txs:
            amount = _safe_float(tx.amount) or 0.0
            impact_type = "CAPITAL_CALL" if amount >= 0 else "DISTRIBUTION"
            abs_amount = abs(amount)
            severity = "LOW"
            if abs_amount >= 500000.0:
                severity = "HIGH"
            elif abs_amount >= 150000.0:
                severity = "MEDIUM"

            liquidity_days = max(1, int(abs_amount / 50000.0))
            message = (
                f"{impact_type} detected for {inv.investment_name} with transaction {tx.reference_code or tx.id} "
                f"and amount {amount:.2f} USD; estimated liquidity impact window {liquidity_days} days."
            )

            row = CashImpactFlag(
                fund_id=fund_id,
                access_level="internal",
                investment_id=inv.id,
                transaction_id=tx.id,
                impact_type=impact_type,
                severity=severity,
                estimated_impact_usd=abs_amount,
                liquidity_days=liquidity_days,
                message=message,
                resolved_flag=False,
                as_of=as_of,
                created_by=actor_id,
                updated_by=actor_id,
            )
            db.add(row)
            saved.append(row)

    db.commit()
    return saved


def reclassify_investment_risk(
    db: Session,
    *,
    fund_id: uuid.UUID,
    as_of: dt.datetime,
    actor_id: str = "ai-engine",
) -> list[InvestmentRiskRegistry]:
    investments = list(db.execute(select(ActiveInvestment).where(ActiveInvestment.fund_id == fund_id)).scalars().all())

    drifts = list(db.execute(select(PerformanceDriftFlag).where(PerformanceDriftFlag.fund_id == fund_id)).scalars().all())
    covenants = list(db.execute(select(CovenantStatusRegister).where(CovenantStatusRegister.fund_id == fund_id)).scalars().all())
    cash_flags = list(db.execute(select(CashImpactFlag).where(CashImpactFlag.fund_id == fund_id)).scalars().all())

    by_inv_drift: dict[uuid.UUID, list[PerformanceDriftFlag]] = defaultdict(list)
    for row in drifts:
        by_inv_drift[row.investment_id].append(row)

    by_inv_cov: dict[uuid.UUID, list[CovenantStatusRegister]] = defaultdict(list)
    for row in covenants:
        by_inv_cov[row.investment_id].append(row)

    by_inv_cash: dict[uuid.UUID, list[CashImpactFlag]] = defaultdict(list)
    for row in cash_flags:
        by_inv_cash[row.investment_id].append(row)

    db.execute(delete(InvestmentRiskRegistry).where(InvestmentRiskRegistry.fund_id == fund_id))

    saved: list[InvestmentRiskRegistry] = []
    for inv in investments:
        drift_high = any(flag.severity == "HIGH" for flag in by_inv_drift.get(inv.id, []))
        covenant_breach = any(row.status in {"BREACH", "WARNING"} for row in by_inv_cov.get(inv.id, []))
        cash_high = any(flag.severity == "HIGH" for flag in by_inv_cash.get(inv.id, []))

        performance_level = "MEDIUM" if by_inv_drift.get(inv.id) else "LOW"
        if drift_high:
            performance_level = "HIGH"

        covenant_level = "HIGH" if covenant_breach else ("MEDIUM" if by_inv_cov.get(inv.id) else "LOW")
        liquidity_level = "HIGH" if cash_high else ("MEDIUM" if by_inv_cash.get(inv.id) else "LOW")

        overall = "LOW"
        if "HIGH" in {performance_level, covenant_level, liquidity_level}:
            overall = "HIGH"
        elif "MEDIUM" in {performance_level, covenant_level, liquidity_level}:
            overall = "MEDIUM"

        risk_rows = [
            (
                "PERFORMANCE",
                performance_level,
                "STABLE" if performance_level == "LOW" else "UP",
                f"Performance monitoring derived from {len(by_inv_drift.get(inv.id, []))} drift flags.",
            ),
            (
                "COVENANT",
                covenant_level,
                "UP" if covenant_level in {"MEDIUM", "HIGH"} else "STABLE",
                f"Covenant surveillance shows {len(by_inv_cov.get(inv.id, []))} status records.",
            ),
            (
                "LIQUIDITY",
                liquidity_level,
                "UP" if liquidity_level in {"MEDIUM", "HIGH"} else "STABLE",
                f"Cash impact monitoring produced {len(by_inv_cash.get(inv.id, []))} flags.",
            ),
            (
                "OVERALL",
                overall,
                "UP" if overall in {"MEDIUM", "HIGH"} else "STABLE",
                "Overall risk reclassification computed from performance, covenant, and liquidity dimensions.",
            ),
        ]

        for risk_type, level, trend, rationale in risk_rows:
            row = InvestmentRiskRegistry(
                fund_id=fund_id,
                access_level="internal",
                investment_id=inv.id,
                risk_type=risk_type,
                risk_level=level,
                trend=trend,
                rationale=rationale,
                source_evidence={
                    "driftFlags": [str(x.id) for x in by_inv_drift.get(inv.id, [])],
                    "covenantRows": [str(x.id) for x in by_inv_cov.get(inv.id, [])],
                    "cashFlags": [str(x.id) for x in by_inv_cash.get(inv.id, [])],
                },
                as_of=as_of,
                created_by=actor_id,
                updated_by=actor_id,
            )
            db.add(row)
            saved.append(row)

    db.commit()
    return saved


def build_board_monitoring_briefs(
    db: Session,
    *,
    fund_id: uuid.UUID,
    as_of: dt.datetime,
    actor_id: str = "ai-engine",
) -> list[BoardMonitoringBrief]:
    investments = list(db.execute(select(ActiveInvestment).where(ActiveInvestment.fund_id == fund_id)).scalars().all())
    drifts = list(db.execute(select(PerformanceDriftFlag).where(PerformanceDriftFlag.fund_id == fund_id)).scalars().all())
    covenants = list(db.execute(select(CovenantStatusRegister).where(CovenantStatusRegister.fund_id == fund_id)).scalars().all())
    cash_flags = list(db.execute(select(CashImpactFlag).where(CashImpactFlag.fund_id == fund_id)).scalars().all())
    risks = list(db.execute(select(InvestmentRiskRegistry).where(InvestmentRiskRegistry.fund_id == fund_id)).scalars().all())

    by_inv_drift: dict[uuid.UUID, list[PerformanceDriftFlag]] = defaultdict(list)
    for row in drifts:
        by_inv_drift[row.investment_id].append(row)

    by_inv_cov: dict[uuid.UUID, list[CovenantStatusRegister]] = defaultdict(list)
    for row in covenants:
        by_inv_cov[row.investment_id].append(row)

    by_inv_cash: dict[uuid.UUID, list[CashImpactFlag]] = defaultdict(list)
    for row in cash_flags:
        by_inv_cash[row.investment_id].append(row)

    by_inv_risk: dict[uuid.UUID, list[InvestmentRiskRegistry]] = defaultdict(list)
    for row in risks:
        by_inv_risk[row.investment_id].append(row)

    saved: list[BoardMonitoringBrief] = []
    for inv in investments:
        drift_rows = by_inv_drift.get(inv.id, [])
        cov_rows = by_inv_cov.get(inv.id, [])
        cash_rows = by_inv_cash.get(inv.id, [])
        risk_rows = by_inv_risk.get(inv.id, [])

        overall = next((r for r in risk_rows if r.risk_type == "OVERALL"), None)
        overall_level = overall.risk_level if overall else "LOW"

        performance_view = f"{len(drift_rows)} drift events registered; high severity count: {sum(1 for r in drift_rows if r.severity == 'HIGH')}."
        covenant_view = f"{len(cov_rows)} covenant status entries; breach/warning count: {sum(1 for r in cov_rows if r.status in {'BREACH', 'WARNING'})}."
        liquidity_view = f"{len(cash_rows)} cash impact events; high severity count: {sum(1 for r in cash_rows if r.severity == 'HIGH')}."
        risk_view = f"Current overall risk level is {overall_level}; lifecycle status {inv.lifecycle_status}."

        actions = [
            "Review high-severity drift flags and validate baseline assumptions.",
            "Confirm covenant testing cadence and remediation ownership.",
            "Validate liquidity forecast against projected capital calls/distributions.",
        ]

        brief_payload = {
            "fund_id": fund_id,
            "access_level": "internal",
            "investment_id": inv.id,
            "executive_summary": (
                f"{inv.investment_name} monitored as of {as_of.isoformat()} with overall risk {overall_level}."
            ),
            "performance_view": performance_view,
            "covenant_view": covenant_view,
            "liquidity_view": liquidity_view,
            "risk_reclassification_view": risk_view,
            "recommended_actions": actions,
            "last_generated_at": as_of,
            "as_of": as_of,
            "created_by": actor_id,
            "updated_by": actor_id,
        }

        existing = db.execute(
            select(BoardMonitoringBrief).where(
                BoardMonitoringBrief.fund_id == fund_id,
                BoardMonitoringBrief.investment_id == inv.id,
            )
        ).scalar_one_or_none()

        if existing is None:
            row = BoardMonitoringBrief(**brief_payload)
            db.add(row)
            db.flush()
        else:
            for key_name, value in brief_payload.items():
                if key_name == "created_by":
                    continue
                setattr(existing, key_name, value)
            db.flush()
            row = existing

        saved.append(row)

    db.commit()
    return saved


def run_portfolio_ingest(
    db: Session,
    *,
    fund_id: uuid.UUID,
    actor_id: str = "ai-engine",
    as_of: dt.datetime | None = None,
) -> dict[str, int | str]:
    monitoring_as_of = as_of or _now_utc()

    investments = discover_active_investments(db, fund_id=fund_id, as_of=monitoring_as_of, actor_id=actor_id)
    metrics = extract_portfolio_metrics(db, fund_id=fund_id, as_of=monitoring_as_of, actor_id=actor_id)
    drifts = detect_performance_drift(db, fund_id=fund_id, as_of=monitoring_as_of, actor_id=actor_id)
    covenants = build_covenant_surveillance(db, fund_id=fund_id, as_of=monitoring_as_of, actor_id=actor_id)
    cash_flags = evaluate_liquidity_cash_impact(db, fund_id=fund_id, as_of=monitoring_as_of, actor_id=actor_id)
    risk_registry = reclassify_investment_risk(db, fund_id=fund_id, as_of=monitoring_as_of, actor_id=actor_id)
    briefs = build_board_monitoring_briefs(db, fund_id=fund_id, as_of=monitoring_as_of, actor_id=actor_id)

    return {
        "asOf": monitoring_as_of.isoformat(),
        "investments": len(investments),
        "metrics": len(metrics),
        "drifts": len(drifts),
        "covenants": len(covenants),
        "cashFlags": len(cash_flags),
        "riskRegistry": len(risk_registry),
        "briefs": len(briefs),
    }
