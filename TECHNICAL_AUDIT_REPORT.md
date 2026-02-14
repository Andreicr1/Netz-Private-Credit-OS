# NETZ PRIVATE CREDIT OS — COMPLETE TECHNICAL AUDIT REPORT

**Date:** 2026-02-14  
**Auditor:** Principal Systems Architect (Automated)  
**Scope:** Full repository, Azure topology, CI/CD, observability  
**Branch:** `main` (HEAD)

---

## 1. EXECUTIVE SUMMARY

**Netz Private Credit OS** is an institutional-grade private credit fund operating system deployed on Azure. The system is **functional in production** with a FastAPI backend (`netz-prod-api`) and a SAP UI5 Web Components frontend (Azure Static Web App). The backend is mature with 27 Alembic migrations, 10 AI engine modules, ~142 API endpoints across 12 domain modules, full audit logging, and RBAC. The frontend is mid-refactoring from legacy SAP UI5 MVC to modern vanilla ES modules with UI5 Web Components.

| Dimension | Score | Status |
|-----------|-------|--------|
| Backend Readiness | **78/100** | Production-deployed, functional, technical debt present |
| Frontend Readiness | **55/100** | Mid-refactor, dual architecture, functional but fragile |
| Azure Integration | **72/100** | Core wiring complete, observability gap, some orphaned artifacts |
| CI/CD Maturity | **82/100** | Mature staging→production pipeline with rollback |
| Observability | **30/100** | Critical gap — no APM SDK, no alerts, logs only via structlog |

**Critical finding:** The system has no Application Insights SDK integrated in the backend code. Azure App Insights is provisioned at the infrastructure level but not instrumented in the application. This is the single most critical operational gap.

---

## 2. BACKEND AUDIT FINDINGS

### 2A. Application Entry Point

| Item | Finding |
|------|---------|
| Entry point | `backend/app/main.py` — `create_app()` factory |
| Framework | FastAPI 0.110+ |
| WSGI/ASGI | Gunicorn + UvicornWorker (production), Uvicorn direct (Docker) |
| Startup command | `cd /home/site/wwwroot/backend && gunicorn app.main:app --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --timeout 120` |

### 2B. Routing Architecture

The API surface has **two registration layers** creating route duplication:

1. **Fund-scoped router** (`/funds/{fund_id}/...`) — modules (portfolio, deals, actions, compliance, documents, AI, signatures)
2. **`/api` prefix alias** — every router is registered twice: once bare, once under `/api`

This dual registration is intentional for Azure SWA linked-backend proxy compatibility but doubles the OpenAPI spec size.

**Route count by domain:**

| Domain | Endpoints | Prefix |
|--------|-----------|--------|
| Portfolio (module) | 10 | `/portfolio` |
| Portfolio (domain) | 7 | `/funds/{fund_id}/assets\|alerts\|obligations\|actions` |
| Deals (module) | 5 | `/pipeline/deals` |
| Deals (domain) | 5 | `/funds/{fund_id}/deals\|ic-memo\|convert` |
| Cash Management | 23 | `/funds/{fund_id}/cash` |
| Compliance | 14 | `/compliance` |
| AI | 24 | `/ai` |
| Actions (module) | 4 | `/execution/actions` |
| Actions (domain) | 3 | `/funds/{fund_id}/actions` |
| Documents (module) | 2 | `/documents` |
| Documents (domain) | 10 | `/documents\|/funds/{fund_id}/evidence\|auditor` |
| Reporting | 18 | `/funds/{fund_id}/report-packs\|reports\|investor` |
| Signatures | 5 | `/signatures` |
| Data Room | 8 | `/api/dataroom\|data-room` |
| Admin/Health | 4 | `/health\|/admin/dev/seed` |
| **TOTAL** | **~142 endpoints** (×2 with `/api` alias) |

### 2C. Internal Modules — Architecture Assessment

The backend has a **dual-layer module system**:

| Layer | Purpose | Pattern | Maturity |
|-------|---------|---------|----------|
| `app/modules/` (7 modules) | Original CRUD layer | models.py + routes.py + schemas.py + service.py | Legacy, complete |
| `app/domain/` (9 domains) | Domain-driven layer | models/ + routes/ + schemas/ + services/ | Modern, complete |
| `ai_engine/` (10 modules) | AI pipeline | Standalone modules with DB models | Complete, production |

**Boundary issue:** Both `modules/` and `domain/` define routes for overlapping concepts (deals, actions, portfolio). The `modules/` layer provides flat CRUD; the `domain/` layer provides fund-scoped, governance-aware endpoints. Both are registered in `main.py`. This creates conceptual duplication but not functional conflict — they serve different URL paths.

**AI Engine completeness:**

| Module | Purpose | Lines | Status |
|--------|---------|-------|--------|
| `document_scanner.py` | Blob scanning + registry | 184 | Complete |
| `classifier.py` | Institutional type classifier | 174 | Complete |
| `doc_classifier.py` | Content-aware classifier | 153 | Complete |
| `authority_resolver.py` | Governance authority | 117 | Complete |
| `knowledge_builder.py` | Manager profile builder | 230 | Complete |
| `obligation_extractor.py` | Regulatory obligation extraction | 197 | Complete |
| `linker.py` | Knowledge graph | 633 | Complete |
| `pipeline_intelligence.py` | Deal discovery | 494 | Complete |
| `portfolio_intelligence.py` | Active investment monitoring | 727 | Complete |
| `monitoring.py` | Daily governance cycle | 205 | Complete |

### 2D. Config & Secrets Management

| Item | Finding | Risk |
|------|---------|------|
| Settings | `backend/app/core/config/settings.py` — Pydantic `BaseSettings` | Clean |
| Root `.env` | Contains only `AZURE_SUBSCRIPTION_ID` and `AZURE_TENANT_ID` | Low (not secrets) |
| Hardcoded secrets | **None found in codebase** | Clean |
| Key Vault | `KEYVAULT_URL` → `DefaultAzureCredential` | Correct |
| DB URL | Key Vault reference via `@Microsoft.KeyVault(SecretUri=...)` in App Service | Correct |
| `AUTHZ_BYPASS_ENABLED` | Default `False`, exists as escape hatch | Governance risk if enabled |
| `APIM_SUBSCRIPTION_KEY` | Read from environment, hard-fail if missing | Correct |

