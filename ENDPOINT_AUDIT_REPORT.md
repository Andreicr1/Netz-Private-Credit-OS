# Endpoint Audit Report — Netz Private Credit OS

**Generated:** 2026-02-13  
**Scope:** `backend/`, `frontend/`, `infra/`, `.github/workflows/`  
**Auditor:** Automated full-repository scan

---

## Table of Contents

0. [Wave Implementation Status (Current)](#0-wave-implementation-status-current)
1. [Backend Overview](#1-backend-overview)
2. [Frontend Overview](#2-frontend-overview)
3. [Integration Matrix](#3-integration-matrix)
4. [Infrastructure Findings](#4-infrastructure-findings)
5. [Critical Issues](#5-critical-issues)
6. [Recommendations](#6-recommendations)

---

## 0. Wave Implementation Status (Current)

Canonical coverage source for execution tracking: **this file (`ENDPOINT_AUDIT_REPORT.md`)**.

### Wave 0 — Architecture Stabilization

- ✅ Single frontend HTTP client flow preserved (`apiClient` + `services/http.js` delegation)
- ✅ No APIM base URL references in `frontend/webapp/**`
- ✅ No direct `fetch(` outside `services/ApiClient.js`

### Wave 1 — Portfolio + Deals Pipeline

- ✅ `frontend/webapp/api/portfolio.js` expanded and in use
- ✅ `frontend/webapp/api/deals.js` expanded and in use
- ✅ Placeholder pages integrated in shell routing

### Wave 2 — Compliance + Actions

- ✅ `frontend/webapp/api/compliance.js` and `frontend/webapp/api/actions.js` expanded with explicit wrappers
- ✅ Placeholder pages integrated in shell routing

### Wave 3 — Cash Management

- ✅ `frontend/webapp/api/cash.js` complete coverage of cash transitions/reconciliation/statements
- ✅ `frontend/webapp/pages/CashManagementPage.js` active and calling real endpoints

### Wave 4 — Documents + Dataroom + Reporting + AI + Signatures

- ✅ API modules expanded/added:
  - `frontend/webapp/api/documents.js`
  - `frontend/webapp/api/dataroom.js`
  - `frontend/webapp/api/reporting.js`
  - `frontend/webapp/api/ai.js`
  - `frontend/webapp/api/signatures.js`
- ✅ Compatibility preserved for existing AI consumers via `frontend/webapp/api/copilot.js` delegation
- ✅ New placeholder pages integrated:
  - `frontend/webapp/pages/DocumentsPage.js`
  - `frontend/webapp/pages/DataroomPage.js`
  - `frontend/webapp/pages/ReportingPage.js`
  - `frontend/webapp/pages/AiPage.js`
  - `frontend/webapp/pages/SignaturesPage.js`
- ✅ Routes/navigation updated in:
  - `frontend/webapp/layout/AppShell.js`
  - `frontend/webapp/layout/SideNavigation.js`

Wave 4 endpoint wrappers now mapped:

| Domain | Method | Backend Path | Frontend Function |
|--------|--------|--------------|-------------------|
| Documents | GET | `/api/funds/{fund_id}/documents` | `listDocuments` |
| Documents | GET | `/api/funds/{fund_id}/documents/root-folders` | `listRootFolders` |
| Documents | POST | `/api/funds/{fund_id}/documents/root-folders` | `createRootFolder` |
| Documents | POST | `/api/funds/{fund_id}/documents/upload` | `uploadPdf` |
| Documents | GET | `/api/funds/{fund_id}/documents/{document_id}` | `getDocumentById` |
| Documents | GET | `/api/funds/{fund_id}/documents/{document_id}/versions` | `listDocumentVersions` |
| Documents | POST | `/api/funds/{fund_id}/documents/ingestion/process-pending` | `processPendingIngestion` |
| Documents | POST | `/api/funds/{fund_id}/documents` | `createDocument` |
| Documents | POST | `/api/funds/{fund_id}/documents/{document_id}/versions` | `createDocumentVersion` |
| Dataroom | POST | `/api/dataroom/documents` | `uploadDataroomDocument` |
| Dataroom | POST | `/api/dataroom/documents/{document_id}/ingest` | `ingestDataroomDocument` |
| Dataroom | GET | `/api/dataroom/search` | `searchDataroom` |
| Reporting | GET | `/api/funds/{fund_id}/reports/nav/snapshots` | `listNavSnapshots` |
| Reporting | POST | `/api/funds/{fund_id}/reports/nav/snapshots` | `createNavSnapshot` |
| Reporting | GET | `/api/funds/{fund_id}/reports/nav/snapshots/{snapshot_id}` | `getNavSnapshotById` |
| Reporting | POST | `/api/funds/{fund_id}/reports/nav/snapshots/{snapshot_id}/finalize` | `finalizeNavSnapshot` |
| Reporting | POST | `/api/funds/{fund_id}/reports/nav/snapshots/{snapshot_id}/publish` | `publishNavSnapshot` |
| Reporting | POST | `/api/funds/{fund_id}/reports/nav/snapshots/{snapshot_id}/assets` | `recordAssetValuationSnapshot` |
| Reporting | POST | `/api/funds/{fund_id}/reports/evidence-pack` | `exportEvidencePack` |
| Reporting | POST | `/api/funds/{fund_id}/reports/monthly-pack/generate` | `generateMonthlyPack` |
| Reporting | GET | `/api/funds/{fund_id}/reports/monthly-pack/list` | `listMonthlyPacks` |
| Reporting | GET | `/api/funds/{fund_id}/reports/monthly-pack/{pack_id}/download` | `downloadMonthlyPack` |
| Reporting | POST | `/api/funds/{fund_id}/reports/investor-statements/generate` | `generateInvestorStatement` |
| Reporting | GET | `/api/funds/{fund_id}/reports/investor-statements` | `listInvestorStatements` |
| Reporting | GET | `/api/funds/{fund_id}/reports/investor-statements/{statement_id}/download` | `downloadInvestorStatement` |
| Reporting | GET | `/api/funds/{fund_id}/reports/archive` | `getReportingArchive` |
| AI | GET | `/api/funds/{fund_id}/ai/activity` | `listAIActivity` |
| AI | POST | `/api/funds/{fund_id}/ai/query` | `createAIQuery` |
| AI | GET | `/api/funds/{fund_id}/ai/history` | `listAIHistory` |
| AI | POST | `/api/funds/{fund_id}/ai/retrieve` | `retrieveAIContext` |
| AI | POST | `/api/funds/{fund_id}/ai/answer` | `answerAIQuestion` |
| Signatures | GET | `/api/funds/{fund_id}/signatures` | `listSignatureRequests` |
| Signatures | GET | `/api/funds/{fund_id}/signatures/{request_id}` | `getSignatureRequest` |
| Signatures | POST | `/api/funds/{fund_id}/signatures/{request_id}/sign` | `signSignatureRequest` |
| Signatures | POST | `/api/funds/{fund_id}/signatures/{request_id}/reject` | `rejectSignatureRequest` |
| Signatures | POST | `/api/funds/{fund_id}/signatures/{request_id}/execution-pack` | `exportExecutionPack` |

---

## 1. Backend Overview

### 1.1 Framework

| Property | Value |
|----------|-------|
| Framework | **FastAPI** |
| ASGI Server | **Gunicorn + Uvicorn workers** |
| Python Version | 3.11 |
| Entrypoint | `backend/app/main.py` → `app = create_app()` |
| Startup command (App Service) | `cd /home/site/wwwroot/backend && gunicorn app.main:app --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --timeout 120` |
| Startup command (Docker) | `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000` |

### 1.2 Router Mounting Architecture

The backend uses a **dual-mount strategy**: every route is available both at its base path AND prefixed with `/api`:

| Router Group | Base Mount | API Mount |
|-------------|-----------|-----------|
| Fund sub-routers (portfolio, deals, actions, compliance, documents, ai, signatures) | `/funds/{fund_id}/...` | `/api/funds/{fund_id}/...` |
| Domain routers (assets, alerts, obligations, deals, etc.) | `/funds/{fund_id}/...` | `/api/funds/{fund_id}/...` |
| Dataroom router | `/api/dataroom/...` | N/A (self-prefixed, NOT re-prefixed) |
| Cash management | `/funds/{fund_id}/cash/...` | `/api/funds/{fund_id}/cash/...` |
| Health endpoints | `/health`, `/health/azure` | `/api/health`, `/api/health/azure` |

### 1.3 APIM Proxy Client

| Property | Value |
|----------|-------|
| File | `backend/app/core/http/apim_client.py` |
| Base URL | `https://netz-prod-api-apim.azure-api.net` |
| Auth Header | `Ocp-Apim-Subscription-Key` |
| Key Source | `APIM_SUBSCRIPTION_KEY` environment variable |
| Helper Function | `apim_request(method, path_or_url, **kwargs)` |
| **Usage in routes/services** | **NOT USED** — exported and tested but never imported by any route or service module |

### 1.4 Complete Backend Route Inventory

All paths below are shown with the `/api` prefix (also available without it unless noted).

#### Health & Admin (defined in `backend/app/main.py`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/health` | Basic health check |
| GET | `/api/health/azure` | Azure services health (storage, search, foundry, keyvault) |
| POST | `/admin/dev/seed` | Dev-only seed endpoint (no `/api` alias) |

#### Portfolio Module (`backend/app/modules/portfolio/routes.py`)

| Method | Path |
|--------|------|
| GET | `/api/funds/{fund_id}/portfolio/borrowers` |
| POST | `/api/funds/{fund_id}/portfolio/borrowers` |
| GET | `/api/funds/{fund_id}/portfolio/loans` |
| POST | `/api/funds/{fund_id}/portfolio/loans` |
| GET | `/api/funds/{fund_id}/portfolio/covenants` |
| POST | `/api/funds/{fund_id}/portfolio/covenants` |
| POST | `/api/funds/{fund_id}/portfolio/covenant-tests` |
| GET | `/api/funds/{fund_id}/portfolio/breaches` |
| GET | `/api/funds/{fund_id}/portfolio/alerts` |
| POST | `/api/funds/{fund_id}/portfolio/alerts` |

#### Deals Module (`backend/app/modules/deals/routes.py`)

| Method | Path |
|--------|------|
| GET | `/api/funds/{fund_id}/pipeline/deals` |
| POST | `/api/funds/{fund_id}/pipeline/deals` |
| PATCH | `/api/funds/{fund_id}/pipeline/deals/{deal_id}/stage` |
| POST | `/api/funds/{fund_id}/pipeline/deals/{deal_id}/decisions` |
| POST | `/api/funds/{fund_id}/pipeline/deals/qualification/run` |

#### Actions Module (`backend/app/modules/actions/routes.py`)

| Method | Path |
|--------|------|
| GET | `/api/funds/{fund_id}/execution/actions` |
| POST | `/api/funds/{fund_id}/execution/actions` |
| PATCH | `/api/funds/{fund_id}/execution/actions/{action_id}/status` |
| POST | `/api/funds/{fund_id}/execution/actions/{action_id}/evidence` |

#### Compliance Module (`backend/app/modules/compliance/routes.py`)

| Method | Path |
|--------|------|
| GET | `/api/funds/{fund_id}/compliance/snapshot` |
| GET | `/api/funds/{fund_id}/compliance/me` |
| GET | `/api/funds/{fund_id}/compliance/obligations` |
| GET | `/api/funds/{fund_id}/compliance/obligations/{obligation_id}` |
| GET | `/api/funds/{fund_id}/compliance/obligations/{obligation_id}/evidence` |
| POST | `/api/funds/{fund_id}/compliance/obligations/{obligation_id}/evidence/link` |
| POST | `/api/funds/{fund_id}/compliance/obligations/{obligation_id}/workflow/mark-in-progress` |
| POST | `/api/funds/{fund_id}/compliance/obligations/{obligation_id}/workflow/close` |
| GET | `/api/funds/{fund_id}/compliance/obligations/{obligation_id}/audit` |
| POST | `/api/funds/{fund_id}/compliance/obligations` |
| GET | `/api/funds/{fund_id}/compliance/obligation-status` |
| POST | `/api/funds/{fund_id}/compliance/obligation-status/recompute` |
| POST | `/api/funds/{fund_id}/compliance/gaps/recompute` |
| GET | `/api/funds/{fund_id}/compliance/gaps` |

#### Documents Module (`backend/app/modules/documents/routes.py`)

| Method | Path |
|--------|------|
| POST | `/api/funds/{fund_id}/documents` |
| POST | `/api/funds/{fund_id}/documents/{document_id}/versions` |

#### Documents Ingest Domain (`backend/app/domain/documents/routes/ingest.py`)

| Method | Path |
|--------|------|
| POST | `/api/funds/{fund_id}/documents/upload` |
| GET | `/api/funds/{fund_id}/documents` |
| GET | `/api/funds/{fund_id}/documents/root-folders` |
| GET | `/api/funds/{fund_id}/documents/{document_id}` |
| GET | `/api/funds/{fund_id}/documents/{document_id}/versions` |
| POST | `/api/funds/{fund_id}/documents/root-folders` |
| POST | `/api/funds/{fund_id}/documents/ingestion/process-pending` |

#### AI Module (`backend/app/modules/ai/routes.py`)

| Method | Path |
|--------|------|
| GET | `/api/funds/{fund_id}/ai/activity` |
| POST | `/api/funds/{fund_id}/ai/query` |
| GET | `/api/funds/{fund_id}/ai/history` |
| POST | `/api/funds/{fund_id}/ai/retrieve` |
| POST | `/api/funds/{fund_id}/ai/answer` |

#### Signatures Module (`backend/app/modules/signatures/routes.py`)

| Method | Path |
|--------|------|
| GET | `/api/funds/{fund_id}/signatures` |
| GET | `/api/funds/{fund_id}/signatures/{request_id}` |
| POST | `/api/funds/{fund_id}/signatures/{request_id}/sign` |
| POST | `/api/funds/{fund_id}/signatures/{request_id}/reject` |
| POST | `/api/funds/{fund_id}/signatures/{request_id}/execution-pack` |

#### Domain — Assets (`backend/app/domain/portfolio/routes/assets.py`)

| Method | Path |
|--------|------|
| POST | `/api/funds/{fund_id}/assets` |

#### Domain — Alerts (`backend/app/domain/portfolio/routes/alerts.py`)

| Method | Path |
|--------|------|
| GET | `/api/funds/{fund_id}/alerts` |

#### Domain — Portfolio Actions (`backend/app/domain/portfolio/routes/actions.py`)

| Method | Path |
|--------|------|
| GET | `/api/funds/{fund_id}/portfolio/actions` |
| PATCH | `/api/funds/{fund_id}/portfolio/actions/{action_id}` |

#### Domain — Fund Investments (`backend/app/domain/portfolio/routes/fund_investments.py`)

| Method | Path |
|--------|------|
| POST | `/api/funds/{fund_id}/assets/{asset_id}/fund-investment` |
| GET | `/api/funds/{fund_id}/assets/{asset_id}/fund-investment` |

#### Domain — Obligations (`backend/app/domain/portfolio/routes/obligations.py`)

| Method | Path |
|--------|------|
| POST | `/api/funds/{fund_id}/assets/{asset_id}/obligations` |
| GET | `/api/funds/{fund_id}/obligations` |
| PATCH | `/api/funds/{fund_id}/obligations/{obligation_id}` |

#### Domain — Deals (`backend/app/domain/deals/routes/deals.py`)

| Method | Path |
|--------|------|
| POST | `/api/funds/{fund_id}/deals` |
| GET | `/api/funds/{fund_id}/deals` |
| PATCH | `/api/funds/{fund_id}/deals/{deal_id}/decision` |

#### Domain — Conversion (`backend/app/domain/deals/routes/conversion.py`)

| Method | Path |
|--------|------|
| POST | `/api/funds/{fund_id}/deals/{deal_id}/convert` |

#### Domain — IC Memos (`backend/app/domain/deals/routes/ic_memos.py`)

| Method | Path |
|--------|------|
| POST | `/api/funds/{fund_id}/deals/{deal_id}/ic-memo` |

#### Domain — Governed Actions (`backend/app/domain/actions/routes/actions.py`)

| Method | Path |
|--------|------|
| POST | `/api/funds/{fund_id}/actions` |
| GET | `/api/funds/{fund_id}/actions` |
| PATCH | `/api/funds/{fund_id}/actions/{action_id}` |

#### Domain — Evidence Upload (`backend/app/domain/documents/routes/uploads.py`)

| Method | Path |
|--------|------|
| POST | `/api/funds/{fund_id}/evidence/upload-request` |

#### Domain — Auditor (`backend/app/domain/documents/routes/auditor.py`)

| Method | Path |
|--------|------|
| GET | `/api/funds/{fund_id}/auditor/evidence` |

#### Domain — Evidence (`backend/app/domain/documents/routes/evidence.py`)

| Method | Path |
|--------|------|
| PATCH | `/api/funds/{fund_id}/evidence/{evidence_id}/complete` |

#### Domain — Report Packs (`backend/app/domain/reporting/routes/report_packs.py`)

| Method | Path |
|--------|------|
| POST | `/api/funds/{fund_id}/report-packs` |
| POST | `/api/funds/{fund_id}/report-packs/{pack_id}/generate` |
| POST | `/api/funds/{fund_id}/report-packs/{pack_id}/publish` |

#### Domain — Investor Portal (`backend/app/domain/reporting/routes/investor_portal.py`)

| Method | Path |
|--------|------|
| GET | `/api/funds/{fund_id}/investor/report-packs` |

#### Domain — Evidence Pack (`backend/app/domain/reporting/routes/evidence_pack.py`)

| Method | Path |
|--------|------|
| POST | `/api/funds/{fund_id}/reports/evidence-pack` |

#### Domain — Reports (`backend/app/domain/reporting/routes/reports.py`)

| Method | Path |
|--------|------|
| POST | `/api/funds/{fund_id}/reports/nav/snapshots` |
| GET | `/api/funds/{fund_id}/reports/nav/snapshots` |
| GET | `/api/funds/{fund_id}/reports/nav/snapshots/{snapshot_id}` |
| POST | `/api/funds/{fund_id}/reports/nav/snapshots/{snapshot_id}/finalize` |
| POST | `/api/funds/{fund_id}/reports/nav/snapshots/{snapshot_id}/publish` |
| POST | `/api/funds/{fund_id}/reports/nav/snapshots/{snapshot_id}/assets` |
| GET | `/api/funds/{fund_id}/reports/nav/snapshots/{snapshot_id}/assets` |
| POST | `/api/funds/{fund_id}/reports/monthly-pack/generate` |
| GET | `/api/funds/{fund_id}/reports/monthly-pack/list` |
| GET | `/api/funds/{fund_id}/reports/monthly-pack/{pack_id}/download` |
| POST | `/api/funds/{fund_id}/reports/investor-statements/generate` |
| GET | `/api/funds/{fund_id}/reports/investor-statements` |
| GET | `/api/funds/{fund_id}/reports/investor-statements/{statement_id}/download` |
| GET | `/api/funds/{fund_id}/reports/archive` |

#### Domain — Dataroom (`backend/app/domain/dataroom/routes.py`)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/dataroom/documents` | NOT fund-scoped |
| POST | `/api/dataroom/documents/{document_id}/ingest` | NOT fund-scoped |
| GET | `/api/dataroom/search` | NOT fund-scoped |

#### Domain — Cash Management (`backend/app/domain/cash_management/routes.py`)

| Method | Path |
|--------|------|
| GET | `/api/funds/{fund_id}/cash/snapshot` |
| GET | `/api/funds/{fund_id}/cash/transactions` |
| GET | `/api/funds/{fund_id}/cash/transactions/{tx_id}` |
| POST | `/api/funds/{fund_id}/cash/transactions` |
| POST | `/api/funds/{fund_id}/cash/transactions/{tx_id}/submit` |
| PATCH | `/api/funds/{fund_id}/cash/transactions/{tx_id}/submit-signature` |
| PATCH | `/api/funds/{fund_id}/cash/transactions/{tx_id}/mark-executed` |
| PATCH | `/api/funds/{fund_id}/cash/transactions/{tx_id}/mark-reconciled` |
| POST | `/api/funds/{fund_id}/cash/transactions/{tx_id}/approve/director` |
| POST | `/api/funds/{fund_id}/cash/transactions/{tx_id}/approve/ic` |
| POST | `/api/funds/{fund_id}/cash/transactions/{tx_id}/approve` |
| POST | `/api/funds/{fund_id}/cash/transactions/{tx_id}/reject` |
| POST | `/api/funds/{fund_id}/cash/transactions/{tx_id}/generate-instructions` |
| POST | `/api/funds/{fund_id}/cash/transactions/{tx_id}/mark-sent` |
| POST | `/api/funds/{fund_id}/cash/transactions/{tx_id}/mark-executed` |
| POST | `/api/funds/{fund_id}/cash/statements/upload` |
| GET | `/api/funds/{fund_id}/cash/reconciliation/unmatched` |
| GET | `/api/funds/{fund_id}/cash/statements` |
| GET | `/api/funds/{fund_id}/cash/statements/{statement_id}/lines` |
| POST | `/api/funds/{fund_id}/cash/statements/{statement_id}/lines` |
| POST | `/api/funds/{fund_id}/cash/reconcile` |
| GET | `/api/funds/{fund_id}/cash/reconciliation/report` |
| POST | `/api/funds/{fund_id}/cash/reconciliation/match` |

**Total unique backend endpoint signatures: ~106**

---

## 2. Frontend Overview

### 2.1 HTTP Client Architecture

The frontend has **two parallel HTTP stacks** that do NOT share routing logic:

| Stack | Module | Base URL Resolution | Files Using It |
|-------|--------|---------------------|----------------|
| **Stack A** (SAP UI5 AMD) | `webapp/services/api.js` | Always `"/api"` (relative) | `api/reports.js`, `modules/signatures/`, `modules/reporting/` |
| **Stack B** (ES module) | `webapp/services/http.js` + `webapp/services/env.js` | `"/api"` on localhost, **`https://netz-prod-api-apim.azure-api.net/api`** in production | `api/cash.js`, `api/documents.js`, `api/compliance.js`, `api/copilot.js`, `api/reporting.js`, `api/signatures.js` |

### 2.2 Complete Frontend HTTP Call Inventory

#### Stack A — SAP AMD (`services/api.js` → relative `/api`)

| Method | Path | Source File |
|--------|------|------------|
| GET | `/api/funds/{fundId}/documents` | `webapp/services/api.js` L88 |
| GET | `/api/funds/{fundId}/compliance/me` | `webapp/services/api.js` L98 |
| GET | `/api/funds/{fundId}/signatures` | `webapp/services/api.js` L148 |
| GET | `/api/funds/{fundId}/signatures/{id}` | `webapp/services/api.js` L157 |
| POST | `/api/funds/{fundId}/signatures/{id}/sign` | `webapp/services/api.js` L166 |
| POST | `/api/funds/{fundId}/signatures/{id}/reject` | `webapp/services/api.js` L171 |
| POST | `/api/funds/{fundId}/signatures/{id}/execution-pack` | `webapp/services/api.js` L176 |

#### Stack A — SAP AMD (`api/reports.js` → relative `/api`)

| Method | Path | Source File |
|--------|------|------------|
| GET | `/api/funds/{fundId}/reports/archive` | `webapp/api/reports.js` L58 |
| GET | `/api/funds/{fundId}/reports/nav/snapshots` | `webapp/api/reports.js` L65 |
| GET | `/api/funds/{fundId}/reports/nav/snapshots/{id}` | `webapp/api/reports.js` L71 |
| POST | `/api/funds/{fundId}/reports/nav/snapshots` | `webapp/api/reports.js` L77 |
| POST | `/api/funds/{fundId}/reports/nav/snapshots/{id}/finalize` | `webapp/api/reports.js` L83 |
| POST | `/api/funds/{fundId}/reports/nav/snapshots/{id}/publish` | `webapp/api/reports.js` L89 |
| POST | `/api/funds/{fundId}/reports/nav/snapshots/{id}/assets` | `webapp/api/reports.js` L95 |
| GET | `/api/funds/{fundId}/reports/monthly-pack/list` | `webapp/api/reports.js` L103 |
| POST | `/api/funds/{fundId}/reports/monthly-pack/generate` | `webapp/api/reports.js` L109 |
| GET | `/api/funds/{fundId}/reports/monthly-pack/{id}/download` | `webapp/api/reports.js` L115 |
| GET | `/api/funds/{fundId}/reports/investor-statements` | `webapp/api/reports.js` L121 |
| POST | `/api/funds/{fundId}/reports/investor-statements/generate` | `webapp/api/reports.js` L127 |
| GET | `/api/funds/{fundId}/reports/investor-statements/{id}/download` | `webapp/api/reports.js` L133 |

#### Stack B — ES Module (`services/http.js` + `services/env.js`)

**⚠ All paths below resolve to the ABSOLUTE APIM URL in production.**

| Method | Path | Source File |
|--------|------|------------|
| GET | `{base}/funds/{fundId}/cash/transactions` | `webapp/api/cash.js` L5 |
| POST | `{base}/funds/{fundId}/cash/transactions` | `webapp/api/cash.js` L13 |
| PATCH | `{base}/funds/{fundId}/cash/transactions/{txId}/submit-signature` | `webapp/api/cash.js` L18 |
| POST | `{base}/funds/{fundId}/cash/statements/upload` | `webapp/api/cash.js` L42 |
| GET | `{base}/funds/{fundId}/documents` | `webapp/api/documents.js` L5 |
| GET | `{base}/funds/{fundId}/documents/root-folders` | `webapp/api/documents.js` L13 |
| POST | `{base}/funds/{fundId}/documents/root-folders` | `webapp/api/documents.js` L18 |
| POST | `{base}/funds/{fundId}/documents/upload` | `webapp/api/documents.js` L37 |
| GET | `{base}/funds/{fundId}/compliance/me` | `webapp/api/compliance.js` L5 |
| GET | `{base}/funds/{fundId}/compliance/obligations` | `webapp/api/compliance.js` L10 |
| POST | `{base}/funds/{fundId}/compliance/obligations/{id}/workflow/close` | `webapp/api/compliance.js` L15 |
| POST | `{base}/funds/{fundId}/ai/retrieve` | `webapp/api/copilot.js` L5 |
| POST | `{base}/funds/{fundId}/ai/answer` | `webapp/api/copilot.js` L10 |
| GET | `{base}/funds/{fundId}/ai/activity` | `webapp/api/copilot.js` L17 |
| GET | `{base}/funds/{fundId}/compliance/snapshot` | `webapp/api/reporting.js` L5 |
| GET | `{base}/funds/{fundId}/cash/snapshot` | `webapp/api/reporting.js` L10 |
| POST | `{base}/funds/{fundId}/reports/evidence-pack` | `webapp/api/reporting.js` L15 |
| GET | `{base}/funds/{fundId}/signatures/{requestId}` | `webapp/api/signatures.js` L5 |
| POST | `{base}/funds/{fundId}/signatures/{requestId}/execution-pack` | `webapp/api/signatures.js` L10 |

#### Auth Calls (SWA infrastructure)

| Method | Path | Source File |
|--------|------|------------|
| GET | `/.auth/me` | `webapp/Component.js` L31 |
| GET | `/.auth/me` | `webapp/layout/AppShell.js` L45 |
| GET | `/.auth/me` | `webapp/services/http.js` L28 |

**Total unique frontend endpoint paths: ~35** (excluding auth)

---

## 3. Integration Matrix

### 3.1 ✅ Endpoints Correctly Integrated (backend exists, frontend calls)

| Path | Method | Frontend Source |
|------|--------|---------------|
| `/api/funds/{fund_id}/cash/transactions` | GET | `api/cash.js` |
| `/api/funds/{fund_id}/cash/transactions` | POST | `api/cash.js` |
| `/api/funds/{fund_id}/cash/transactions/{tx_id}/submit-signature` | PATCH | `api/cash.js` |
| `/api/funds/{fund_id}/cash/statements/upload` | POST | `api/cash.js` |
| `/api/funds/{fund_id}/cash/snapshot` | GET | `api/reporting.js` |
| `/api/funds/{fund_id}/documents` | GET | `api/documents.js`, `services/api.js` |
| `/api/funds/{fund_id}/documents/root-folders` | GET | `api/documents.js` |
| `/api/funds/{fund_id}/documents/root-folders` | POST | `api/documents.js` |
| `/api/funds/{fund_id}/documents/upload` | POST | `api/documents.js` |
| `/api/funds/{fund_id}/compliance/me` | GET | `api/compliance.js`, `services/api.js` |
| `/api/funds/{fund_id}/compliance/obligations` | GET | `api/compliance.js` |
| `/api/funds/{fund_id}/compliance/obligations/{id}/workflow/close` | POST | `api/compliance.js` |
| `/api/funds/{fund_id}/compliance/snapshot` | GET | `api/reporting.js` |
| `/api/funds/{fund_id}/ai/retrieve` | POST | `api/copilot.js` |
| `/api/funds/{fund_id}/ai/answer` | POST | `api/copilot.js` |
| `/api/funds/{fund_id}/ai/activity` | GET | `api/copilot.js` |
| `/api/funds/{fund_id}/signatures` | GET | `services/api.js` |
| `/api/funds/{fund_id}/signatures/{id}` | GET | `services/api.js`, `api/signatures.js` |
| `/api/funds/{fund_id}/signatures/{id}/sign` | POST | `services/api.js` |
| `/api/funds/{fund_id}/signatures/{id}/reject` | POST | `services/api.js` |
| `/api/funds/{fund_id}/signatures/{id}/execution-pack` | POST | `services/api.js`, `api/signatures.js` |
| `/api/funds/{fund_id}/reports/archive` | GET | `api/reports.js` |
| `/api/funds/{fund_id}/reports/nav/snapshots` | GET | `api/reports.js` |
| `/api/funds/{fund_id}/reports/nav/snapshots` | POST | `api/reports.js` |
| `/api/funds/{fund_id}/reports/nav/snapshots/{id}` | GET | `api/reports.js` |
| `/api/funds/{fund_id}/reports/nav/snapshots/{id}/finalize` | POST | `api/reports.js` |
| `/api/funds/{fund_id}/reports/nav/snapshots/{id}/publish` | POST | `api/reports.js` |
| `/api/funds/{fund_id}/reports/nav/snapshots/{id}/assets` | POST | `api/reports.js` |
| `/api/funds/{fund_id}/reports/monthly-pack/list` | GET | `api/reports.js` |
| `/api/funds/{fund_id}/reports/monthly-pack/generate` | POST | `api/reports.js` |
| `/api/funds/{fund_id}/reports/monthly-pack/{id}/download` | GET | `api/reports.js` |
| `/api/funds/{fund_id}/reports/investor-statements` | GET | `api/reports.js` |
| `/api/funds/{fund_id}/reports/investor-statements/generate` | POST | `api/reports.js` |
| `/api/funds/{fund_id}/reports/investor-statements/{id}/download` | GET | `api/reports.js` |
| `/api/funds/{fund_id}/reports/evidence-pack` | POST | `api/reporting.js` |

### 3.2 ❌ Backend Endpoints NOT Used by Frontend

These endpoints exist in the backend but have **no corresponding frontend call**:

| Method | Path | Backend Source |
|--------|------|---------------|
| GET | `/api/health` | `main.py` |
| GET | `/api/health/azure` | `main.py` |
| POST | `/admin/dev/seed` | `main.py` |
| GET | `/api/funds/{fund_id}/portfolio/borrowers` | `modules/portfolio/routes.py` |
| POST | `/api/funds/{fund_id}/portfolio/borrowers` | `modules/portfolio/routes.py` |
| GET | `/api/funds/{fund_id}/portfolio/loans` | `modules/portfolio/routes.py` |
| POST | `/api/funds/{fund_id}/portfolio/loans` | `modules/portfolio/routes.py` |
| GET | `/api/funds/{fund_id}/portfolio/covenants` | `modules/portfolio/routes.py` |
| POST | `/api/funds/{fund_id}/portfolio/covenants` | `modules/portfolio/routes.py` |
| POST | `/api/funds/{fund_id}/portfolio/covenant-tests` | `modules/portfolio/routes.py` |
| GET | `/api/funds/{fund_id}/portfolio/breaches` | `modules/portfolio/routes.py` |
| GET | `/api/funds/{fund_id}/portfolio/alerts` | `modules/portfolio/routes.py` |
| POST | `/api/funds/{fund_id}/portfolio/alerts` | `modules/portfolio/routes.py` |
| GET | `/api/funds/{fund_id}/pipeline/deals` | `modules/deals/routes.py` |
| POST | `/api/funds/{fund_id}/pipeline/deals` | `modules/deals/routes.py` |
| PATCH | `/api/funds/{fund_id}/pipeline/deals/{deal_id}/stage` | `modules/deals/routes.py` |
| POST | `/api/funds/{fund_id}/pipeline/deals/{deal_id}/decisions` | `modules/deals/routes.py` |
| POST | `/api/funds/{fund_id}/pipeline/deals/qualification/run` | `modules/deals/routes.py` |
| GET | `/api/funds/{fund_id}/execution/actions` | `modules/actions/routes.py` |
| POST | `/api/funds/{fund_id}/execution/actions` | `modules/actions/routes.py` |
| PATCH | `/api/funds/{fund_id}/execution/actions/{action_id}/status` | `modules/actions/routes.py` |
| POST | `/api/funds/{fund_id}/execution/actions/{action_id}/evidence` | `modules/actions/routes.py` |
| GET | `/api/funds/{fund_id}/compliance/obligations/{obligation_id}` | `modules/compliance/routes.py` |
| GET | `/api/funds/{fund_id}/compliance/obligations/{obligation_id}/evidence` | `modules/compliance/routes.py` |
| POST | `/api/funds/{fund_id}/compliance/obligations/{obligation_id}/evidence/link` | `modules/compliance/routes.py` |
| POST | `/api/funds/{fund_id}/compliance/obligations/{obligation_id}/workflow/mark-in-progress` | `modules/compliance/routes.py` |
| GET | `/api/funds/{fund_id}/compliance/obligations/{obligation_id}/audit` | `modules/compliance/routes.py` |
| POST | `/api/funds/{fund_id}/compliance/obligations` | `modules/compliance/routes.py` |
| GET | `/api/funds/{fund_id}/compliance/obligation-status` | `modules/compliance/routes.py` |
| POST | `/api/funds/{fund_id}/compliance/obligation-status/recompute` | `modules/compliance/routes.py` |
| POST | `/api/funds/{fund_id}/compliance/gaps/recompute` | `modules/compliance/routes.py` |
| GET | `/api/funds/{fund_id}/compliance/gaps` | `modules/compliance/routes.py` |
| POST | `/api/funds/{fund_id}/documents` | `modules/documents/routes.py` |
| POST | `/api/funds/{fund_id}/documents/{document_id}/versions` | `modules/documents/routes.py` |
| GET | `/api/funds/{fund_id}/documents/{document_id}` | `domain/documents/routes/ingest.py` |
| GET | `/api/funds/{fund_id}/documents/{document_id}/versions` | `domain/documents/routes/ingest.py` |
| POST | `/api/funds/{fund_id}/documents/ingestion/process-pending` | `domain/documents/routes/ingest.py` |
| POST | `/api/funds/{fund_id}/ai/query` | `modules/ai/routes.py` |
| GET | `/api/funds/{fund_id}/ai/history` | `modules/ai/routes.py` |
| POST | `/api/funds/{fund_id}/assets` | `domain/portfolio/routes/assets.py` |
| GET | `/api/funds/{fund_id}/alerts` | `domain/portfolio/routes/alerts.py` |
| GET | `/api/funds/{fund_id}/portfolio/actions` | `domain/portfolio/routes/actions.py` |
| PATCH | `/api/funds/{fund_id}/portfolio/actions/{action_id}` | `domain/portfolio/routes/actions.py` |
| POST | `/api/funds/{fund_id}/assets/{asset_id}/fund-investment` | `domain/portfolio/routes/fund_investments.py` |
| GET | `/api/funds/{fund_id}/assets/{asset_id}/fund-investment` | `domain/portfolio/routes/fund_investments.py` |
| POST | `/api/funds/{fund_id}/assets/{asset_id}/obligations` | `domain/portfolio/routes/obligations.py` |
| GET | `/api/funds/{fund_id}/obligations` | `domain/portfolio/routes/obligations.py` |
| PATCH | `/api/funds/{fund_id}/obligations/{obligation_id}` | `domain/portfolio/routes/obligations.py` |
| POST | `/api/funds/{fund_id}/deals` | `domain/deals/routes/deals.py` |
| GET | `/api/funds/{fund_id}/deals` | `domain/deals/routes/deals.py` |
| PATCH | `/api/funds/{fund_id}/deals/{deal_id}/decision` | `domain/deals/routes/deals.py` |
| POST | `/api/funds/{fund_id}/deals/{deal_id}/convert` | `domain/deals/routes/conversion.py` |
| POST | `/api/funds/{fund_id}/deals/{deal_id}/ic-memo` | `domain/deals/routes/ic_memos.py` |
| POST | `/api/funds/{fund_id}/actions` | `domain/actions/routes/actions.py` |
| GET | `/api/funds/{fund_id}/actions` | `domain/actions/routes/actions.py` |
| PATCH | `/api/funds/{fund_id}/actions/{action_id}` | `domain/actions/routes/actions.py` |
| POST | `/api/funds/{fund_id}/evidence/upload-request` | `domain/documents/routes/uploads.py` |
| GET | `/api/funds/{fund_id}/auditor/evidence` | `domain/documents/routes/auditor.py` |
| PATCH | `/api/funds/{fund_id}/evidence/{evidence_id}/complete` | `domain/documents/routes/evidence.py` |
| POST | `/api/funds/{fund_id}/report-packs` | `domain/reporting/routes/report_packs.py` |
| POST | `/api/funds/{fund_id}/report-packs/{pack_id}/generate` | `domain/reporting/routes/report_packs.py` |
| POST | `/api/funds/{fund_id}/report-packs/{pack_id}/publish` | `domain/reporting/routes/report_packs.py` |
| GET | `/api/funds/{fund_id}/investor/report-packs` | `domain/reporting/routes/investor_portal.py` |
| GET | `/api/funds/{fund_id}/reports/nav/snapshots/{snapshot_id}/assets` | `domain/reporting/routes/reports.py` |
| POST | `/api/dataroom/documents` | `domain/dataroom/routes.py` |
| POST | `/api/dataroom/documents/{document_id}/ingest` | `domain/dataroom/routes.py` |
| GET | `/api/dataroom/search` | `domain/dataroom/routes.py` |
| GET | `/api/funds/{fund_id}/cash/transactions/{tx_id}` | `domain/cash_management/routes.py` |
| POST | `/api/funds/{fund_id}/cash/transactions/{tx_id}/submit` | `domain/cash_management/routes.py` |
| PATCH | `/api/funds/{fund_id}/cash/transactions/{tx_id}/mark-executed` | `domain/cash_management/routes.py` |
| PATCH | `/api/funds/{fund_id}/cash/transactions/{tx_id}/mark-reconciled` | `domain/cash_management/routes.py` |
| POST | `/api/funds/{fund_id}/cash/transactions/{tx_id}/approve/director` | `domain/cash_management/routes.py` |
| POST | `/api/funds/{fund_id}/cash/transactions/{tx_id}/approve/ic` | `domain/cash_management/routes.py` |
| POST | `/api/funds/{fund_id}/cash/transactions/{tx_id}/approve` | `domain/cash_management/routes.py` |
| POST | `/api/funds/{fund_id}/cash/transactions/{tx_id}/reject` | `domain/cash_management/routes.py` |
| POST | `/api/funds/{fund_id}/cash/transactions/{tx_id}/generate-instructions` | `domain/cash_management/routes.py` |
| POST | `/api/funds/{fund_id}/cash/transactions/{tx_id}/mark-sent` | `domain/cash_management/routes.py` |
| POST | `/api/funds/{fund_id}/cash/transactions/{tx_id}/mark-executed` | `domain/cash_management/routes.py` |
| GET | `/api/funds/{fund_id}/cash/reconciliation/unmatched` | `domain/cash_management/routes.py` |
| GET | `/api/funds/{fund_id}/cash/statements` | `domain/cash_management/routes.py` |
| GET | `/api/funds/{fund_id}/cash/statements/{statement_id}/lines` | `domain/cash_management/routes.py` |
| POST | `/api/funds/{fund_id}/cash/statements/{statement_id}/lines` | `domain/cash_management/routes.py` |
| POST | `/api/funds/{fund_id}/cash/reconcile` | `domain/cash_management/routes.py` |
| GET | `/api/funds/{fund_id}/cash/reconciliation/report` | `domain/cash_management/routes.py` |
| POST | `/api/funds/{fund_id}/cash/reconciliation/match` | `domain/cash_management/routes.py` |

### 3.3 ⚠ Frontend Calls NOT Present in Backend

**None.** All endpoints called by the frontend exist in the backend.

---

## 4. Infrastructure Findings

### 4.1 Backend Deploy (`deploy-appservice.yml`)

| Check | Status | Detail |
|-------|--------|--------|
| Entrypoint | ✅ OK | `gunicorn app.main:app --worker-class uvicorn.workers.UvicornWorker` |
| Python version | ✅ OK | 3.11 (enforced via `az webapp config set --linux-fx-version "PYTHON|3.11"`) |
| PYTHONPATH | ✅ OK | `/home/site/wwwroot/.python_packages/lib/site-packages` |
| Staging slot | ✅ OK | Deploys to staging first, then swaps to production |
| Health check | ✅ OK | Smoke tests `/health` on staging before swap |
| Rollback | ✅ OK | Automatic slot swap rollback on failure |
| `APIM_SUBSCRIPTION_KEY` | ⚠ NOT SET in workflow | Not referenced as env var in `deploy-appservice.yml`. Must be set manually in App Service Configuration or Key Vault. |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | ✅ OK | Disabled — prebuilt packages deployed via zip |

### 4.2 Frontend Deploy (`azure-static-web-apps-delightful-rock-0af6ec50f.yml`)

| Check | Status | Detail |
|-------|--------|--------|
| App location | ✅ OK | `frontend` |
| Output location | ✅ OK | `dist` |
| API location | ✅ OK | Empty (uses linked backend, not built-in API) |
| SWA proxy for `/api/*` | ✅ OK | `staticwebapp.config.json` allows anonymous access to `/api/*` |
| Linked backend | **Cannot verify from workflow alone** — must be checked in Azure portal (SWA → Backend link to `netz-prod-api`) |

### 4.3 `staticwebapp.config.json`

Two identical copies exist:
- `frontend/webapp/staticwebapp.config.json`
- `frontend/webapp/public/staticwebapp.config.json`

Both define `/api/*` → `allowedRoles: ["anonymous"]`. The SWA proxy would correctly forward relative `/api/*` calls to the linked App Service backend. **However, the ES-module HTTP stack bypasses this proxy entirely.**

---

## 5. Critical Issues

### 🔴 CRITICAL-1: Direct APIM URL in Frontend (PROHIBITED)

| Property | Value |
|----------|-------|
| File | `frontend/webapp/services/env.js` line 2 |
| Violation | Hardcoded `https://netz-prod-api-apim.azure-api.net/api` |
| Impact | **20 API calls** bypass the SWA linked-backend proxy in production |
| Affected modules | `api/cash.js`, `api/documents.js`, `api/compliance.js`, `api/copilot.js`, `api/reporting.js`, `api/signatures.js` |
| Risk | CORS exposure, no SWA auth passthrough, exposes APIM endpoint directly to browser |

**Fix:** Change `getApiBaseUrl()` to always return `"/api"`:

```javascript
// frontend/webapp/services/env.js
export function getApiBaseUrl() {
  return "/api";
}
```

Delete the `APIM_BASE_URL` constant entirely.

### 🔴 CRITICAL-2: Dual HTTP Client Stacks

| Stack | Module | Correct? |
|-------|--------|----------|
| Stack A (SAP AMD) | `services/api.js` | ✅ Uses relative `/api` |
| Stack B (ES module) | `services/http.js` + `services/env.js` | ❌ Uses absolute APIM URL in production |

Both stacks implement `fetchJson`, `postJson`, and error handling independently. This creates:
- Inconsistent routing (reports go through SWA proxy, others bypass it)
- Inconsistent error handling
- Maintenance burden

### 🟡 WARNING-1: `apim_request` Helper Never Used

The backend has a fully implemented APIM proxy helper in `backend/app/core/http/apim_client.py` with:
- Centralized `apim_request()` function
- `Ocp-Apim-Subscription-Key` header injection
- `APIM_SUBSCRIPTION_KEY` env var reading

**However, no route or service module imports or uses it.** Currently the backend is a standalone API server, NOT proxying to any APIM endpoint. The APIM client is dead code.

### 🟡 WARNING-2: Duplicate `mark-executed` Route

In `backend/app/domain/cash_management/routes.py`:
- PATCH `/funds/{fund_id}/cash/transactions/{tx_id}/mark-executed` — writes audit event
- POST `/funds/{fund_id}/cash/transactions/{tx_id}/mark-executed` — does NOT write audit event

Same operation, two methods, inconsistent audit behavior. **Governance concern.**

### 🟡 WARNING-3: Duplicate `staticwebapp.config.json`

Two identical copies exist. Only one is needed — the one that ends up in the build output (`dist/`). The duplicate could cause confusion.

---

## 6. Recommendations

### Priority 1: Fix CRITICAL-1 (Immediate)

**Patch `frontend/webapp/services/env.js`:**

```javascript
// DELETE the APIM_BASE_URL constant
// CHANGE getApiBaseUrl() to always return relative path

export function getApiBaseUrl() {
  return "/api";
}
```

This single change fixes all 20 calls that currently bypass the SWA proxy.

### Priority 2: Consolidate HTTP Stacks

Migrate all ES-module API clients (`api/cash.js`, `api/documents.js`, etc.) to use the same base URL resolution as `services/api.js` (always `"/api"`). Eventually unify into a single HTTP client.

### Priority 3: Resolve `mark-executed` Duplicate

Choose one HTTP method for `mark-executed` (PATCH is semantically correct). Remove the duplicate POST variant. Ensure audit events are emitted consistently.

### Priority 4: Verify SWA ↔ Backend Link

Confirm in Azure Portal that the Static Web App `netz-frontend` has its linked backend set to `netz-prod-api.azurewebsites.net`. This is required for the relative `/api/*` proxy to work.

### Priority 5: Clean Dead Code

Either:
- **Remove** `backend/app/core/http/apim_client.py` if APIM proxy is not needed (the backend IS the API)
- **Or** document its intended use case if APIM proxy will be needed in the future

### Priority 6: Remove Duplicate `staticwebapp.config.json`

Keep only the copy that is included in the `dist/` build output. Remove the other.

### Priority 7: Frontend Endpoint Coverage

71 of ~106 backend endpoints have no frontend consumer. This is expected for endpoints that are:
- Admin/monitoring only (`/health`, `/health/azure`, `/admin/dev/seed`)
- Backend-initiated workflows (`/documents/ingestion/process-pending`)
- Not yet implemented in the UI (portfolio, deals pipeline, dataroom, etc.)

As the frontend matures, corresponding API clients should be added for:
- Portfolio module (borrowers, loans, covenants, breaches, alerts)
- Deals pipeline module (pipeline deals, qualification)
- Actions module (execution actions)
- Dataroom module (document upload, ingest, search)
- Advanced compliance (obligation detail, evidence, audit trail)
- Cash management advanced workflows (approve, reconcile, etc.)

---

## Appendix: Endpoint Flow Architecture

```
    ┌─────────────────────────────┐
    │   Browser (SAP UI5 SPA)     │
    │   netz-frontend (SWA)       │
    └──────────┬──────────────────┘
               │
               │  /api/* (relative)
               │  SWA Linked Backend Proxy
               ▼
    ┌─────────────────────────────┐
    │  netz-prod-api              │
    │  Azure App Service          │
    │  FastAPI (gunicorn+uvicorn) │
    │                             │
    │  All /api/* routes served   │
    │  directly by this service   │
    └──────────┬──────────────────┘
               │
               │ (apim_request — NOT currently used)
               ▼
    ┌─────────────────────────────┐
    │  netz-prod-api-apim         │
    │  Azure API Management       │
    │  (gateway only — no calls   │
    │   from backend currently)   │
    └─────────────────────────────┘
```

**Current state:** The backend serves all endpoints directly. APIM is configured but not actively proxied to by the backend. The frontend SHOULD call the backend via the SWA proxy (`/api/*` relative), but Stack B currently bypasses this and goes directly to APIM.

---

*End of audit report.*
