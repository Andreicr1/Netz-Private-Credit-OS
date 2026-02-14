# AI Engine Pipeline Intelligence Spec (Wave AI-3)

## Domain Scope
Investment Pipeline Intelligence only.
No regulatory schedule extraction and no governance obligation extraction in this wave.

## Authority Constraint
Pipeline container authority is `INTELLIGENCE` and must never escalate to `BINDING`.

## Source
Container: `investment-pipeline-intelligence`

Folder structure semantics:
- `investment-pipeline-intelligence/<DealOrManager>/...`
- First folder segment defines deal identity for discovery.

## C1 — Deal Discovery
Input: AI-2 `document_registry` rows for pipeline container.
Output: upsert into `pipeline_deals` with:
- `deal_name`, `sponsor_name`
- `lifecycle_stage` (default `SCREENING`)
- `first_detected_at`, `last_updated_at`
- `deal_folder_path`

## C2 — Deal Document Aggregation
Input: discovered deals + pipeline document registry.
Output: `deal_documents` with:
- `deal_id`, `doc_id`, `doc_type`, `confidence_score`

## C3 — Intelligence Profile
Output table: `deal_intelligence_profiles`
Key fields:
- strategy, geography, sector focus
- target return
- risk band
- liquidity/capital structure
- key risks, differentiators
- IC-ready summary

## C4 — Risk Pre-Analysis
Output table: `deal_risk_flags`
Rules:
- Risk flags are evidence-driven from AI-2 `knowledge_anchors`.
- No risk flag is generated without anchor basis.
- Risk types include concentration, leverage, track record, liquidity, legal, operational.

## C5 — IC Brief
Output table: `deal_ic_briefs`
Institutional sections:
- executive summary
- opportunity overview
- return profile
- downside case
- risk summary
- peer comparison note
- recommendation signal

## C6 — Monitoring
Output table: `pipeline_alerts`
Alert conditions:
- risk band high/speculative
- target return drop
- legal high risk
- track record inconsistency

## APIs
- `POST /api/ai/pipeline/ingest`
- `GET /api/ai/pipeline/deals`
- `GET /api/ai/pipeline/deals/{deal_id}`
- `GET /api/ai/pipeline/alerts`

All responses include `asOf`.
