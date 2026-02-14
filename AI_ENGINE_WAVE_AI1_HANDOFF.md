# AI Engine Wave AI-1 Handoff

## Scope Delivered
- Wave AI-1 implemented as backend institutional layer only.
- No frontend AI pages or client-side inference added.
- Outputs are persisted and exposed through backend-driven contracts.

## Backend Modules Added
- `backend/ai_engine/classifier.py`
- `backend/ai_engine/knowledge_builder.py`
- `backend/ai_engine/obligation_extractor.py`
- `backend/ai_engine/monitoring.py`

## Endpoints Delivered
- `GET /api/ai/documents/classification?fund_id=&path=`
- `GET /api/ai/managers/profile?fund_id=&manager=`
- `GET /api/ai/obligations/register?fund_id=`
- `GET /api/ai/alerts/daily?fund_id=`
- `POST /api/ai/run-daily-cycle?fund_id=` (admin/internal)

## Persistence Delivered
- `document_registry`
- `manager_profiles`
- `obligation_register`
- `governance_alerts`

Migration file:
- `backend/app/core/db/migrations/versions/0020_ai_engine_wave_ai1.py`

## Azure Search Integration
- Daily pipeline pushes normalized AI outputs to existing metadata search index via `AzureSearchMetadataClient.upsert_documents`.
- Search is used as retrieval/index layer while AI Engine persists structured outputs in governed tables.

## Daily Cycle
`run_daily_cycle` executes:
1. Data Room classification
2. Manager profile build
3. Obligation extraction
4. Alert generation for missing evidence, approaching/overdue due dates, and cycle summaries

## Governance Constraints Enforced
- Backend-driven contracts only
- `asOf` required in all AI output responses
- Optional `dataLatency` and `dataQuality` included
- No non-SAP UI dependencies added
- No direct frontend access to Blob introduced

## Verification
- Smoke script: `tmp/ai_engine_smoke_test.py`
- QA output: `AI_ENGINE_SMOKE_REPORT.md` (PASS for Classification, Manager Profile generation, Obligation extraction, Daily alerts)
- Migration runtime in this workspace is blocked by unavailable DB host `postgres`; migration file is delivered and syntax-valid.
