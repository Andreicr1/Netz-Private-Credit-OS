# AI Engine Authority Resolution Spec (Wave AI-2)

## Objective
Resolve institutional governance weight for each classified document and persist a canonical governance profile.

## Authority Hierarchy
Rank (low → high):
1. `NARRATIVE`
2. `INTELLIGENCE`
3. `EVIDENCE`
4. `POLICY`
5. `BINDING`

## Resolution Rule
`resolved_authority = max(container.authority, doc_type_override)`

Hard overrides:
- `REGULATORY_CIMA` → `BINDING`
- `FUND_CONSTITUTIONAL` → `BINDING`
- `SERVICE_PROVIDER_CONTRACT` → `BINDING`
- `INVESTOR_NARRATIVE` → `NARRATIVE`

Additional guard:
- `INTELLIGENCE` context never escalates to `BINDING` by override alone.

## Binding Scope Rule
- `FUND`: constitutional/regulatory/risk-policy
- `SERVICE_PROVIDER`: provider contracts
- `MANAGER`: investment memos / deal marketing

## Persistence Contract
Table: `document_governance_profile`
- `doc_id`
- `resolved_authority`
- `binding_scope`
- `shareability_final`
- `jurisdiction` (if detected)

## Downstream Usage
Wave AI-3 consumes:
- `document_governance_profile`
- `knowledge_anchors`

To produce obligation schedules, compliance alerts, and breach monitoring.
