# Dashboard Overview — Operational Checklist by Owner

Source of truth: `OVERVIEW_DASHBOARD_EXECUTION_HANDOFF.md` (frozen baseline).

## Scope Rules (Absolute)

- No fictitious components.
- No third-party chart library.
- No client-side economic inference.
- No illustrative empty states.
- No visual hierarchy reinterpretation.
- No structural deviation.

---

## Backend Owner Checklist

### Contract Lock and Versioning

- [ ] Lock and version all block contracts exactly as defined in frozen handoff.
- [ ] Include mandatory `asOf` in all block payloads.
- [ ] Include optional `dataLatency` and `dataQuality` for all blocks.
- [ ] For Operational tables, include:
  - [ ] `defaultSortField`
  - [ ] `defaultSortDirection`
  - [ ] `isBackendSorted: true`

### Critical Ordering (Server-side)

- [ ] `Overview.Analytical.PipelineByStage` critical ordering from backend.
- [ ] `Overview.Table.ExecutionQueue` pre-ordered by backend for SLA/priority intent.
- [ ] `Overview.Table.CashExceptions` critical rows first from backend.
- [ ] `Overview.Monitoring.CriticalAlerts` ordered by severity from backend.

### Governance Metadata Compliance

- [ ] Contract-level threshold semantics for `dataLatency` documented.
- [ ] `dataQuality` domain values documented (`OK` plus non-OK states).

---

## Design / Figma MCP Owner Checklist

### Frozen Frame Creation

- [ ] Create frame: `Overview.Command.Header`
- [ ] Create frame: `Overview.Command.FilterBar`
- [ ] Create frame: `Component.KpiStrip / layout=4col|6col`
- [ ] Create frame: `Overview.Analytical.NavEvolution`
- [ ] Create frame: `Overview.Analytical.PipelineByStage`
- [ ] Create frame: `Overview.Analytical.RiskConcentration`
- [ ] Create frame: `Overview.Table.ExecutionQueue`
- [ ] Create frame: `Overview.Table.ComplianceObligations`
- [ ] Create frame: `Overview.Table.CashExceptions`
- [ ] Create frame: `Overview.Monitoring.CriticalAlerts`
- [ ] Create frame: `Overview.Monitoring.GovernanceHealth`

### Token and Variant Application

- [ ] Apply tokens explicitly per frame:
  - [ ] `typography.token.name`
  - [ ] `spacing.token.name`
  - [ ] `elevation.token.name`
- [ ] Apply variants exactly:
  - [ ] `Component.AnalyticalCard / size=compact|extended`
  - [ ] `Component.TableCard / density=dense|standard`
  - [ ] `Component.KpiStrip / layout=4col|6col`
  - [ ] `Component.ListCard / mode=grouped|flat`

### Layout Policy

- [ ] Desktop: 12 columns, gutter `spacing.md`, lateral margin `spacing.lg`.
- [ ] Mobile: single vertical stack.
- [ ] Preserve visual hierarchy 1 > 2 > 3 > 4.

---

## Frontend Owner Checklist (UI Assembly)

### SAP UI5 Horizon Assembly

- [ ] Use only specified UI5 components per block.
- [ ] Do not introduce non-UI5 substitutions.
- [ ] Do not introduce chart third-party dependencies.
- [ ] Keep microchart as internal container only in `Overview.Analytical.NavEvolution`.

### Binding and Rendering Rules

- [ ] Bind strictly to backend payload fields.
- [ ] Do not recalculate economic metrics client-side.
- [ ] For `Overview.Analytical.RiskConcentration`, render backend `breachFlag` only.
- [ ] Keep header structural elements always rendered.
- [ ] No illustrative empty states.

### Responsive Column Priority Enforcement

- [ ] `ExecutionQueue` priorities implemented exactly (P1/P2/P3).
- [ ] `ComplianceObligations` priorities implemented exactly (P1/P2/P3).
- [ ] `CashExceptions` priorities implemented exactly (P1/P2/P3).

---

## QA / Governance Owner Checklist

### Gate Validation (Mandatory Before Merge)

- [x] Gate 1: Contracts locked and versioned.
- [x] Gate 2: Design ready (non-blocking for assembly).
- [x] Gate 3: Responsive column priorities configured exactly.
- [x] Gate 4: Governance rendering rule validated for all blocks. **(CLOSED)**
- [x] Gate 5: **CLOSED**.

