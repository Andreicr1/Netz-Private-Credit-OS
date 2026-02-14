# Institutional Column Review Report

## Scope
- Objective: institutional column enforcement and density correction only.
- Constraint: no new layout system, no non-SAP component introduction, no client-side governance inference.
- Modules reviewed: Portfolio, Deals Pipeline, Cash Management, Signatures, Admin/Audit.

## Results by Page

### Portfolio
- **Section:** Borrowers Table
- **Before:** reduced operational set (missing legal/governance fields).
- **After:** enforced 10-column institutional contract:
  1. Borrower Legal Name
  2. Country
  3. Sector
  4. Commitment
  5. Outstanding
  6. Utilization %
  7. Credit Rating
  8. Last Covenant Review Date
  9. Relationship Owner
  10. Status
- **Missing Columns Remaining:** No
- **Client-side Economic Derivation Removed:** Yes
- **Status:** PASS

- **Section:** Loans Table
- **Before:** reduced set; maturity semantics were not fully contract-aligned.
- **After:** enforced 11-column institutional contract:
  1. Facility ID
  2. Borrower
  3. Facility Type
  4. Principal Outstanding
  5. Margin
  6. Rate Type
  7. Next Reset Date
  8. Days to Maturity
  9. Collateral Type
  10. Internal Rating
  11. Status
- **Missing Columns Remaining:** No
- **Client-side Economic Derivation Removed:** Yes (days-to-maturity now backend-driven)
- **Status:** PASS

### Deals Pipeline
- **Section:** Execution Queue
- **Before:** incomplete execution-governance column set.
- **After:** enforced 10-column institutional contract:
  1. Deal Name
  2. Sponsor
  3. Strategy
  4. Stage
  5. Notional
  6. Expected IRR
  7. Owner
  8. SLA Due Date
  9. Priority
  10. Approval Status
- **Missing Columns Remaining:** No
- **Client-side Economic Derivation Removed:** Yes
- **Status:** PASS

### Cash Management
- **Section:** Transactions Table
- **Before:** reduced transaction evidence density.
- **After:** enforced 10-column institutional contract:
  1. Transaction ID
  2. Booking Date
  3. Value Date
  4. Counterparty
  5. Currency
  6. Amount
  7. Match Status
  8. Approval Status
  9. Aging Bucket
  10. Entered By
- **Missing Columns Remaining:** No
- **Client-side Economic Derivation Removed:** Yes
- **Status:** PASS

### Signatures
- **Section:** Pending Signatures Table
- **Before:** non-conforming signature grid schema.
- **After:** enforced 7-column institutional contract:
  1. Document Name
  2. Counterparty
  3. Signature Status
  4. Initiated Date
  5. Expiration Date
  6. Last Action By
  7. Owner
- **Missing Columns Remaining:** No
- **Client-side Economic Derivation Removed:** Yes
- **Status:** PASS

### Admin / Audit
- **Section:** Audit Log Table
- **Before:** non-forensic reduced schema (missing role/entity id/hash/ip).
- **After:** enforced 10-column forensic contract:
  1. Timestamp (UTC)
  2. Actor
  3. Role
  4. Action
  5. Entity Type
  6. Entity ID
  7. Before State Hash
  8. After State Hash
  9. Status
  10. IP Address
- **Missing Columns Remaining:** No
- **Client-side Economic Derivation Removed:** Yes
- **Status:** PASS

## Responsive Priority Enforcement
- Implemented across reviewed tables with P1/P2/P3 policy:
  - Wide viewport: P1 + P2 + P3 visible.
  - Medium viewport: P3 collapsed to Details popover.
  - Narrow viewport: P2 and P3 collapsed; P1 retained and non-optional.
- Governance-critical columns remain P1 and never fully hidden.

## Verification
- Build: `npm run build` (frontend) — PASS
- Governance strips (`asOf`, latency/quality warning behavior): retained.

## Final Gate
- Institutional Column Review: **PASS**
