# Production Cutover Runbook (For Final Governance Approval)

## Status

- Prepared for approval only.
- No production execution is performed by this document.
- Basis: clone rehearsal PASS with full evidence.

## Objective

Execute a controlled production Alembic reconciliation and upgrade on `netzprod` using the validated clone transcript, with rollback controls and full artifact capture.

## Scope Boundary

- In scope: production runbook steps, gates, artifacts, and command transcript.
- Out of scope: automatic execution, implicit approvals, undocumented deviations.

## Mandatory Preconditions (Go/No-Go)

All must be true before first mutating command:

1. Approved maintenance window + write-freeze confirmed.
2. PITR/backup rollback window active and validated by DBA.
3. Single repo head still equals `70a79686336c`.
4. Same migration commit/tag used in clone PASS is checked out.
5. Operators and approvers assigned (Execution + Governance sign-off).

Required artifacts before execution:

- `prod_preflight_approval_attestation.log`
- `prod_write_freeze_attestation.log`
- `prod_pitr_window_attestation.log`

Abort gate:

- Any missing precondition => STOP.

---

## Environment

- Server: `netz-prod-postgres.postgres.database.azure.com`
- Database: `netzprod`
- User: `netzadmin`
- SSL: `require`
- Working directory: `backend`

Suggested session environment:

```powershell
Set-Location "d:\Projetos\Netz Private Credit OS\backend"
$env:DATABASE_URL='postgresql+psycopg://netzadmin:<PASSWORD>@netz-prod-postgres.postgres.database.azure.com:5432/netzprod?sslmode=require'
$env:PG_DSN='postgresql://netzadmin:<PASSWORD>@netz-prod-postgres.postgres.database.azure.com:5432/netzprod?sslmode=require'
```

---

## Phase P0 — Preflight Read-only Checks

Run and capture:

```powershell
python -m alembic heads *>&1 | Tee-Object -FilePath "..\tmp\prod_heads_preflight.log"
python -m alembic history --verbose *>&1 | Tee-Object -FilePath "..\tmp\prod_history_preflight.log"
```

Read-only structural checks (same scripts used in rehearsal evidence):

```powershell
python ..\tmp\forensic_0019_structural_validation.py *>&1 | Tee-Object -FilePath "..\tmp\prod_anchor_structural_parity_0019.log"
python ..\tmp\forensic_monthly_report_packs_fks.py *>&1 | Tee-Object -FilePath "..\tmp\prod_monthly_report_packs_fks.log"
```

Expected:

- Single head present at `70a79686336c`.
- 0019 structural parity remains acceptable (FK naming-equivalent allowed if definition matches).

Abort gate:

- Any structural deviation beyond approved exception => STOP.

---

## Phase P1 — Lineage Table Integrity Alignment (Forward, Controlled)

Purpose: enforce `alembic_version.version_num` capacity for descriptive revisions.

Execute controlled correction script:

```powershell
python ..\tmp\clone_alembic_width_precheck.py *>&1 | Tee-Object -FilePath "..\tmp\prod_alembic_width_precheck.log"
python ..\tmp\clone_alembic_width_correction.py *>&1 | Tee-Object -FilePath "..\tmp\prod_alembic_width_correction.log"
```

Expected:

- `alembic_version` exists post-step.
- `version_num_length == 64`.

Abort gate:

- Width not 64 or script failure => STOP.

---

## Phase P2 — Establish Alembic Lineage at Approved Anchor

```powershell
python -m alembic stamp 0019_nav_snapshots_and_investor_statements *>&1 | Tee-Object -FilePath "..\tmp\prod_stamp_anchor.log"
python -m alembic current *>&1 | Tee-Object -FilePath "..\tmp\prod_current_post_stamp.log"
```

Expected:

- Stamp succeeds.
- Current equals `0019_nav_snapshots_and_investor_statements`.

Abort gate:

- Stamp fails or current mismatch => STOP.

---

## Phase P3 — Forward Upgrade to Head

```powershell
python -m alembic upgrade head *>&1 | Tee-Object -FilePath "..\tmp\prod_upgrade_0019_to_head.log"
```

Expected path (as validated in clone):

- `0020_ai_engine_wave_ai1`
- `0021_ai_engine_wave_ai2`
- `0022_ai_engine_wave_ai3_pipeline_intelligence`
- `0023_ai_engine_wave_ai4_portfolio_intelligence`
- `0009b_expand_alembic_version`
- `70a79686336c` merge

Abort gates (any => STOP):

- DuplicateTable
- MissingColumn
- Enum/type redefinition conflict
- Lock timeout/deadlock
- Unexpected backfill conflict

---

## Phase P4 — Post-upgrade Verification (Read-only)

```powershell
python -m alembic current *>&1 | Tee-Object -FilePath "..\tmp\prod_post_upgrade_current.log"
python -m alembic heads *>&1 | Tee-Object -FilePath "..\tmp\prod_post_upgrade_heads.log"
python ..\tmp\clone_ai4_object_parity_rerun.py *>&1 | Tee-Object -FilePath "..\tmp\prod_ai4_object_parity.log"
```

PASS criteria:

1. `alembic current == 70a79686336c`
2. `alembic heads` single
3. AI-4 objects present:
   - `active_investments`
   - `performance_drift_flags`
   - `covenant_status_register`
   - `cash_impact_flags`
   - `investment_risk_registry`
   - `board_monitoring_briefs`
4. No unresolved migration errors in logs

---

## Rollback/Containment Protocol

If any phase abort gate triggers:

1. Stop immediately.
2. Record blocker classification.
3. Preserve all generated logs.
4. Do not continue with additional migration commands.
5. Trigger PITR/rollback decision path under DBA/governance control.

This runbook does not auto-trigger rollback; it preserves evidence and halts safely.

---

## Evidence Pack (Required for Final Decision)

- `prod_preflight_approval_attestation.log`
- `prod_write_freeze_attestation.log`
- `prod_pitr_window_attestation.log`
- `prod_heads_preflight.log`
- `prod_history_preflight.log`
- `prod_anchor_structural_parity_0019.log`
- `prod_monthly_report_packs_fks.log`
- `prod_alembic_width_precheck.log`
- `prod_alembic_width_correction.log`
- `prod_stamp_anchor.log`
- `prod_current_post_stamp.log`
- `prod_upgrade_0019_to_head.log`
- `prod_post_upgrade_current.log`
- `prod_post_upgrade_heads.log`
- `prod_ai4_object_parity.log`

---

## Formal Decision Template (Post-Run)

- Status: PASS | BLOCKER
- Target: netz-prod-postgres / netzprod
- Final Revision:
- Heads State:
- Errors:
- Drift detected:
- Root-cause classification:
- Risk tier (updated):
- Production cutover authorization: Approved | Rejected

---

## Governance Notes

- Forward-only migration discipline.
- No edit of historical migrations.
- No synthetic stamp to head.
- Any deviation from this transcript requires explicit re-approval.