### 2E. Database Layer

| Item | Finding |
|------|---------|
| Database | Azure PostgreSQL Flexible Server v15 (Standard_D2s_v3, 128GB) |
| ORM | SQLAlchemy 2.0+ |
| Migrations | Alembic, 27 migration files (0001→0024 + merge + expand) |
| Connection | `psycopg` (v3) async-capable driver |
| Auto-DDL | `Base.metadata.create_all()` called on engine init — **RISK** |
| Migration env | Supports Key Vault reference resolution for `DATABASE_URL` |
| Audit table | `AuditEvent` with before/after JSON, actor, request_id |

**Migration drift risk:** `create_all()` in `session.py` means the app can create tables outside Alembic control. If a model is added without a migration, production will auto-create the table but Alembic history won't track it. This is a **moderate governance risk**.

**Migration inventory (27 files):**

| Migration | Purpose |
|-----------|---------|
| `0001_initial` | Core tables (Fund, User, UserFundRole, AuditEvent) |
| `0002_portfolio_assets` | Portfolio assets |
| `0003_fund_investments` | Fund investments |
| `0004_asset_obligations` | Asset obligations |
| `0005_alerts_actions` | Alerts and actions |
| `0006_deals_intake` | Deals pipeline |
| `0007_deal_conversion_ic_evidence` | Deal conversion + IC memos |
| `0008_evidence_blob_governance` | Evidence blob governance |
| `0009_monthly_reporting_packs` | Monthly reporting packs |
| `0009b_expand_alembic_version` | Alembic version expansion |
| `0010_dataroom_ingest_cash_management` | Data room ingest + cash management |
| `0011_dataroom_folder_governance` | Data room folder governance |
| `0012_drop_documents_sha_unique` | Drop SHA unique constraint |
| `0013_document_chunks` | Document chunking |
| `0014_document_ingestion_status` | Document ingestion status |
| `0015_ai_answers_audit` | AI answers audit trail |
| `0016_cash_management_expansion` | Cash management expansion |
| `0017_cash_transaction_value_date` | Cash transaction value date |
| `0018_cash_reconciliation_matches` | Cash reconciliation matches |
| `0019_nav_snapshots_and_investor_statements` | NAV snapshots + investor statements |
| `0020_ai_engine_wave_ai1` | AI Engine Wave 1 |
| `0021_ai_engine_wave_ai2` | AI Engine Wave 2 |
| `0022_ai_engine_wave_ai3_pipeline_intelligence` | AI Engine Wave 3: Pipeline Intelligence |
| `0023_ai_engine_wave_ai4_portfolio_intelligence` | AI Engine Wave 4: Portfolio Intelligence |
| `0024_ai_engine_wave_ai5_cross_container_linking` | AI Engine Wave 5: Cross-container linking |
| `70a79686336c_merge_parallel_heads` | Merge parallel heads before prod deploy |

**Current HEAD:** `70a79686336c` (verified in production)

### 2F. AI Integration Layer

| Item | Finding |
|------|---------|
| Client | Azure OpenAI (Foundry Responses API) via `openai>=1.40` SDK |
| Auth | `DefaultAzureCredential` → `cognitiveservices.azure.com` bearer token |
| Model | `gpt-4o` (configurable via `AZURE_OPENAI_MODEL`) |
| Prompt coupling | System prompt stored in `backend/app/domain/ai/prompts/fund_copilot_system.md` |
| AI answers | Persisted to DB with citations, append-only |
| Classification | Keyword/regex-based (no ML models) — deterministic |

**Risk:** The AI engine modules (10 files, ~3,100 lines) perform significant text-based inference (NLP via regex, keyword matching, percentage extraction). This is deterministic but brittle for complex financial documents. No fallback validation exists for extracted obligations or authority levels.

### 2G. Security Review

| Item | Finding | Assessment |
|------|---------|------------|
| Authentication | Multi-layer: DEV header → SWA EasyAuth → Entra JWT | Correct |
| RBAC | `Actor` model with roles: ADMIN, MANAGER, ANALYST, INVESTOR, AUDITOR | Complete |
| CORS | **Not found in codebase** | Not configured (relies on SWA proxy) |
| Fund scoping | `require_fund_access()` dependency | Enforced |
| Write protection | `require_readonly_allowed()` for INVESTOR/AUDITOR | Enforced |
| Dev seed | Protected by `ENV != dev` guard | Correct |
| Audit trail | `AuditEvent` with JSON before/after | Present |
| AUTHZ bypass | `AUTHZ_BYPASS_ENABLED` flag (default `False`) | **Governance risk** — should have kill-switch monitoring |

### Backend Readiness Score: 78/100

**Deductions:**
- Auto-DDL risk (-5)
- Dual-layer module duplication (-5)
- No APM instrumentation (-7)
- AUTHZ bypass flag exists (-3)
- Legacy `core/storage/blob.py` with account keys (-2)

---

## 3. FRONTEND AUDIT FINDINGS

### 3A. Architecture

| Item | Finding |
|------|---------|
| Framework | **Dual**: Legacy SAP UI5 MVC + Modern vanilla ES modules with UI5 Web Components 2.19.1 |
| Build tool | Vite 6.0 |
| Package | `netz-private-credit-os-ui5` v0.0.1 |
| Entry point | `frontend/index.html` → `frontend/main.js` → `AppShell.js` |
| Active app | Modern ES modules (AppShell routing) |
| Legacy app | SAP UI5 MVC (Component.js, App.controller.js, App.view.xml) — **dead code** |
| Theme | SAP Horizon (sap_horizon) |
| Hosting | Azure Static Web App (`delightful-rock-0af6ec50f`) |

### 3B. Folder Structure

