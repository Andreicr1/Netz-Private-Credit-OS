# AI Engine Wave AI-3 Handoff

## Scope
Wave AI-3 implemented as backend-only Investment Pipeline Intelligence Engine.

## Delivered Capabilities (C1→C6)
1. **Deal Folder Discovery (C1)**
   - Discovers deals from `investment-pipeline-intelligence/<DealName>/...`
   - Persists lifecycle-aware deal records in `pipeline_deals`.
2. **Deal Document Aggregation (C2)**
   - Maps pipeline documents into institutional deal document taxonomy.
   - Persists in `deal_documents`.
3. **Deal Intelligence Profile Builder (C3)**
   - Builds deterministic institutional profile per deal.
   - Persists in `deal_intelligence_profiles`.
4. **Risk Pre-Analysis Engine (C4)**
   - Generates risk flags using AI-2 anchors as evidence input.
   - Persists in `deal_risk_flags`.
5. **IC Brief Generator (C5)**
   - Produces structured IC-ready brief.
   - Persists in `deal_ic_briefs`.
6. **Pipeline Monitoring (C6)**
   - Creates deterministic alerts for risk/return/legal/track-record conditions.
   - Persists in `pipeline_alerts`.

## Endpoints
- `POST /api/ai/pipeline/ingest`
- `GET /api/ai/pipeline/deals`
- `GET /api/ai/pipeline/deals/{deal_id}`
- `GET /api/ai/pipeline/alerts`

## Persistence and Migration
- Migration: `backend/app/core/db/migrations/versions/0022_ai_engine_wave_ai3_pipeline_intelligence.py`
- Added/extended tables:
  - `pipeline_deals` (extended with AI-3 lifecycle/discovery fields)
  - `deal_documents`
  - `deal_intelligence_profiles`
  - `deal_risk_flags`
  - `deal_ic_briefs`
  - `pipeline_alerts`

## Institutional Constraint Support
- Designed for future transition when `lifecycle_stage = APPROVED`:
  - `pipeline_deals.transition_target_container = portfolio-active-investments`
  - `pipeline_deals.intelligence_history` retains AI history context for migration continuity.

## Verification Artifact
- Smoke script: `tmp/ai_engine_wave_ai3_smoke_test.py`
- Report: `AI_ENGINE_SMOKE_REPORT_AI3.md`
