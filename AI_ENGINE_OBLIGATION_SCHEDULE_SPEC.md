# AI Engine Obligation Schedule Spec (Wave AI-1)

## Objective
Generate institutional obligation schedule from Data Room legal/regulatory sources and persist to governed register for compliance calendar downstream.

## Input Sources
- Offering Documents
- Admin Agreement / Fund Administrator records
- Legal Counsel engagement records
- Custodian / Bank agreements
- CIMA regulatory references

## Extraction Rules (Current Wave AI-1)
1. Select documents classified as `LEGAL_BINDING` or `REGULATORY_CIMA`.
2. Parse document text/chunks for obligation language:
   - `shall`, `must`, `required`, `deliver`, `submit`, `file`, `notify`, `maintain`, `comply`.
3. For each matched statement generate deterministic `obligationId`.
4. Derive fields:
   - `source`: CIMA/Admin/Custodian/Offering
   - `frequency`: Annual/Quarterly/Ongoing
   - `dueRule`: explicit textual rule (e.g., `within 6 months after FY end`)
   - `responsibleParty`
   - `evidenceExpected`
   - `status`: defaults to `MissingEvidence` until evidence process marks satisfied

## Persistence
Table: `obligation_register`

Mandatory columns used:
- `obligation_id`
- `source`
- `obligation_text`
- `frequency`
- `due_rule`
- `responsible_party`
- `evidence_expected`
- `status`
- `as_of`
- `data_latency` (optional)
- `data_quality` (optional)

## Monitoring Integration
Daily monitoring evaluates register for:
- Missing evidence alerts
- Overdue deliverables (when due date is explicit)
- Approaching due alerts (<=30 days when explicit)

## Compliance Calendar Readiness
`obligation_register` is the canonical backend source for Wave AI-2 calendar wiring.
No client-side derivation is required or allowed.