| Path | Purpose | Status |
|------|---------|--------|
| `frontend/index.html` | HTML shell | Active |
| `frontend/main.js` | Import hub + AppShell bootstrap | Active |
| `frontend/webapp/layout/` | AppShell.js + SideNavigation.js | Active, modern |
| `frontend/webapp/pages/` | 34 page files (mixed legacy+modern) | **Partially migrated** |
| `frontend/webapp/services/` | apiClient.js, http.js, env.js, api.js | Active, dual (modern+legacy) |
| `frontend/webapp/api/` | 22 domain API modules | Active |
| `frontend/webapp/components/` | AssistantDrawer.js only | Minimal |
| `frontend/webapp/workflows/` | 3 workflow dialogs | Active |
| `frontend/webapp/css/` | Stylesheets | Active |
| `frontend/webapp/i18n/` | 4 locale files (en, pt, pt_BR) | Active |
| `frontend/webapp/model/` | 1 legacy model file | Dead code |
| `frontend/webapp/modules/` | reporting/, signatures/ | Active |
| `frontend/webapp/public/` | Static assets | Active |

### 3C. Page Inventory — Dual Architecture Problem

Of the 34 files in `pages/`:

| Pattern | Count | Example | Status |
|---------|-------|---------|--------|
| Modern `*Page.js` | 16 | `CashManagementPage.js`, `DataroomPage.js` | Active |
| Legacy `.controller.js` | 7 | `Dashboard.controller.js` | Dead code |
| Legacy `.js` (non-Page) | 5 | `Dashboard.js`, `DataRoom.js` | Mixed (some active, some dead) |
| Standalone `.view.xml` | 6 | `Dashboard.view.xml` | Dead code |

**Critical finding:** The modern `AppShell.js` router only references specific page classes. Legacy controller/view files remain in the codebase, inflating complexity and Vite build size. They should be removed.

### 3D. API Consumption Layer

The frontend has a **clean, governance-compliant** API layer:

1. `apiClient.js` — canonical HTTP client (enforces relative `/api` URLs, rejects cross-origin, handles SWA auth)
2. `http.js` — modern ES wrapper
3. `api.js` — legacy SAP UI5 bridge via `window.__NETZ_API_CLIENT__`
4. `frontend/webapp/api/*.js` — 22 domain-specific API modules

**API modules inventory:**

| File | Domain |
|------|--------|
| `actions.js` | Execution actions |
| `adminAudit.js` | Admin audit events |
| `ai.js` | AI / Fund Copilot |
| `alertsDomain.js` | Alerts |
| `assetObligations.js` | Asset obligations |
| `assets.js` | Portfolio assets |
| `auditorEvidence.js` | Auditor evidence |
| `cash.js` | Cash management |
| `compliance.js` | Compliance |
| `copilot.js` | Copilot queries |
| `dataroom.js` | Data room |
| `deals.js` | Deals pipeline |
| `documents.js` | Documents |
| `evidence.js` | Evidence uploads |
| `fundInvestments.js` | Fund investments |
| `investorPortal.js` | Investor portal |
| `portfolio.js` | Portfolio |
| `portfolioActions.js` | Portfolio actions |
| `reporting.js` | Reporting |
| `reportPacksLegacy.js` | Legacy report packs |
| `reports.js` | Reports |
| `signatures.js` | Signatures |

**Governance compliance:** The frontend is a pure presenter. All data is fetched from backend endpoints. No client-side economic calculations, no governance inference, no lifecycle mutations outside explicit backend endpoints.

### 3E. Component Pattern

Modern pages follow a rigorous **4-layer architecture**:

1. **Command Layer** — filters, context controls
2. **Analytical Layer** — KPI cards from backend data
3. **Operational Layer** — data tables with actions
4. **Monitoring Layer** — audit exceptions, governance alerts

Each layer has governance strips that validate data freshness (latency thresholds).

### 3F. Frontend Stability Assessment

| Factor | Assessment |
|--------|------------|
| Refactoring type | **Architectural necessity** — legacy SAP UI5 MVC is dead code |
| Backend contract stability | **Stable** — 142 endpoints deployed, API changes tracked via migrations |
| Safe to continue UI work? | **Yes, conditionally** — clean up dead code first |
| State management | None (stateless page rendering from backend data) |
| Routing | Client-side `pushState` in AppShell.js — functional |

### Frontend Readiness Score: 55/100

**Deductions:**
- Dual architecture dead code (-15)
- 34 mixed page files (-10)
- No component library beyond 1 file (-5)
- No test framework (-10)
- No error boundary (-5)

---

## 4. AZURE INTEGRATION MAP

### 4A. Resource Topology (Verified from Bicep + Code)

```
                   ┌──────────────────────────────┐
                   │  Azure Entra ID (Auth)        │
                   │  Tenant: d0b217c6-...         │
                   └──────────┬───────────────────┘
                              │ OIDC/EasyAuth
                              ▼
┌─────────────────┐    ┌──────────────────────┐    ┌───────────────────────┐
│ netz-frontend   │───▶│ netz-prod-api        │───▶│ netz-prod-postgres    │
│ (Static Web App)│    │ (App Service, Linux)  │    │ (PG Flex, v15, D2s)  │
│ delightful-rock │    │ Python 3.11, S1       │    │ 128GB, eastus         │
│ UI5 WebComp     │    │ Gunicorn+Uvicorn      │    │ DB: netzprod          │
└─────────────────┘    └──────────┬───────────┘    └───────────────────────┘
                              │
                    ┌─────────┼──────────────┐
                    ▼         ▼              ▼
          ┌──────────┐ ┌──────────┐ ┌──────────────────┐
          │ Key Vault│ │ Storage  │ │ AI Search        │
          │ netz-    │ │ netzprod │ │ netz-internacional│
          │ prod-kv  │ │ storage01│ │ -search           │
          │ Secrets  │ │ 3 contnr │ │ fund-documents-   │
          │ DB-URL   │ │ dataroom │ │ index             │
          └──────────┘ │ evidence │ └──────────────────┘
                       │ monthly- │
                       │ reports  │  ┌──────────────────┐
                       └──────────┘  │ Azure OpenAI     │
                                     │ (Netz-AI-Agent)  │
                                     │ gpt-4o           │
          ┌──────────────┐           └──────────────────┘
          │ App Insights │
          │ netz-prod-   │  ┌──────────────────┐
          │ insights     │  │ APIM Gateway     │
          │ + Log        │  │ netz-prod-api-   │
          │ Analytics    │  │ apim             │
          │ 30d ret.     │  │ (outbound only)  │
          └──────────────┘  └──────────────────┘

Resource Group: Netz-International
Subscription: 24c48dc0-9cd8-47f0-9f25-cdd33073b389
Region: eastus
```

