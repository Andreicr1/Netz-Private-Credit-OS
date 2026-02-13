# Data Room — Security Memo (TTL-1)

Date: **2026-02-13**
Scope: Signed URL expiration control prior to external RBAC exposure
Decision: **TTL-1 not closable yet (staging contract gap)**

## Executive Summary

TTL-1 execution was initiated and technically logged in staging.
Staging is healthy and can list Data Room folders, but the signed-link endpoint required for TTL validation is not currently deployed.
Therefore, TTL expiration behavior cannot be proven in staging at this time.

## Evidence

- Staging probe log: [tmp/ttl1_staging_probe_log.json](../tmp/ttl1_staging_probe_log.json)
- TTL gate control file: [frontend/GATE_TTL1_SIGNED_URL_EXPIRATION_VALIDATION.md](GATE_TTL1_SIGNED_URL_EXPIRATION_VALIDATION.md)

## Recorded Technical Facts

- `GET /api/data-room/file-link?...` → `404`
- `GET /api/dataroom/file-link?...` → `404`
- `GET /api/dataroom/browse` → `200`
- `GET /api/health` and `GET /api/health/azure` → `200`

## Security Assertions

- **No credential exposure in frontend**: confirmed.
- **No silent retry logic**: confirmed.
- Expired-link error policy (`401/403/409`, never `500`): not testable until signed-link route is available.

## Institutional Classification (Accepted)

- Type: **Infra / Deployment Gap**
- Not an architectural failure
- Not a security failure
- Not an implementation failure

## Declared TTL Configuration

- Current declared TTL baseline: **30 minutes** (default `AZURE_STORAGE_SAS_TTL_MINUTES`).
- Runtime TTL in staging must still be verified from live signed URL (`se`) during final TTL-1 run.

## Required Closure Step

Deploy signed-link route to staging and re-run TTL-1 with timestamped cycle evidence:

1. URL generation timestamp
2. URL expiration timestamp
3. Post-expiration attempt timestamp

Formal deployment task is open: [DEPLOY_STAGING_DR_ROUTES_TASK.md](DEPLOY_STAGING_DR_ROUTES_TASK.md)

Latest route-readiness evidence:
- [tmp/ttl1_route_monitor_log.json](../tmp/ttl1_route_monitor_log.json)

Operational mode:
- Continuous background monitoring is disabled.
- Route check is manual and executed only after infra deployment handoff.

After successful cycle validation, set:

- TTL-1 status: **CLOSED**
- Data Room Gate Status: **PASS FINAL**