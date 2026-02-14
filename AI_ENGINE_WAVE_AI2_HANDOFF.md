# AI Engine Wave AI-2 Handoff

## Scope Implemented
- Backend-only institutional document intelligence layer (Wave AI-2).
- Automatic document scan, classification, authority resolution, and anchor extraction.
- Persistent audit-grade storage for all outputs.

## Pipeline B1 → B5
1. **B1 Document Registry Scan**
   - Module: `backend/ai_engine/document_scanner.py`
   - Scans institutional containers and upserts `document_registry` with container metadata, etag/checksum, lifecycle stage, and ingestion timestamp.
2. **B2 Document Type Classification**
   - Module: `backend/ai_engine/doc_classifier.py`
   - Classifies docs into institutional enum using container metadata, filename, and extracted content.
   - Persists to `document_classifications`.
3. **B3 Authority Resolver**
   - Module: `backend/ai_engine/authority_resolver.py`
   - Resolves final authority with governance hierarchy and hard overrides.
   - Persists to `document_governance_profile`.
4. **B4 Knowledge Anchors**
   - Module: `backend/ai_engine/knowledge_anchor_extractor.py`
   - Extracts structured anchors (fund/provider/date/law/regulatory refs/keywords).
   - Persists to `knowledge_anchors`.
5. **B5 Governance Index Output**
   - Endpoints in `backend/app/modules/ai/routes.py`:
     - `POST /api/ai/documents/ingest`
     - `GET /api/ai/documents/index`
     - `GET /api/ai/documents/{doc_id}`

## Persistence and Migration
- Migration: `backend/app/core/db/migrations/versions/0021_ai_engine_wave_ai2.py`
- New tables:
  - `document_classifications`
  - `document_governance_profile`
  - `knowledge_anchors`
- `document_registry` expanded for container-aware governance metadata.

## Governance Enforced
- No frontend/UI implementation.
- No chat endpoint introduced.
- Deterministic persisted outputs only.
- Narrative docs do not become binding in authority resolver.

## Verification
- Smoke script: `tmp/ai_engine_wave_ai2_smoke_test.py`
- Output report: `AI_ENGINE_SMOKE_REPORT_AI2.md`