### Governance Rendering Rule Validation

- [x] Every block accepts `asOf`.
- [x] Every block accepts optional `dataLatency` and `dataQuality`.
- [x] If `dataLatency > threshold` OR `dataQuality != "OK"`, top `ui5-message-strip` is rendered.
- [x] No masking of inconsistencies.
- [x] No silent fallback behavior.

---

## Gate 4 — Governance QA Validation

Status: **CLOSED (PASS)**

- [x] Gate 4 QA executed against frozen baseline and governance charter.
- [x] Report generated: `DASHBOARD_GOVERNANCE_QA_REPORT.md`.
- [x] Gate 4 close criteria satisfied (all PASS, zero FAIL).

Remediation closure summary:

- [x] A1 `Overview.Command.Header` implemented as frozen contract frame.
- [x] Client-side recalculation removed from economic fields (`deltaAbs`, `deltaPct`, `totalsLabel`).
- [x] `breachFlag` set to render-only behavior.
- [x] Formal declaration recorded: **Zero economic derivation client-side.**
- [x] QA sign-off recorded in `DASHBOARD_GOVERNANCE_QA_REPORT.md`.

---

## Gate 1 — Contract Compliance (Started)

Status: **CLOSED**

Immediate execution checklist:

- [x] Freeze source of truth to `OVERVIEW_DASHBOARD_EXECUTION_HANDOFF.md`.
- [x] Confirm endpoint inventory baseline in `ENDPOINT_COVERAGE.md`.
- [x] Produce contract version manifest for all 11 dashboard frames.
- [x] Validate presence of `asOf` in all frame contracts.
- [x] Validate optional `dataLatency` and `dataQuality` coverage.
- [x] Validate backend sort metadata for all Operational tables.
- [x] Submit Gate 1 compliance report for sign-off.

---

## Gate 2 — Execution Kickoff (Started in Parallel)

Status: **DESIGN READY (NON-BLOCKING)**

- [x] Gate 1 marked closed in `GATE1_CONTRACT_COMPLIANCE_MANIFEST.md`.
- [x] Validate visual reference nodes for Command, Analytical, Operational and Monitoring layers.
- [x] Design references validated as sufficient for Gate 2 (no automatic MCP frame creation required).
- [x] Apply explicit token mapping in code implementation.
- [x] Apply required component variants in code implementation.
- [x] Start frontend UI assembly against locked contracts and SAP UI5 Horizon stack.

Execution note:

- Gate 2 operational control file: `GATE2_FIGMA_EXECUTION_MANIFEST.md`.
- Figma context validated (Overview and Analytical source nodes captured).
- Next execution item: continue UI assembly coverage for remaining frozen sections and finish hierarchy/column-priority audit.
- Figma capture flow intentionally stopped by governance directive; implementation proceeds directly from frozen baseline.

---

## Gate 3 — Responsive + Governance Checkpoint

Status: **READY TO CLOSE**

- [x] Monitoring layer implemented (`Overview.Monitoring.CriticalAlerts`, `Overview.Monitoring.GovernanceHealth`).
- [x] Governance rendering rule forced checkpoint applied for all dashboard blocks (`dataLatency > threshold`, `dataQuality != "OK"`).
- [x] Message-strip top placement enforced at block level for Command, KPI, Analytical, Operational and Monitoring sections.
- [x] Responsive P1 priority audit completed:
  - [x] ExecutionQueue P1 (`Deal`, `SLA Due`, `Priority`) never collapses.
  - [x] ComplianceObligations P1 (`Obligation`, `Evidence Status`, `Due Date`) never collapses.
  - [x] CashExceptions P1 (`Tx ID`, `Amount`, `Match Status`, `Aging Bucket`) never collapses.
- [x] Build validation passed (`npm run build`).

---

## Gate 5 — Final Institutional Lock + Release Tag

Status: **CLOSED**

- [x] Final lock checklist delivered: `DASHBOARD_FINAL_LOCK_CHECKLIST.md`.
- [x] Release tag memo delivered: `DASHBOARD_RELEASE_TAG_MEMO.md`.
- [x] Gate 5 status updated in operational checklist.
- [x] Scope discipline preserved: no product code changes required by Gate 5 artifacts.
