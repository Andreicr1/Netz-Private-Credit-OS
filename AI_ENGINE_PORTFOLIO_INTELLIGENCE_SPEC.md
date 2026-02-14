# AI Engine Portfolio Intelligence Spec (Wave AI-4)

## Domain Scope
Active portfolio monitoring intelligence for already-approved/deployed investments.
No client-side governance logic; backend persistence only.

## Authority Constraint
AI-4 is institutional monitoring intelligence. It does not mutate economic lifecycle state directly.

## Source
Primary document source container: `portfolio-active-investments`.
Supporting data sources:
- `pipeline_deals` + `deal_intelligence_profiles`
- `covenants`, `covenant_tests`, `covenant_breaches`
- `cash_transactions`

## D1 — Active Investment Discovery
Input: AI-2/AI-3 registries + portfolio active container.
Output: `active_investments` upsert with:
- `investment_name`, `manager_name`, `lifecycle_status`
- `source_container`, `source_folder`
- `transition_log`
- `as_of`, `data_latency`, `data_quality`

## D2 — Portfolio Metrics Extraction
Output table: existing `portfolio_metrics`
Metric namespace: `AI4_*`
Metrics generated per investment per snapshot date:
- `AI4_RETURN_EXPECTED_PCT`
- `AI4_DEPLOYMENT_RATIO`
- `AI4_LIQUIDITY_DAYS`
- `AI4_NAV_USD`

## D3 — Performance Drift Detection
Output table: `performance_drift_flags`
Method:
- Compare latest and previous `AI4_*` snapshots.
- Persist only threshold-breaking drift events.

## D4 — Covenant Surveillance
Output table: `covenant_status_register`
Method:
- Evaluate latest covenant tests and breach records.
- Persist status and severity at investment level.

## D5 — Liquidity/Cash Impact
Output table: `cash_impact_flags`
Method:
- Detect investment-linked cash transactions.
- Persist severity, estimated impact, and liquidity window.

## D6 — Risk Reclassification
Output table: `investment_risk_registry`
Risk dimensions:
- `PERFORMANCE`
- `COVENANT`
- `LIQUIDITY`
- `OVERALL`

## D7 — Board Monitoring Brief
Output table: `board_monitoring_briefs`
Sections:
- Executive summary
- Performance view
- Covenant view
- Liquidity view
- Risk reclassification view
- Recommended actions

## APIs
- `POST /api/ai/portfolio/ingest`
- `GET /api/ai/portfolio/investments`
- `GET /api/ai/portfolio/investments/{investment_id}`
- `GET /api/ai/portfolio/alerts`

All response contracts include `asOf` envelope semantics.
