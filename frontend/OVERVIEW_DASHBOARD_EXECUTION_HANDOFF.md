# Dashboard Overview — Final Frozen Execution Handoff

## Scope Lock

- Architecture frozen.
- No structural change allowed.
- SAP UI5 Web Components (Horizon) only.
- Backend-driven UI only.
- No client-side economic inference.
- No third-party chart library.
- No fictitious components.

## Visual Hierarchy (Mandatory)

1. Command Layer (priority 1)
2. Analytical Layer (priority 2)
3. Operational Layer (priority 3)
4. Monitoring Layer (priority 4)

## Global Layout (Mandatory)

- Desktop: 12 columns
- Gutter: `spacing.md`
- Lateral margin: `spacing.lg`
- Mobile: single vertical stack

---

## Phase A — Data Contract Lock (Backend/UI Contract)

### A1. Overview.Command.Header

- UI5: `ui5-shellbar`, `ui5-button`, `ui5-avatar`
- Contract (minimum):
  - `fund`
  - `user`
  - `notificationsCount`
  - `globalActions[]`
  - `asOf` (mandatory)
  - `dataLatency?`
  - `dataQuality?`
- Rule:
  - Header always rendered.
  - If `dataLatency > threshold` or `dataQuality != "OK"`, render `ui5-message-strip` immediately below header.

### A2. Overview.Command.FilterBar

- UI5: `ui5-bar`, `ui5-select`, `ui5-multi-combobox`, `ui5-date-range-picker`, `ui5-input`, `ui5-segmented-button`, `ui5-button`, `ui5-tag`
- Contract:
  - `filters`
  - `savedView`
  - `activeFiltersCount`
  - `asOf`
- Rule:
  - No `ui5-filter-bar` abstraction.
  - Structural header always rendered.

### A3. Component.KpiStrip / layout=4col|6col

- UI5: `ui5-title`, `ui5-object-status`, `ui5-tag`, `ui5-link`
- Contract:
  - `kpis[{id,label,value,unit,delta,deltaState}]`
  - `asOf`
  - `dataLatency?`
  - `dataQuality?`
- Rule:
  - Lightweight one-line composition.
  - Delta always visible.
  - No heavy card per KPI.

### A4. Overview.Analytical.NavEvolution

- Variant: `Component.AnalyticalCard / size=extended`
- UI5: `ui5-card`, `ui5-card-header`, `ui5-object-status`, `ui5-busy-indicator`
- Contract:
  - `currentNav`
  - `prevNav`
  - `deltaAbs`
  - `deltaPct`
  - `series[]`
  - `asOf`
  - `dataLatency?`
  - `dataQuality?`
- Rule:
  - Microchart is internal container only.
  - SAP-approved artifact only.

### A5. Overview.Analytical.PipelineByStage

- Variant: `Component.AnalyticalCard / size=compact|extended`
- UI5: `ui5-card`, `ui5-card-header`, `ui5-table` (dense)
- Columns: `Stage | Count | Notional | Delta`
- Contract:
  - `stages[]`
  - `totals`
  - `asOf`
- Rule:
  - Critical ordering from backend.

### A6. Overview.Analytical.RiskConcentration

- Variant: `Component.AnalyticalCard / size=extended`
- UI5: `ui5-card`, `ui5-card-header`, `ui5-table`, `ui5-object-status`
- Columns: `Name | Exposure | %NAV | Limit | Status`
- Contract:
  - `rows[{name, exposure, pctNav, limit, breachFlag}]`
  - `asOf`
- Rule:
  - Frontend never recalculates limits.
  - Render backend `breachFlag` only.

### A7. Overview.Table.ExecutionQueue

- Variant: `Component.TableCard / density=dense`
- UI5: `ui5-card`, `ui5-card-header`, `ui5-table`, `ui5-button`
- Columns: `Deal | Stage | Owner | SLA Due | Status | Priority`
- Contract:
  - `rows[]`
  - `totals`
  - `asOf`
- Required table metadata:
  - `defaultSortField`
  - `defaultSortDirection`
  - `isBackendSorted: true`

### A8. Overview.Table.ComplianceObligations

- Variant: `Component.TableCard / density=dense`
- UI5: `ui5-card`, `ui5-card-header`, `ui5-table`
- Columns: `Obligation | Type | Due Date | Workflow Status | Evidence Status | Owner`
- Contract:
  - `rows[]`
  - `totals`
  - `asOf`
