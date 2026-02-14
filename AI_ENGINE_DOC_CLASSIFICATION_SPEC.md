# AI Engine Document Classification Spec (Wave AI-2)

## Purpose
Classify every registered document into institutional document types without manual tagging.

## Input Signals
Classification uses combined signals:
- Container metadata (`container_name`, `domain_tag`, `authority`, `shareability`)
- Filename patterns (`blob_path`)
- Extracted text content (document chunks or blob content)

## Output Enum
- `FUND_CONSTITUTIONAL`
- `REGULATORY_CIMA`
- `SERVICE_PROVIDER_CONTRACT`
- `INVESTMENT_MEMO`
- `DEAL_MARKETING`
- `RISK_POLICY_INTERNAL`
- `AUDIT_EVIDENCE`
- `INVESTOR_NARRATIVE`
- `OTHER`

## Persistence Contract
Table: `document_classifications`
- `doc_id`
- `doc_type`
- `confidence_score`
- `classification_basis` (`container|filename|content` composition)

Registry linkage:
- `document_registry.detected_doc_type` updated for direct index consumption.

## Determinism Rules
- Same document snapshot (`container_name + blob_path + etag/last_modified`) yields stable classification.
- Classification writes are upserted per `doc_id` (no duplicate active classification rows).
- Confidence scoring is rule-based and deterministic.

## Governance Notes
- Container metadata is binding context and always included.
- Classification does not create obligations in AI-2; it only structures document intelligence.
