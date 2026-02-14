# AI Engine Smoke Report — Wave AI-5 (Cross-Container Semantic Linking)

## Scope
- Wave: AI-5
- Mode: Backend-only
- Objective: Governed cross-container semantic linking with authority-preserving persistence
- Date (UTC): 2026-02-14

## Execution Summary
- Status: PASS
- Test Command: `pytest -q ai_engine/tests/test_wave_ai5_linking.py`
- Result: `1 passed`

## Governance Gate Checks
- Narrative documents never derive obligations: PASS
- Evidence documents can satisfy obligations: PASS
- Pipeline intelligence documents reference (not derive) obligations: PASS
- Links persisted in institutional DB tables: PASS
- Binding due-rule conflicts generate `CONFLICTS_WITH`: PASS

## Persistence Verification
- New tables created and used:
  - `knowledge_entities`
  - `knowledge_links`
  - `obligation_evidence_map`
- Linker run persists:
  - Entity index entries
  - Semantic links with authority tier
  - Obligation-evidence satisfaction mappings

## API Verification
- Added endpoints:
  - `POST /api/funds/{fund_id}/ai/linker/run`
  - `GET /api/funds/{fund_id}/ai/linker/links?entity_id=...&as_of=...`
  - `GET /api/funds/{fund_id}/ai/linker/obligations/status?as_of=...`
- Output contract: strict JSON envelope with mode/asOf/status/payload counters
- asOf enforcement: implemented on linker read endpoints and run trigger

## Notes
- No frontend/UI changes made.
- No economic inference logic introduced.
