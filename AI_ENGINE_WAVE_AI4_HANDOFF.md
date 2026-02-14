# AI Engine Wave AI-4 Handoff

## Scope
Wave AI-4 implemented as backend-only Active Portfolio Intelligence Engine.

## Delivered Capabilities (D1→D7)
1. **Active Investment Discovery (D1)**
   - Discovers active investments from `portfolio-active-investments/<Investment>/...`.
   - Persists in `active_investments` with transition logs and `asOf` envelope fields.
2. **Portfolio Metrics Extraction (D2)**
   - Generates deterministic daily investment metrics snapshots.
   - Persists in existing `portfolio_metrics` table using `AI4_*` metric namespace.
3. **Performance Drift Detection (D3)**
   - Compares latest vs previous snapshot and flags threshold breaches.
   - Persists in `performance_drift_flags`.
4. **Covenant Surveillance (D4)**
   - Builds investment-level covenant status from covenant tests/breaches.
   - Persists in `covenant_status_register`.
5. **Liquidity/Cash Impact Analysis (D5)**
   - Detects investment-linked cash impact events from cash transactions.
   - Persists in `cash_impact_flags`.
6. **Risk Reclassification (D6)**
   - Reclassifies risk dimensions (performance/covenant/liquidity/overall).
   - Persists in `investment_risk_registry`.
7. **Board Monitoring Briefs (D7)**
   - Builds structured board monitoring briefs per investment.
   - Persists in `board_monitoring_briefs`.

## Endpoints
- `POST /api/ai/portfolio/ingest`
- `GET /api/ai/portfolio/investments`
- `GET /api/ai/portfolio/investments/{investment_id}`
- `GET /api/ai/portfolio/alerts`

## Persistence and Migration
- Migration: `backend/app/core/db/migrations/versions/0023_ai_engine_wave_ai4_portfolio_intelligence.py`
- Added tables:
  - `active_investments`
  - `performance_drift_flags`
  - `covenant_status_register`
  - `cash_impact_flags`
  - `investment_risk_registry`
  - `board_monitoring_briefs`
- Reused table:
  - `portfolio_metrics` (existing canonical table, with `AI4_*` metric namespace)

## Daily Monitoring and Replay
- AI-4 ingestion accepts optional `as_of` and persists `asOf` snapshots to support deterministic daily replay.
- Risk transitions are persisted via `active_investments.transition_log`.

## Verification Artifact
- Smoke script: `tmp/ai_engine_wave_ai4_smoke_test.py`
- Report: `AI_ENGINE_SMOKE_REPORT_AI4.md`
