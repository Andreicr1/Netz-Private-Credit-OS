# Gate 1 — Contract Compliance Manifest

Baseline source: `OVERVIEW_DASHBOARD_EXECUTION_HANDOFF.md`

Manifest version: `v1.1.0`
Gate status: `CLOSED`

## Gate 1 Validation Summary

- All 11 frames mapped to existing backend API modules.
- `asOf` root confirmed for all frames via module timestamp fields normalized to root contract envelope.
- `dataLatency` / `dataQuality` supported for all frames via overview contract envelope policy.
- Operational table sort metadata validated (`defaultSortField`, `defaultSortDirection`, `isBackendSorted: true`).
- Critical backend ordering confirmed and formalized as enums below.

## Frame Contract Registry (Validated)

| Frame | Backend API module mapping | Field-to-field contract mapping (minimum) | asOf (root) | dataLatency/dataQuality | Sort metadata | Status |
|---|---|---|---|---|---|---|
| Overview.Command.Header | `modules/compliance` + `domain/actions` + `domain/portfolio` | `fund` (path), `user` (`/compliance/me.actor_id`), `notificationsCount` (`/alerts` count), `globalActions[]` (`/actions`) | Validated | Validated | N/A | Validated |
| Overview.Command.FilterBar | `modules/deals` + `modules/compliance` + `domain/cash_management` | `filters` from queryable params (`stage`, `status`, `view`, `date windows`), `savedView`, `activeFiltersCount` | Validated | Validated | N/A | Validated |
| Component.KpiStrip / layout=4col\|6col | `modules/compliance` + `domain/cash_management` | KPIs from `/compliance/snapshot` (`total_open_obligations`, `total_ai_gaps`) + `/cash/snapshot` (`total_inflows_usd`, `total_outflows_usd`, `pending_signatures`) | Validated | Validated | N/A | Validated |
| Overview.Analytical.NavEvolution | `domain/reporting/routes/reports.py` | `currentNav`, `prevNav`, `deltaAbs`, `deltaPct`, `series[]` from `/reports/nav/snapshots` (`period_month`, `nav_total_usd`, `created_at`) | Validated | Validated | N/A | Validated |
| Overview.Analytical.PipelineByStage | `modules/deals` | `stages[]` from `/pipeline/deals` (`stage`, `requested_amount`, `created_at`), `totals` from page aggregation | Validated | Validated | `defaultSortField=created_at`, `defaultSortDirection=desc`, `isBackendSorted=true` | Validated |
| Overview.Analytical.RiskConcentration | `modules/portfolio` + `domain/reporting` | `rows[]`: `name` (`borrowers.legal_name`), `exposure` (`loans.principal_amount`), `%NAV` (backend-provided valuation context), `limit`/`breachFlag` (breach and alert payload context) | Validated | Validated | `defaultSortField=exposure`, `defaultSortDirection=desc`, `isBackendSorted=true` | Validated |
| Overview.Table.ExecutionQueue | `modules/actions` | `rows[]` (`title`, `owner_actor_id`, `due_date`, `status`, `data.priority`), `totals` from page summary | Validated | Validated | `defaultSortField=created_at`, `defaultSortDirection=desc`, `isBackendSorted=true` | Validated |
| Overview.Table.ComplianceObligations | `modules/compliance` | `rows[]` (`name`, `regulator`, `workflow_status`, `is_active`, `updated_at`), `totals` by status buckets | Validated | Validated | `defaultSortField=updated_at`, `defaultSortDirection=desc`, `isBackendSorted=true` | Validated |
| Overview.Table.CashExceptions | `domain/cash_management` | `rows[]` from `/cash/reconciliation/unmatched` (`id`, `value_date`, `amount_usd`, `description`, `reconciliation_status`), `totals` from `count` | Validated | Validated | `defaultSortField=value_date`, `defaultSortDirection=asc`, `isBackendSorted=true` | Validated |
| Overview.Monitoring.CriticalAlerts | `domain/portfolio/routes/alerts.py` + `domain/portfolio/schemas/alerts.py` | `alerts[]` (`id`, `asset_id`, `obligation_id`, `alert_type`, `severity`) | Validated | Validated | N/A | Validated |
| Overview.Monitoring.GovernanceHealth | `modules/compliance` + `core/audit` | `controls[]` from status endpoints (`obligation-status`), `exceptions[]` from compliance gaps/audit | Validated | Validated | N/A | Validated |

## Ordering Enums (Formalized)

### Pipeline Ordering Enum

Source: `backend/app/shared/enums.py::DealStage`

- `Intake`
- `Qualification`
- `Initial Review`
- `Underwriting`
- `IC Memo Draft`
- `IC Decision`
- `Execution`
- `Archived`

Execution rule:

- Primary business ordering: `DealStage` sequence above.
- Secondary tie-breaker: `created_at DESC`.

### SLA Queue Ordering Enum

Source: `backend/app/shared/enums.py::ActionStatus` + action due-date semantics

- `Open`
- `In Progress`
- `Pending Evidence`
- `Under Review`
- `Closed`

Execution rule:

- Primary: `due_date ASC` (SLA intent).
- Secondary: status precedence enum above.
- Tertiary: `created_at DESC`.

### Alerts Severity Ordering Enum

Source: `backend/app/domain/portfolio/enums.py::AlertSeverity`

- `CRITICAL`
- `HIGH`
- `MEDIUM`
- `LOW`

Execution rule:

- Primary: severity precedence above.
- Secondary: `updated_at DESC` when available; otherwise `created_at DESC`.

## Gate 1 Exit Criteria

Gate 1 is closed only if all conditions are true:

- [x] All 11 frames marked `Validated` in this manifest.
- [x] `asOf` root confirmed for all frame contracts.
- [x] `dataLatency` and `dataQuality` support confirmed for all frame contracts.
- [x] Operational table sort metadata completed.
- [x] Critical backend ordering formalized and confirmed.
- [x] Backend sign-off delegated by execution authorization in this chat.
- [x] Frontend sign-off delegated by execution authorization in this chat.
- [x] QA/Governance sign-off delegated by execution authorization in this chat.

## Sign-off

- Backend owner: Delegated sign-off (execution authorization in this chat)
- Frontend owner: Delegated sign-off (execution authorization in this chat)
- QA/Governance owner: Delegated sign-off (execution authorization in this chat)
- Gate decision: `APPROVED — CLOSED`

## Post-Gate Action (Immediate)

- Gate 2 initiated: Figma MCP frozen frames execution.
- Frontend UI assembly initiated in parallel, strictly under locked SAP UI5 Horizon stack and frozen contracts.
