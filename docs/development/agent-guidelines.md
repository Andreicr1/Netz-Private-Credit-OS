# NETZ PRIVATE CREDIT OS — AI AGENT GUIDELINES
Status: Institutional Development Protocol  
Scope: All AI agents interacting with this repository  
Applies to: Backend, Frontend, Infrastructure, CI/CD  

---

## 1. PURPOSE

This document defines mandatory behavioral rules for any AI agent assisting in the development of Netz Private Credit OS.

Netz OS is an institutional-grade governance platform and a strategic technological asset of the group.

Agents must operate with production-grade discipline.

---

## 2. NON-NEGOTIABLE PRINCIPLES

### 2.1 No Schema Drift

Database schema changes MUST occur exclusively through Alembic migrations.

Forbidden:
- `Base.metadata.create_all()` in production
- Auto-DDL table creation
- Direct database modification without migration script

If proposing model changes:
- Generate migration
- Validate upgrade path
- Preserve backward compatibility

---

### 2.2 Observability First

No backend modification is acceptable without preserving:

- Application Insights instrumentation
- Request tracing
- Dependency tracking
- Exception visibility

Agents must not remove telemetry configuration.

If adding new external dependency calls:
- Ensure they are traceable.

---

### 2.3 Backend is Source of Truth

The frontend is a presenter layer only.

Forbidden in frontend:
- Governance inference
- Economic calculations
- Permission logic
- Business rules duplication

All mutations must occur via explicit backend endpoints.

---

### 2.4 RBAC Integrity

RBAC roles:
- ADMIN
- MANAGER
- ANALYST
- INVESTOR
- AUDITOR

Agents must:
- Preserve fund-scoped access boundaries
- Never bypass `require_fund_access()`
- Never silently enable `AUTHZ_BYPASS_ENABLED`

If proposing access changes:
- Document role impact explicitly.

---

### 2.5 No Silent Security Regression

Agents must not:

- Introduce hardcoded secrets
- Use storage account keys if Managed Identity exists
- Disable authentication middleware
- Remove CORS protections without justification

All security-impacting changes must be explicitly documented.

---

## 3. FRONTEND RULES

### 3.1 Single Architecture Only

Legacy SAP UI5 MVC artifacts must not be reintroduced.

Frontend must remain:
- Modern ES modules
- UI5 Web Components based
- API-driven

No mixed architecture allowed.

---

### 3.2 API Consumption Discipline

All frontend API calls must:

- Use the canonical API client
- Use relative `/api` paths
- Respect SWA auth model

No cross-origin calls directly to App Service.

---

### 3.3 No Client-Side Authority

Authority resolution, compliance logic, and lifecycle mutations belong exclusively to backend services.

---

## 4. AI ENGINE DISCIPLINE

The AI engine includes deterministic classification and governance workflows.

Agents must:

- Preserve auditability
- Store AI outputs when required
- Avoid hidden inference layers
- Avoid non-deterministic logic in compliance-critical paths

If proposing AI changes:
- Define validation strategy
- Define confidence scoring
- Define failure handling

---

## 5. CI/CD RULES

Agents modifying CI/CD must:

- Preserve staging → swap → rollback pattern
- Never remove migration gates
- Never deploy directly to production without staging validation
- Ensure tests run before deploy

---

## 6. INFRASTRUCTURE RULES

Canonical IaC: Bicep

If Terraform artifacts exist:
- Treat as deprecated unless explicitly revived.

Agents must not introduce parallel infrastructure definitions.

---

## 7. CHANGE PROPOSAL FORMAT

When proposing structural changes, agents must specify:

1. What layer is affected (Backend / Frontend / Infra)
2. Security impact
3. Migration impact
4. Observability impact
5. Rollback strategy

---

## 8. OUT OF SCOPE (FOR NOW)

The distributed Investor Data Room product is out of scope and will be developed in a separate repository.

The current Data Room module remains internal-only.

Agents must not attempt to externalize it.

---

## 9. INSTITUTIONAL STANDARD

The definition of acceptable change:

- Observable
- Auditable
- Reversible
- Governance-safe
- Compatible with production

If a proposed change weakens any of the above, it must be rejected.

---

End of Agent Guidelines.