### 4B. Connection Assessment

| Connection | Status | Verified |
|------------|--------|----------|
| SWA → App Service (linked backend) | Working | `/api/*` proxy via SWA config |
| App Service → PostgreSQL | Working | Key Vault ref `DATABASE-URL` |
| App Service → Blob Storage | Working | Managed Identity + `DefaultAzureCredential` |
| App Service → Key Vault | Working | Managed Identity access policy |
| App Service → AI Search | Working | Managed Identity |
| App Service → Azure OpenAI | Working | AAD bearer via `cognitiveservices.azure.com` |
| App Service → APIM | Working | Outbound via subscription key |
| App Service → App Insights | **PARTIALLY BROKEN** | Infra key injected but no SDK in code |
| SWA → Entra ID auth | Working | `/.auth/me` endpoint |
| APIM → Backend | Working (outbound client) | `apim_client.py` |

### 4C. Partially Orphaned / Missing Resources

| Resource | Status |
|----------|--------|
| App Insights SDK | **NOT INSTRUMENTED** — `APPINSIGHTS_INSTRUMENTATIONKEY` is set in app settings but no `opencensus`, `opentelemetry`, or `azure-monitor-opentelemetry` in `requirements.txt` or code |
| APIM Gateway | Outbound client exists but APIM itself appears to be used for external calls, not as an API gateway in front of the backend |
| Terraform IaC | Parallel to Bicep — **no compute resources**, appears to be abandoned Phase 1 artifact |
| Legacy `core/storage/blob.py` | Uses account keys — **orphaned**, superseded by `services/azure/blob_client.py` |

### 4D. Blob Storage Containers

The backend references **7 logical containers** for the AI engine document scanner:

| Container | Authority | Scope | Status |
|-----------|-----------|-------|--------|
| `dataroom-investor-facing` | NARRATIVE | EXTERNAL | AI Engine only |
| `fund-constitution-governance` | BINDING | INTERNAL | AI Engine only |
| `regulatory-library-cima` | BINDING | INTERNAL | AI Engine only |
| `service-providers-contracts` | BINDING | INTERNAL | AI Engine only |
| `risk-policy-internal` | POLICY | INTERNAL | AI Engine only |
| `investment-pipeline-intelligence` | INTELLIGENCE | INTERNAL | AI Engine only |
| `portfolio-monitoring-evidence` | EVIDENCE | INTERNAL | AI Engine only |

**Provisioned Blob containers (Bicep):** `dataroom`, `evidence`, `monthly-reports` (3 containers)

**Gap:** The AI engine references 7 containers not provisioned in Bicep. These are either created manually or by the bootstrap script.

---

## 5. CI/CD REVIEW

### 5A. Workflow Inventory

| Workflow | Trigger | Target | Lines |
|----------|---------|--------|-------|
| `deploy-appservice.yml` | `push main` + `workflow_dispatch` | `netz-prod-api` App Service | 369 |
| `azure-static-web-apps-delightful-rock-0af6ec50f.yml` | `push main` + PR lifecycle | `netz-frontend` Static Web App | 48 |

### 5B. Backend Deployment Pipeline (Mature)

Pipeline stages:

1. Build Python deps (pre-compiled wheels for linux x86_64)
2. Create `deploy.zip` (backend/ + .python_packages/)
3. Validate zip structure (Python assertion script)
4. Azure Login (OIDC — federated identity)
5. Ensure staging slot exists
6. Configure Python 3.11 + appsettings (prod + slot)
7. Deploy to staging slot (clean zip deploy)
8. Purge stale Oryx artifacts
9. **Alembic migration gate (staging)** — `alembic upgrade head`
10. Smoke test staging `/health`
11. **Alembic migration gate (production)** — `alembic upgrade head`
12. Configure EasyAuth (SWA client ID)
13. Swap staging → production
14. Smoke test production `/health`
15. **Auto-rollback** if production health fails
16. Upload migration logs on failure

**Strengths:**
- Pre-compiled wheels (no Oryx build)
- Dual migration gate (staging + production)
- Staging slot → swap → rollback pattern
- Zip structure validation
- Concurrency control (`cancel-in-progress: true`)

**Weaknesses:**
- No test execution in CI (tests exist but are not run)
- No linting/type-checking step
- Alembic runs against both staging and prod DB from CI — **risk** if staging migration state diverges
- No integration test between staging health and swap

### 5C. Frontend Deployment Pipeline (Minimal)

Simple Azure SWA deploy action:
- Checkout → Build → Deploy via `Azure/static-web-apps-deploy@v1`
- `app_location: "frontend"`, `output_location: "dist"`
- No build validation step
- No preview environment for PRs (commented out)

### 5D. Secrets Required

| Secret | Used In | Present? |
|--------|---------|----------|
| `AZURE_CLIENT_ID` | OIDC login | Required |
| `AZURE_TENANT_ID` | OIDC login | Required |
| `AZURE_SUBSCRIPTION_ID` | OIDC login | Required |
| `STAGING_DATABASE_URL` | Migration gate | Required |
| `PROD_DATABASE_URL` | Migration gate | Required |
| `AZURE_STATIC_WEB_APPS_API_TOKEN_DELIGHTFUL_ROCK_0AF6EC50F` | SWA deploy | Required |
| `SWA_CLIENT_ID` | EasyAuth config | Required (var) |

### CI/CD Maturity Score: 82/100

**Deductions:**
- No test execution (-8)
- No lint/typecheck (-5)
- Dual DB migration from CI (-5)

---

## 6. OBSERVABILITY REVIEW

### 6A. Current State

