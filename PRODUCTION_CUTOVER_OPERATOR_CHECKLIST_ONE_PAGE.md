# Production Cutover Operator Checklist — One-Page (Transcript-Identical)

## Control Boundary
- [ ] Approval-gate document only.
- [ ] Do not execute before governance sign-off + maintenance window attestation.
- [ ] Must remain identical to `PRODUCTION_CUTOVER_RUNBOOK_FOR_APPROVAL.md` transcript.

## A) Go / No-Go Hard Gates
- [ ] Governance sign-off received (documented)
- [ ] Maintenance window active
- [ ] Write-freeze attested (`prod_write_freeze_attestation.log`)
- [ ] PITR/backup rollback window attested (`prod_pitr_window_attestation.log`)
- [ ] Preflight approval attested (`prod_preflight_approval_attestation.log`)
- [ ] Repo head single at `70a79686336c`
- [ ] Same migration commit/tag as clone PASS
- [ ] Abort if any unchecked.

## B) Session Setup
- [ ] Working directory set to `backend`
- [ ] `DATABASE_URL` set to `netzprod` with `sslmode=require`
- [ ] `PG_DSN` set to `netzprod` with `sslmode=require`

```powershell
Set-Location "d:\Projetos\Netz Private Credit OS\backend"
$env:DATABASE_URL='postgresql+psycopg://netzadmin:<PASSWORD>@netz-prod-postgres.postgres.database.azure.com:5432/netzprod?sslmode=require'
$env:PG_DSN='postgresql://netzadmin:<PASSWORD>@netz-prod-postgres.postgres.database.azure.com:5432/netzprod?sslmode=require'
```

## C) Phase P0 — Preflight Read-only
- [ ] `python -m alembic heads` -> `..\tmp\prod_heads_preflight.log`
- [ ] `python -m alembic history --verbose` -> `..\tmp\prod_history_preflight.log`
- [ ] `python ..\tmp\forensic_0019_structural_validation.py` -> `..\tmp\prod_anchor_structural_parity_0019.log`
- [ ] `python ..\tmp\forensic_monthly_report_packs_fks.py` -> `..\tmp\prod_monthly_report_packs_fks.log`
- [ ] Structural parity accepted (FK naming-equivalent allowed only if definition matches)
- [ ] Abort on any unapproved deviation.

## D) Phase P1 — Lineage Width Alignment
- [ ] `python ..\tmp\clone_alembic_width_precheck.py` -> `..\tmp\prod_alembic_width_precheck.log`
- [ ] `python ..\tmp\clone_alembic_width_correction.py` -> `..\tmp\prod_alembic_width_correction.log`
- [ ] Post-check confirms `alembic_version.version_num` length = 64
- [ ] Abort if width is not 64.

## E) Phase P2 — Stamp at Approved Anchor
- [ ] `python -m alembic stamp 0019_nav_snapshots_and_investor_statements` -> `..\tmp\prod_stamp_anchor.log`
- [ ] `python -m alembic current` -> `..\tmp\prod_current_post_stamp.log`
- [ ] `current == 0019_nav_snapshots_and_investor_statements`
- [ ] Abort on stamp error or mismatch.

## F) Phase P3 — Upgrade to Head
- [ ] `python -m alembic upgrade head` -> `..\tmp\prod_upgrade_0019_to_head.log`
- [ ] Upgrade path includes: `0020`, `0021`, `0022`, `0023`, `0009b`, `70a79686336c`
- [ ] Abort immediately on any of:
  - [ ] `DuplicateTable`
  - [ ] `MissingColumn`
  - [ ] Enum/type redefinition conflict
  - [ ] Lock timeout/deadlock
  - [ ] Unexpected backfill conflict

## G) Phase P4 — Post-upgrade Verification
- [ ] `python -m alembic current` -> `..\tmp\prod_post_upgrade_current.log`
- [ ] `python -m alembic heads` -> `..\tmp\prod_post_upgrade_heads.log`
- [ ] `python ..\tmp\clone_ai4_object_parity_rerun.py` -> `..\tmp\prod_ai4_object_parity.log`
- [ ] `current == 70a79686336c`
- [ ] Single-head remains at `70a79686336c`
- [ ] AI-4 objects all present:
  - [ ] `active_investments`
  - [ ] `performance_drift_flags`
  - [ ] `covenant_status_register`
  - [ ] `cash_impact_flags`
  - [ ] `investment_risk_registry`
  - [ ] `board_monitoring_briefs`

## H) Halt-and-Contain Protocol
- [ ] Stop execution immediately
- [ ] Preserve all logs/artifacts generated so far
- [ ] Record blocker + root-cause classification
- [ ] Escalate to governance + DBA rollback/PITR decision
- [ ] Do not continue with additional migration commands

## I) Mandatory Evidence Pack
- [ ] `prod_preflight_approval_attestation.log`
- [ ] `prod_write_freeze_attestation.log`
- [ ] `prod_pitr_window_attestation.log`
- [ ] `prod_heads_preflight.log`
- [ ] `prod_history_preflight.log`
- [ ] `prod_anchor_structural_parity_0019.log`
- [ ] `prod_monthly_report_packs_fks.log`
- [ ] `prod_alembic_width_precheck.log`
- [ ] `prod_alembic_width_correction.log`
- [ ] `prod_stamp_anchor.log`
- [ ] `prod_current_post_stamp.log`
- [ ] `prod_upgrade_0019_to_head.log`
- [ ] `prod_post_upgrade_current.log`
- [ ] `prod_post_upgrade_heads.log`
- [ ] `prod_ai4_object_parity.log`

## J) Final Decision Record
- [ ] Status: PASS / BLOCKER
- [ ] Final Revision:
- [ ] Heads State:
- [ ] Errors:
- [ ] Drift detected:
- [ ] Root-cause classification:
- [ ] Updated risk tier:
- [ ] Production cutover authorization outcome:
