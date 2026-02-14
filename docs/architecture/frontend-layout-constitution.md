# NETZ PRIVATE CREDIT OS — FRONTEND LAYOUT CONSTITUTION
Version: 2.0  
Status: Institutional UX Standard  
Scope: Control Plane (Internal OS)  
Applies to: All current and future frontend modules  

---

## 1. PURPOSE

This document defines the mandatory layout architecture, semantic standards, and interaction model for the Netz Private Credit OS frontend.

The frontend must reflect an institutional-grade financial product comparable to SAP S/4HANA enterprise applications.

The UI must:

- Preserve structural clarity
- Avoid backend exposure
- Enforce semantic discipline
- Support deep entity navigation without dashboards or boards

---

## 2. APPROVED LAYOUT ARCHETYPES

Only two layout archetypes are permitted in the platform.

No hybrid patterns are allowed.

---

# A. FLEXIBLE COLUMN LAYOUT (FCL — 3 COLUMN STANDARD)

## 2.1 Mandatory 3-Column Structure

All entity-navigation modules MUST use full 3-column Flexible Column Layout.

Structure:

Begin Column → Entity List  
Mid Column → Object Page  
End Column → Contextual Sub-Detail  

Two-column mode is transitional only.  
The architecture must support full 3-column expansion.

---

## 2.2 Column Responsibilities

### Begin Column (Navigation Layer)

Purpose:
- Entity discovery
- Filtering
- High-level scanning

Must contain:
- Clean institutional list
- Minimal fields
- Badge indicators

Must NOT contain:
- Nested analytics
- Monitoring layers
- Operational controls

---

### Mid Column (Object Page)

Purpose:
- Primary entity context
- Structured object representation

Must include:
- Institutional header
- Key attributes
- Tabbed structure

Mid column represents the canonical entity state.

It must feel like SAP Object Page.

---

### End Column (Contextual Drill-Down)

Purpose:
- Nested entity details
- Sub-object inspection
- Document viewers
- Covenant breakdown
- Timeline inspection
- Deep analytical context

The third column replaces modal-heavy UI patterns.

Modal-driven navigation is discouraged.

All deep navigation should occur within FCL hierarchy.

---

## 2.3 Modules Using FCL (3 Column)

- Portfolio
- Deals
- Signatures

Future entity modules must follow the same pattern.

---

## 3. MULTI-INSTANCE 4-LAYER LAYOUT

Used for operational governance modules only.

Structure (fixed order):

1. Command  
2. Analytical  
3. Operational  
4. Monitoring  

No mixing or collapsing of layers into dashboards.

---

## 4. MODULE-SPECIFIC ARCHITECTURAL RULES

---

# 4.1 Portfolio (FCL — 3 Column)

### Begin Column
Navigation objects:

- Borrowers
- Facilities

Each row must show only:

- Borrower Name
- Exposure
- Risk Band
- Covenant Status (badge)

Forbidden:
- Internal IDs
- P1 / P2 / P3
- Backend terminology
- Repeated "No Data"

---

### Mid Column
Header must contain:

- Borrower Name
- Internal Rating
- Exposure
- Risk Status
- Last Review Date

Tabs required:

- Overview
- Facilities
- Covenants
- Documents

---

### End Column
Examples of valid drill-down:

- Facility breakdown
- Individual covenant detail
- Exposure decomposition
- Document viewer
- Review history

---

### Multi-Asset Rule (Critical)

Portfolio must not assume Direct Loans only.

Investment categories must be database-driven.

Frontend must support:

- Dynamic investment types
- Immediate navigation rendering
- Unlimited extensibility

Hardcoded asset assumptions are forbidden.

---

# 4.2 Deals (FCL — 3 Column)

Deals is entity navigation.

It is not a board or monitoring dashboard.

---

### Begin Column
Each row:

- Deal Name
- Sponsor
- Stage (badge)
- Notional
- Expected IRR

Filters (institutional style):

- Stage
- Strategy
- Owner
- Status

---

### Mid Column
Header:

- Deal Name
- Sponsor
- Stage
- Strategy
- Expected IRR
- Notional

Tabs required:

- Overview
- Investment Memo
- Governance Requirements
- Documents
- Activity Log

---

### End Column
Valid drill-down examples:

- Specific governance requirement
- Memo revision history
- Document inspection
- Activity entry detail

Remove completely:

- Execution Queue
- Operational board semantics
- Dense dashboard layers

---

# 4.3 Signatures (FCL — 3 Column)

Signatures is workflow navigation.

It is not compliance monitoring.

---

### Begin Column
Each row:

- Document Name
- Counterparty
- Status
- Expiration Date

---

### Mid Column
Header:

- Document Name
- Counterparty
- Status
- Initiated Date
- Expiration Date

Tabs:

- Overview
- Signature Timeline
- Related Obligations
- Documents

---

### End Column
Valid drill-down:

- Timeline event detail
- Linked obligation inspection
- Document preview

Monitoring vocabulary is forbidden.

---

# 4.4 Cash (Multi-Instance)

Structure preserved:

Command → Analytical → Operational → Monitoring

Renaming rules apply strictly.

Language must be treasury-grade.

---

# 4.5 Compliance (Multi-Instance)

Audit-grade interface.

No backend enforcement exposure.

No system-internal vocabulary.

---

# 4.6 Reporting (Multi-Instance)

Executive-grade published outputs.

No tooling semantics.

---

## 5. GLOBAL BUTTON STANDARD

Primary:
- Apply

Secondary:
- Reset

Tertiary:
- Export
- Download

Forbidden globally:

- Clear
- DEFAULT
- activeFiltersCount

---

## 6. GLOBAL BAN LIST

The following words must never appear in UI:

- P1
- P2
- P3
- backend-driven
- system-generated
- dense
- default
- activeFiltersCount
- repeated "No Data"

Violations are institutional regressions.

---

## 7. INSTITUTIONAL UX DEFINITION

The UI must feel:

- Investor-grade
- Audit-readable
- Structured
- Predictable
- SAP-level enterprise

It must never feel:

- Developer-facing
- Experimental
- Dashboard-heavy
- Operational-board driven

---

End of Frontend Layout Constitution v2.