| Layer | Implementation | Status |
|-------|---------------|--------|
| Structured logging | `structlog` with JSON output to stdout | **Working** |
| Request tracing | `X-Request-ID` middleware | **Working** |
| Audit events | `AuditEvent` table (before/after JSON) | **Working** |
| APM/Traces | **NOT IMPLEMENTED** | **Critical gap** |
| Azure App Insights | Provisioned (infra) but **no SDK integration** | **Broken** |
| Alerts | **NOT IMPLEMENTED** | **Critical gap** |
| Health endpoints | `/health` (basic) + `/health/azure` (storage, search, foundry, KV) | **Working** |
| Dashboard/Metrics | Not found | **Missing** |

### 6B. What Works

- Structlog JSON logs flow to Azure App Service log stream (stdout)
- Every request gets a `X-Request-ID`
- Governance actions are traced via `AuditEvent` table
- Azure health checks validate 4 service dependencies (storage, search, foundry, keyvault)

### 6C. Critical Gaps

1. **No `opencensus-ext-azure`** or `azure-monitor-opentelemetry` in requirements — App Insights receives **zero** request traces, dependency calls, or exceptions from the application
2. **No alerting rules** — no action groups, no metric alerts, no log-based alerts found in IaC
3. **No custom metrics** — transaction counts, AI query latency, migration execution time are not tracked
4. **Log Analytics retention is 30 days** — may be insufficient for audit compliance

### 6D. Recommendations

| Priority | Action | Impact |
|----------|--------|--------|
| P0 | Add `azure-monitor-opentelemetry` to requirements + configure in `main.py` | Full APM: request traces, dependency tracking, exception reporting |
| P1 | Create Azure Alert Rules for: 5xx rate > 1%, response time > 5s, health check failures | Incident detection |
| P2 | Extend Log Analytics retention to 90+ days | Audit compliance |
| P3 | Add custom metrics for AI engine execution (document count, duration, errors) | Operational visibility |

---

## 7. PRIORITY ACTION PLAN

### 7A. Known Current State Snapshot

**Working Today:**
- FastAPI backend deployed and serving 142+ endpoints
- PostgreSQL with 27 migrations applied (head: `70a79686336c`)
- SWA frontend serving the modern AppShell with 16+ active pages
- Azure Blob Storage with Managed Identity (3 containers)
- Azure AI Search indexing fund documents
- Azure OpenAI (gpt-4o) for Fund Copilot
- CI/CD deploying both backend and frontend on `main` push
- Authentication via Entra ID / SWA EasyAuth
- RBAC with 5 roles (ADMIN, MANAGER, ANALYST, INVESTOR, AUDITOR)
- Full audit trail for governance actions
- AI engine pipeline: scan → classify → resolve → extract → link → monitor

**Partially Working:**
- App Insights (provisioned but not instrumented — no request traces)
- Frontend (functional but carrying ~30% dead code from legacy architecture)
- APIM (outbound client exists but gateway role unclear)
- Terraform IaC (partial, no compute — likely abandoned for Bicep)

**Broken or Placeholder:**
- CORS (not configured — relies entirely on SWA proxy, breaks if backend is called directly)
- `core/storage/blob.py` — legacy SAS/account-key module (orphaned, should be removed)
- Frontend tests — none exist
- Backend tests — exist (25 files) but not executed in CI
- Custom alerting — none

### 7B. TOP 10 PRIORITY FIXES

| Rank | Action | Risk if Deferred | Effort |
|------|--------|-----------------|--------|
| 1 | **Instrument App Insights** — add `azure-monitor-opentelemetry` SDK | Blind in production — no traces, no exception reporting | 2h |
| 2 | **Run tests in CI** — add pytest step to deploy-appservice.yml | Regression risk on every deploy | 1h |
| 3 | **Remove `Base.metadata.create_all()`** from session.py | Tables created outside Alembic control = migration drift | 30m |
| 4 | **Delete legacy frontend files** — *.controller.js, *.view.xml, dead .js pages | Build bloat, developer confusion, false grep hits | 2h |
| 5 | **Add CORS middleware** to FastAPI for non-SWA access paths | Backend inaccessible from any direct client | 30m |
| 6 | **Delete `core/storage/blob.py`** (legacy account-key module) | Security risk — uses account keys instead of Managed Identity | 15m |
| 7 | **Add alerting rules** — 5xx, latency, health check failures | No incident detection | 2h |
| 8 | **Delete Terraform IaC** or document it as deprecated | Confusion between Bicep (active) and Terraform (stale) | 30m |
| 9 | **Add AUTHZ_BYPASS monitoring** — alert if enabled in production | Governance bypass goes undetected | 1h |
| 10 | **Increase Log Analytics retention** to 90 days | Audit trail insufficient for institutional compliance | 15m |

### 7C. RISK FLAGS

| Risk | Impact | Window to Fix |
|------|--------|--------------|
| **No APM instrumentation** | Cannot diagnose production issues, no exception tracking, no dependency monitoring | **Immediate** — every day in production without this is blind |
| **`create_all()` auto-DDL** | A model added without Alembic migration silently creates tables in production, causing migration history desync | Before next model change |
| **AUTHZ_BYPASS flag** | If accidentally enabled via environment variable, all authorization checks are skipped | Before next audit |
| **Dual IaC (Bicep + Terraform)** | Resource drift between two definitions, confusion on which is authoritative | Before any infra changes |
| **No tests in CI** | 25 test files exist but are never run — regressions ship to production | Before next feature |
| **Legacy frontend code** | 18+ dead files consume maintainer attention, create false search results, inflate bundle | Before frontend feature work |
| **AI engine regex inference** | Keyword/regex-based obligation extraction is brittle for complex legal documents — no validation layer | Before AI results are used for compliance decisions |

---

## 8. RECOMMENDED NEXT SPRINT PLAN

**Sprint: "Operational Foundation" (5 working days)**