- Required table metadata:
  - `defaultSortField`
  - `defaultSortDirection`
  - `isBackendSorted: true`
- Rule:
  - `Evidence Status` not hideable.

### A9. Overview.Table.CashExceptions

- Variant: `Component.TableCard / density=dense`
- UI5: `ui5-card`, `ui5-card-header`, `ui5-table`
- Columns: `Tx ID | Date | Amount | Counterparty | Match Status | Aging Bucket`
- Contract:
  - `rows[]`
  - `totals`
  - `asOf`
- Required table metadata:
  - `defaultSortField`
  - `defaultSortDirection`
  - `isBackendSorted: true`
- Rule:
  - Critical rows come first from backend.

### A10. Overview.Monitoring.CriticalAlerts

- Variant: `Component.ListCard / mode=grouped|flat`
- UI5: `ui5-card`, `ui5-card-header`, `ui5-list`, `ui5-li-custom`, `ui5-object-status`
- Contract:
  - `alerts[]`
  - `asOf`
- Rule:
  - Ordered by severity.

### A11. Overview.Monitoring.GovernanceHealth

- UI5: `ui5-panel`, `ui5-title`, `ui5-message-strip`, `ui5-list`
- Contract:
  - `controls[]`
  - `exceptions[]`
  - `asOf`
- Rule:
  - Lowest visual weight on page.

---

## Phase B — Figma MCP Node Execution (Frozen Naming)

Create and lock these frames:

- `Overview.Command.Header`
- `Overview.Command.FilterBar`
- `Component.KpiStrip / layout=4col|6col`
- `Overview.Analytical.NavEvolution`
- `Overview.Analytical.PipelineByStage`
- `Overview.Analytical.RiskConcentration`
- `Overview.Table.ExecutionQueue`
- `Overview.Table.ComplianceObligations`
- `Overview.Table.CashExceptions`
- `Overview.Monitoring.CriticalAlerts`
- `Overview.Monitoring.GovernanceHealth`

For every frame:

- Enforce layout and hierarchy exactly as frozen.
- Attach tokens explicitly:
  - `typography.token.name`
  - `spacing.token.name`
  - `elevation.token.name`

---

## Phase C — Responsive Column Priority Lock (Mandatory)

If not defined exactly below, delivery is blocked.

### ExecutionQueue

- P1: `Deal`, `SLA Due`, `Priority`
- P2: `Stage`, `Status`
- P3: `Owner`

### ComplianceObligations

- P1: `Obligation`, `Evidence Status`, `Due Date`
- P2: `Workflow Status`, `Type`
- P3: `Owner`

### CashExceptions

- P1: `Tx ID`, `Amount`, `Match Status`, `Aging Bucket`
- P2: `Date`, `Counterparty`
- P3: `none`

---

## Phase D — Token Lock (Mandatory)

### Typography

- `heading-l`
- `heading-m`
- `kpi-xl`
- `table-header`
- `table-body`
- `meta-text`

### Spacing

- `xs`
- `sm`
- `md`
- `lg`
- `xl`

### Elevation

- `card-base`
- `card-hover`

### State

- `success`
- `warning`
- `critical`
- `neutral`

---

## Global Governance Rendering Rule (All Blocks)

Every block must accept:

- `asOf` (mandatory)
- `dataLatency?` (optional)
- `dataQuality?` (optional)

If `dataLatency > threshold` OR `dataQuality != "OK"`:

- Render `ui5-message-strip` at block top.
- Do not hide or mask inconsistency.
- No silent fallback.

---

## Absolute Restrictions

- No non-UI5 substitution.
- No fictitious component.
- No third-party chart library.
- No client-side recalculation of economic metrics.
- No illustrative empty states.
- No visual layer equalization.
- No structural reinterpretation.

---

## Delivery Gates (Must Pass)

- Gate 1: All contracts locked and versioned.
- Gate 2: All Figma frames created with frozen names.
- Gate 3: Responsive column priorities configured exactly.
- Gate 4: Governance rendering rule validated in all blocks.
- Gate 5: Visual hierarchy verified (1 > 2 > 3 > 4).

Only after Gate 1–5, proceed to UI assembly according to the locked SAP UI5 Horizon stack.