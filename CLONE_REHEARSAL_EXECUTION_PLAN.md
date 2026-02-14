# Clone Rehearsal Execution Plan (Governed)

## Scope and Authorization Boundary

- Scope: rehearsal planning and execution design for clone only.
- Production execution: **not authorized** in this plan.
- Mutation policy: forward-only, no edit of historical migrations, no synthetic stamp to head.
- Provisional anchor: `0019_nav_snapshots_and_investor_statements`.
- Repo topology precondition: single head at `70a79686336c`.

## Objective

Prove that a provisioned hybrid database equivalent to revision `0019_nav_snapshots_and_investor_statements` can be brought under Alembic lineage and upgraded safely to head `70a79686336c` on a clone.

## Environment

- Source DB: `netzprod` on `netz-prod-postgres.postgres.database.azure.com`
- Clone DB (target rehearsal): `netzprod_clone_rehearsal`
- Alembic working dir: `backend`
- Runtime: Python + Alembic + psycopg, `sslmode=require`

---

## Hard Gates (Preconditions)

Rehearsal may only proceed if all are true:

1. `alembic heads` returns only `70a79686336c`.
2. Clone is exact copy of `netzprod` at T0.
3. Clone is isolated from app writes during rehearsal window.
4. Backup/PITR for clone environment is available.

Required artifact:

- `clone_provisioning_attestation.log`

Abort rule:

- Any failed precondition => **STOP**.

---

## Phase 0 — Clone Provisioning (DBA)

### Actions

1. Create clone database: `netzprod_clone_rehearsal`.
2. Capture row-count parity for baseline tables:
   - `funds`
   - `users`
   - `nav_snapshots`
   - `monthly_report_packs`

### Evidence

- `clone_rowcount_parity.log`

### Abort Gate

- Any mismatch > 0.1% without documented explanation => **STOP**.

---

## Phase 1 — Read-only Validation on Clone (Pre-stamp)

### Actions

Run on clone:

```bash
python -m alembic heads
python -m alembic history --verbose
```

Validate:

- single head only
- no unexpected new heads
- anchor structural parity for `0019`:
  - tables
  - columns (type + nullability)
  - defaults
  - constraints/FKs
  - indexes
  - enum definitions
  - sequence ownership (Postgres)

### Evidence

- `clone_anchor_structural_parity_0019.log`

### Abort Gate

- Any structural deviation from approved netzprod evidence pack => **STOP**.

---

## Phase 2 — Establish Alembic Lineage (Controlled Stamp)

### Actions

Set clone `DATABASE_URL`, then:

```bash
python -m alembic stamp 0019_nav_snapshots_and_investor_statements
python -m alembic current
```

Expected:

- no schema DDL changes
- lineage state written
- `current == 0019_nav_snapshots_and_investor_statements`

### Evidence

- `clone_stamp_anchor.log`
- `clone_current_post_stamp.log`

### Abort Gate

- stamp error or current mismatch => **STOP**.

---

## Phase 3 — Forward Upgrade to Head (Critical Rehearsal)

### Actions

```bash
python -m alembic upgrade head
```

Expected:

- applies `0020` → `0023` + merge head
- materializes missing AI objects
- executes sensitive backfills in `0021` and `0022` without conflict

### Evidence

- `clone_upgrade_0019_to_head.log`

### Abort Gates

Any one => **STOP**:

- `DuplicateTable`
- `MissingColumn`
- enum/type redefinition conflict
- backfill `UPDATE` affects unexpected row volume
- lock timeout / deadlock

---

## Phase 4 — Post-upgrade Structural Verification

### Actions

```bash
python -m alembic current
python -m alembic heads
```

Validate:

- `current == 70a79686336c`
- heads remains single

Validate AI-4 object parity:

- `active_investments`
- `performance_drift_flags`
- `covenant_status_register`
- `cash_impact_flags`
- `investment_risk_registry`
- `board_monitoring_briefs`

### Evidence

- `clone_post_upgrade_current.log`
- `clone_ai4_object_parity.log`

### Abort Gate

- any missing AI-4 object => **FAIL**.

---

## Phase 5 — Runtime Smoke Validation (Optional Recommended)

### Actions

- Minimal insert/select on AI tables
- FK integrity checks
- Verify no partial migration state

### Evidence

- `clone_runtime_smoke_validation.log`

---

## PASS / FAIL Criteria

PASS only if all are true:

1. Stamp at `0019` succeeds.
2. `upgrade head` completes without exception.
3. AI-4 objects are present and structurally valid.
4. `alembic current == 70a79686336c`.
5. `alembic heads` single.
6. No unresolved structural drift remains.

Else: **BLOCKER** with exact failure evidence and root-cause classification.

---

## Root-Cause Classification Taxonomy (for Memo)

- connection
- authentication
- SSL
- SQL drift
- multiple heads conflict
- dependency ordering
- structural parity mismatch

---

## Production Authorization Boundary (Post-Rehearsal)

Even if clone PASS:

- production cutover requires separate approval
- must include PITR rollback window
- must include freeze window
- must include exact command transcript replay approved pre-run

No production commands are included in this document.