| Day | Work Item | Owner |
|-----|-----------|-------|
| D1 | Add `azure-monitor-opentelemetry` to backend + configure middleware in `main.py` | Backend |
| D1 | Remove `Base.metadata.create_all()` from `session.py` | Backend |
| D1 | Add `pytest` step to `deploy-appservice.yml` | DevOps |
| D2 | Delete legacy frontend files (18 files: controllers, views, dead pages) | Frontend |
| D2 | Add CORS middleware to FastAPI | Backend |
| D2 | Delete `core/storage/blob.py` | Backend |
| D3 | Deploy + validate App Insights traces in production | DevOps |
| D3 | Create 3 Azure Alert Rules (5xx, latency, health) | DevOps |
| D3 | Delete or archive Terraform directory | DevOps |
| D4 | Add AUTHZ_BYPASS monitoring alert | Backend |
| D4 | Increase Log Analytics retention to 90 days | Infra |
| D4 | Frontend build validation in SWA workflow | Frontend |
| D5 | End-to-end verification: deploy, traces, alerts, tests | All |
| D5 | Write sprint closure memo with before/after evidence | All |

**Exit criteria:**
- App Insights shows request traces from production backend
- CI runs pytest and blocks deploy on failure
- Zero legacy frontend files (*.controller.js, *.view.xml)
- At least 3 Azure Alert Rules firing correctly on simulated failures
- `create_all()` removed from session.py
- Log Analytics retention ≥ 90 days

---

## APPENDIX A: FULL API SURFACE MAP

### A.1 Module Layer (`app/modules/`)

#### Portfolio (`/portfolio`)
| Method | Path | Function |
|--------|------|----------|
| GET | `/portfolio/borrowers` | `list_borrowers` |
| POST | `/portfolio/borrowers` | `create_borrower` |
| GET | `/portfolio/loans` | `list_loans` |
| POST | `/portfolio/loans` | `create_loan` |
| GET | `/portfolio/covenants` | `list_covenants` |
| POST | `/portfolio/covenants` | `create_covenant` |
| POST | `/portfolio/covenant-tests` | `create_covenant_test` |
| GET | `/portfolio/breaches` | `list_breaches` |
| GET | `/portfolio/alerts` | `list_alerts` |
| POST | `/portfolio/alerts` | `create_alert` |

#### Deals (`/pipeline/deals`)
| Method | Path | Function |
|--------|------|----------|
| GET | `/pipeline/deals` | `list_deals` |
| POST | `/pipeline/deals` | `create_deal` |
| PATCH | `/pipeline/deals/{deal_id}/stage` | `patch_deal_stage` |
| POST | `/pipeline/deals/{deal_id}/decisions` | `create_decision` |
| POST | `/pipeline/deals/qualification/run` | `run_qualification` |

#### Compliance (`/compliance`)
| Method | Path | Function |
|--------|------|----------|
| GET | `/compliance/snapshot` | `snapshot` |
| GET | `/compliance/me` | `me` |
| GET | `/compliance/obligations` | `list_obligations` |
| GET | `/compliance/obligations/{id}` | `get_obligation` |
| GET | `/compliance/obligations/{id}/evidence` | `list_evidence` |
| POST | `/compliance/obligations/{id}/evidence/link` | `link_evidence` |
| POST | `/compliance/obligations/{id}/workflow/mark-in-progress` | `mark_in_progress` |
| POST | `/compliance/obligations/{id}/workflow/close` | `close_obligation` |
| GET | `/compliance/obligations/{id}/audit` | `obligation_audit` |
| POST | `/compliance/obligations` | `create_obligation` |
| GET | `/compliance/obligation-status` | `get_obligation_status` |
| POST | `/compliance/obligation-status/recompute` | `recompute_obligation_status` |
| POST | `/compliance/gaps/recompute` | `recompute_gaps` |
| GET | `/compliance/gaps` | `list_gaps` |

#### AI (`/ai`)
| Method | Path | Function |
|--------|------|----------|
| GET | `/ai/activity` | `activity` |
| POST | `/ai/query` | `create_query` |
| GET | `/ai/history` | `history` |
| POST | `/ai/retrieve` | `retrieve` |
| POST | `/ai/answer` | `answer` |
| GET | `/ai/documents/classification` | `classification` |
| GET | `/ai/managers/profile` | `managers_profile` |
| GET | `/ai/obligations/register` | `obligations_register` |
| GET | `/ai/alerts/daily` | `daily_alerts` |
| POST | `/ai/run-daily-cycle` | `run_daily_cycle` |
| POST | `/ai/documents/ingest` | `documents_ingest` |
| POST | `/ai/linker/run` | `linker_run` |
| GET | `/ai/linker/links` | `linker_links` |
| GET | `/ai/linker/obligations/status` | `linker_obligations_status` |
| GET | `/ai/documents/index` | `documents_index` |
| GET | `/ai/documents/{doc_id}` | `document_detail` |
| POST | `/ai/pipeline/ingest` | `pipeline_ingest` |
| GET | `/ai/pipeline/deals` | `pipeline_deals` |
| GET | `/ai/pipeline/deals/{deal_id}` | `pipeline_deal_detail` |
| GET | `/ai/pipeline/alerts` | `pipeline_alerts` |
| POST | `/ai/portfolio/ingest` | `portfolio_ingest` |
| GET | `/ai/portfolio/investments` | `portfolio_investments` |
| GET | `/ai/portfolio/investments/{id}` | `portfolio_investment_detail` |
| GET | `/ai/portfolio/alerts` | `portfolio_alerts` |

#### Actions (`/execution/actions`)
| Method | Path | Function |
|--------|------|----------|
| GET | `/execution/actions` | `list_actions` |
| POST | `/execution/actions` | `create_action` |
| PATCH | `/execution/actions/{id}/status` | `patch_action_status` |
| POST | `/execution/actions/{id}/evidence` | `add_evidence` |

#### Documents (`/documents`)
| Method | Path | Function |
|--------|------|----------|
| POST | `/documents` | `create_document` |
| POST | `/documents/{id}/versions` | `create_document_version` |

#### Signatures (`/signatures`)
| Method | Path | Function |
|--------|------|----------|
| GET | `/signatures` | `list_signature_requests` |
| GET | `/signatures/{id}` | `get_signature_request` |
| POST | `/signatures/{id}/sign` | `sign_request` |
| POST | `/signatures/{id}/reject` | `reject_request` |
| POST | `/signatures/{id}/execution-pack` | `execution_pack` |

