# Gate TTL-1 — Signed URL Expiration Validation (staging)

Status: **BLOCKED (staging route not deployed)**
Owner: Backend + Security + QA/Governance
Priority: High (pre-externalization)

## Institutional Decision (Confirmed)
- TTL-1 status: **BLOCKED (infra staging incompleta)**
- Data Room Gate: **CONDITIONAL PASS** (unchanged)
- Root cause classification: **Infra / Deployment Gap**
- Non-causes: no architectural failure, no security failure, no implementation failure

## Objective
Validate that Data Room signed URLs (`signedViewUrl`, `signedDownloadUrl`) expire correctly in staging/prod with real SAS enabled.

## Scope
Endpoints in scope:
- `GET /api/data-room/file-link?path=`
- Viewer flow using `signedViewUrl`
- Download flow using `signedDownloadUrl`

## Validation Steps
1. Request `file-link` for a known PDF file and capture URL + `se` expiration claim (or equivalent expiry metadata).
2. Open URL before expiry and verify HTTP 200 (viewer/download as applicable).
3. Wait until after expiry threshold.
4. Retry same URL and verify access is denied (expected 401/403/409 per storage policy) or equivalent hard-fail.
5. Request a **new** file-link and verify access is restored with fresh URL.
6. Confirm frontend does not cache/reuse expired URLs silently.

## Acceptance Criteria
- Expired signed URLs are unusable after TTL.
- New signed URLs are required and function correctly.
- No direct frontend Azure Blob credential/access introduced.
- Failure mode is explicit (no silent fallback).
- Evidence captured in test log with timestamps before/after expiry.

## Evidence Required
- API call logs (request/response metadata)
- Browser/network capture before and after TTL
- Final QA sign-off note

## Exit Rule
When all acceptance criteria are met and evidence is attached, set:
- Status: **CLOSED**
- Data Room Gate Status: **PASS FINAL**

## Execution Log — 2026-02-13 (staging)

Environment tested:
- Base URL: `https://delightful-rock-0af6ec50f.6.azurestaticapps.net`
- Technical log: [tmp/ttl1_staging_probe_log.json](../tmp/ttl1_staging_probe_log.json)

Timestamped results:
- URL generation attempt (`/api/data-room/file-link`) at `2026-02-13T20:27:44.8781335Z` → **404**
- Legacy generation attempt (`/api/dataroom/file-link`) at `2026-02-13T20:27:45.4100565Z` → **404**
- Legacy browse route (`/api/dataroom/browse`) at `2026-02-13T20:27:45.9567854Z` → **200**

Conclusion:
- Active staging currently exposes legacy `dataroom/browse` but **does not expose signed-link endpoint**.
- TTL cycle validation (generate URL → wait expiry → post-exp attempt) is **not executable** until `/api/data-room/file-link` (or equivalent signed-link route) is deployed.

## Mandatory Fields Requested (Current State)

- TTL configured (declared): **30 minutes (default code value `AZURE_STORAGE_SAS_TTL_MINUTES`)**
- URL generation timestamp: **NOT AVAILABLE (endpoint missing in staging)**
- URL expiration timestamp: **NOT AVAILABLE (endpoint missing in staging)**
- Post-expiration attempt timestamp: **NOT AVAILABLE (endpoint missing in staging)**

## Security Assertions (validated from implementation)

- **No credential exposure in frontend**: confirmed (frontend uses backend API only; no storage keys/tokens embedded).
- **No silent retry logic**: confirmed (no automatic retry path for expired links; explicit user action required for new URL retrieval).
- Backend auto-renew without explicit new request: **cannot be runtime-validated in staging until signed-link route is available**.

## Next Required Action

1. Deploy Data Room signed-link contract to staging (`/api/data-room/file-link`).
2. Re-run TTL-1 with full timestamp triad:
	- generation
	- expiration
	- post-expiration attempt
3. Validate storage policy error code on expired URL (`401/403/409`, never generic `500`).
4. Upon evidence completion, update this gate to `CLOSED` and promote Data Room Gate to `PASS FINAL`.

## Corrective Action (Opened)

- Formal infra task: [DEPLOY_STAGING_DR_ROUTES_TASK.md](DEPLOY_STAGING_DR_ROUTES_TASK.md)
- Monitoring runbook: [TTL1_STAGING_MONITOR_RUNBOOK.md](TTL1_STAGING_MONITOR_RUNBOOK.md)
- Latest route readiness log: [tmp/ttl1_route_monitor_log.json](../tmp/ttl1_route_monitor_log.json)

Operational mode:
- Continuous monitoring loops are disabled.
- Verification is manual and infra-triggered only.

Latest probe confirmation (`2026-02-13T21:49:25.455333+00:00`):
- `GET /api/data-room/file-link` → `404`
- `GET /api/dataroom/file-link` → `404`
- `GET /api/dataroom/browse` → `200`