### A.2 Domain Layer (`app/domain/`)

#### Assets (`/funds/{fund_id}/assets`)
| Method | Path | Function |
|--------|------|----------|
| POST | `/funds/{fund_id}/assets` | `create_asset` |

#### Fund Investments
| Method | Path | Function |
|--------|------|----------|
| POST | `/funds/{fund_id}/assets/{asset_id}/fund-investment` | `attach_fund_investment` |

#### Obligations
| Method | Path | Function |
|--------|------|----------|
| POST | `/funds/{fund_id}/assets/{asset_id}/obligations` | `create_obligation` |
| GET | `/funds/{fund_id}/obligations` | `list_obligations` |
| PATCH | `/funds/{fund_id}/obligations/{id}` | `update_obligation` |

#### Alerts
| Method | Path | Function |
|--------|------|----------|
| GET | `/funds/{fund_id}/alerts` | `list_alerts` |

#### Portfolio Actions
| Method | Path | Function |
|--------|------|----------|
| GET | `/funds/{fund_id}/portfolio/actions` | `list_actions` |
| PATCH | `/funds/{fund_id}/portfolio/actions/{id}` | `update_action` |

#### Deals (domain)
| Method | Path | Function |
|--------|------|----------|
| POST | `/funds/{fund_id}/deals` | `create_deal` |
| GET | `/funds/{fund_id}/deals` | `list_deals` |
| PATCH | `/funds/{fund_id}/deals/{id}/decision` | `decide_deal` |

#### IC Memos
| Method | Path | Function |
|--------|------|----------|
| POST | `/funds/{fund_id}/deals/{deal_id}/ic-memo` | `create_ic_memo` |

#### Deal Conversion
| Method | Path | Function |
|--------|------|----------|
| POST | `/funds/{fund_id}/deals/{deal_id}/convert` | `convert_deal` |

#### Governed Actions
| Method | Path | Function |
|--------|------|----------|
| POST | `/funds/{fund_id}/actions` | `create_action` |
| GET | `/funds/{fund_id}/actions` | `list_actions` |
| PATCH | `/funds/{fund_id}/actions/{id}` | `update_action` |

#### Evidence Upload
| Method | Path | Function |
|--------|------|----------|
| POST | `/funds/{fund_id}/evidence/upload-request` | `request_evidence_upload` |
| PATCH | `/funds/{fund_id}/evidence/{id}/complete` | `mark_uploaded` |

#### Auditor
| Method | Path | Function |
|--------|------|----------|
| GET | `/funds/{fund_id}/auditor/evidence` | `list_all_evidence` |

#### Document Ingest
| Method | Path | Function |
|--------|------|----------|
| POST | `/documents/upload` | `upload` |
| GET | `/documents` | `list_docs` |
| GET | `/documents/root-folders` | `list_root_folders` |
| GET | `/documents/{id}` | `get_document` |
| GET | `/documents/{id}/versions` | `list_document_versions` |
| POST | `/documents/root-folders` | `create_root_folder` |
| POST | `/documents/ingestion/process-pending` | `process_pending` |

#### Report Packs
| Method | Path | Function |
|--------|------|----------|
| POST | `/funds/{fund_id}/report-packs` | `create_pack` |
| POST | `/funds/{fund_id}/report-packs/{id}/generate` | `generate_pack` |
| POST | `/funds/{fund_id}/report-packs/{id}/publish` | `publish_pack` |

#### Reports (NAV, Monthly, Investor Statements)
| Method | Path | Function |
|--------|------|----------|
| POST | `/funds/{fund_id}/reports/nav/snapshots` | `create_nav_snapshot` |
| GET | `/funds/{fund_id}/reports/nav/snapshots` | list snapshots |
| GET | `/funds/{fund_id}/reports/nav/snapshots/{id}` | get snapshot |
| POST | `/funds/{fund_id}/reports/nav/snapshots/{id}/finalize` | finalize |
| POST | `/funds/{fund_id}/reports/nav/snapshots/{id}/publish` | publish |
| POST | `/funds/{fund_id}/reports/nav/snapshots/{id}/assets` | add asset valuation |
| GET | `/funds/{fund_id}/reports/nav/snapshots/{id}/assets` | list asset valuations |
| POST | `/funds/{fund_id}/reports/monthly-pack/generate` | generate monthly pack |
| GET | `/funds/{fund_id}/reports/monthly-pack/list` | list monthly packs |
| GET | `/funds/{fund_id}/reports/monthly-pack/{id}/download` | download pack |
| POST | `/funds/{fund_id}/reports/investor-statements/generate` | generate statements |
| GET | `/funds/{fund_id}/reports/investor-statements` | list statements |
| GET | `/funds/{fund_id}/reports/investor-statements/{id}/download` | download statement |
| GET | `/funds/{fund_id}/reports/archive` | list historical |
| POST | `/funds/{fund_id}/reports/evidence-pack` | export evidence pack |

#### Investor Portal
| Method | Path | Function |
|--------|------|----------|
| GET | `/funds/{fund_id}/investor/report-packs` | `list_published_packs` |

#### Data Room
| Method | Path | Function |
|--------|------|----------|
| POST | `/api/dataroom/documents` | `upload_document` |
| POST | `/api/dataroom/documents/{id}/ingest` | `ingest_document` |
| GET | `/api/dataroom/search` | `search` |
| GET | `/api/dataroom/browse` | `browse` |
| GET | `/api/data-room/tree` | `get_tree` |
| GET | `/api/data-room/list` | `list_items` |
| GET | `/api/data-room/file-link` | `file_link` |
| POST | `/api/data-room/upload` | `upload_to_path` |

#### Cash Management (`/funds/{fund_id}/cash`)
| Method | Path | Function |
|--------|------|----------|
| GET | `/cash/snapshot` | `snapshot` |
| GET | `/cash/transactions` | list transactions |
| GET | `/cash/transactions/{id}` | get transaction |
| POST | `/cash/transactions` | create transaction |
| POST | `/cash/transactions/{id}/submit` | submit |
| PATCH | `/cash/transactions/{id}/submit-signature` | submit signature |
| PATCH | `/cash/transactions/{id}/mark-executed` | mark executed |
| PATCH | `/cash/transactions/{id}/mark-reconciled` | mark reconciled |
| POST | `/cash/transactions/{id}/approve/director` | director approve |
| POST | `/cash/transactions/{id}/approve/ic` | IC approve |
| POST | `/cash/transactions/{id}/approve` | generic approve |
| POST | `/cash/transactions/{id}/reject` | reject |
| POST | `/cash/transactions/{id}/generate-instructions` | generate instructions |
| POST | `/cash/transactions/{id}/mark-sent` | mark sent |
| POST | `/cash/statements/upload` | upload bank statement |
| GET | `/cash/reconciliation/unmatched` | unmatched lines |
| GET | `/cash/statements` | list statements |
| GET | `/cash/statements/{id}/lines` | list lines |
| POST | `/cash/statements/{id}/lines` | add line |
| POST | `/cash/reconcile` | auto reconcile |
| GET | `/cash/reconciliation/report` | reconciliation report |
| POST | `/cash/reconciliation/match` | manual match |

---

## APPENDIX B: BACKEND TEST INVENTORY

25 test files exist in `backend/tests/`:

| File | Domain |
|------|--------|
| `test_health.py` | Health endpoint |
| `test_deals.py` | Deals |
| `test_fund_investments.py` | Fund investments |
| `test_fund_scoping.py` | Fund access scoping |
| `test_obligations.py` | Obligations |
| `test_alerts_actions.py` | Alerts & actions |
| `test_compliance_obligation_workflow.py` | Compliance workflow |
| `test_compliance_gap_creates_obligation.py` | Compliance gaps |
| `test_signatures_workflow.py` | Signatures |
| `test_conversion.py` | Deal conversion |
| `test_document_chunk_ingestion.py` | Document chunking |
| `test_bootstrap_dataroom_ingest.py` | Data room bootstrap |
| `test_dataroom_folder_governance.py` | Data room governance |
| `test_ai_retrieval_endpoint.py` | AI retrieval |
| `test_ai_answers_persisted_append_only.py` | AI answer persistence |
| `test_ai_answer_requires_citations.py` | AI citation enforcement |
| `test_cash_management.py` | Cash management |
| `test_cash_reconciliation_manual_match.py` | Cash reconciliation |
| `test_reporting_archive.py` | Reporting archive |
| `test_reporting_monthly_pack_generation.py` | Monthly pack generation |
| `test_reporting_nav_snapshots.py` | NAV snapshots |
| `test_reporting_pack_lifecycle.py` | Report pack lifecycle |
| `test_action_evidence_block.py` | Action evidence governance |
| `test_auditor_scope_restricted.py` | Auditor restrictions |
| `test_apim_client.py` | APIM client |
| `test_azure_clients.py` | Azure service clients |

**None of these are executed in CI.**

---

## APPENDIX C: FRONTEND PAGE INVENTORY

| # | File | Type | Status |
|---|------|------|--------|
| 1 | `ActionsPage.js` | Modern | Active |
| 2 | `AdminAuditPage.js` | Modern | Active |
| 3 | `AiPage.js` | Modern | Active |
| 4 | `AlertsPage.js` | Modern | Active |
| 5 | `AssetObligationsPage.js` | Modern | Active |
| 6 | `AssetsPage.js` | Modern | Active |
| 7 | `AuditorEvidencePage.js` | Modern | Active |
| 8 | `CashManagement.controller.js` | Legacy | Dead code |
| 9 | `CashManagement.js` | Legacy | Dead code |
| 10 | `CashManagement.view.xml` | Legacy | Dead code |
| 11 | `CashManagementPage.js` | Modern | Active |
| 12 | `Compliance.controller.js` | Legacy | Dead code |
| 13 | `Compliance.js` | Legacy | Dead code |
| 14 | `Compliance.view.xml` | Legacy | Dead code |
| 15 | `CompliancePage.js` | Modern | Active |
| 16 | `Dashboard.controller.js` | Legacy | Dead code |
| 17 | `Dashboard.js` | Modern | Active |
| 18 | `Dashboard.view.xml` | Legacy | Dead code |
| 19 | `DataRoom.controller.js` | Legacy | Dead code |
| 20 | `DataRoom.js` | Legacy | Dead code |
| 21 | `DataRoom.view.xml` | Legacy | Dead code |
| 22 | `DataroomPage.js` | Modern | Active |
| 23 | `DealsPipelinePage.js` | Modern | Active |
| 24 | `DocumentsPage.js` | Modern | Active |
| 25 | `EvidencePage.js` | Modern | Active |
| 26 | `FundCopilot.controller.js` | Legacy | Dead code |
| 27 | `FundCopilot.js` | Legacy | Dead code |
| 28 | `FundCopilot.view.xml` | Legacy | Dead code |
| 29 | `FundInvestmentPage.js` | Modern | Active |
| 30 | `InvestorPortalPage.js` | Modern | Active |
| 31 | `NavAssetsPage.js` | Modern | Active |
| 32 | `ObligationDetail.controller.js` | Legacy | Dead code |
| 33 | `ObligationDetail.view.xml` | Legacy | Dead code |
| 34 | `PortfolioActionsPage.js` | Modern | Active |
| 35 | `PortfolioPage.js` | Modern | Active |
| 36 | `Reporting.controller.js` | Legacy | Dead code |
| 37 | `Reporting.js` | Legacy | Dead code |
| 38 | `Reporting.view.xml` | Legacy | Dead code |
| 39 | `ReportingPage.js` | Modern | Active |
| 40 | `ReportPacksLegacyPage.js` | Modern | Active |
| 41 | `SignaturesPage.js` | Modern | Active |

**Legacy files to remove:** 18 files (7 controllers, 6 XML views, 5 legacy JS)

---

*End of audit report. All findings based on repository evidence at commit HEAD of `main` branch, 2026-02-14.*
