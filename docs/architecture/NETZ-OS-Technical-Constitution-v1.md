# NETZ PRIVATE CREDIT OS — TECHNICAL CONSTITUTION v1
Date: 2026-02-14  
Status: Foundational Asset Document  
Scope: Control Plane Only (Internal OS)

---

## 1. PLATFORM IDENTITY

Netz Private Credit OS is an institutional-grade operating system for private credit fund governance.

It is a strategic technological asset of the group.

The platform is designed as a Control Plane for:

- Portfolio governance
- Deal execution workflows
- Compliance enforcement
- Institutional reporting
- AI-assisted operating cycles

---

## 2. ARCHITECTURE INVARIANTS (NON-NEGOTIABLE)

### 2.1 Database Governance
All schema evolution MUST occur via Alembic migrations.

Forbidden:

- `Base.metadata.create_all()`
- Auto-DDL creation in production

---

### 2.2 Observability First
No production deployment is acceptable without:

- Application Insights instrumentation
- Request tracing
- Dependency tracking
- Exception visibility
- Basic alert rules

Operating without APM is considered blind execution.

---

### 2.3 Control Plane Scope
The current system is internal-only.

Investor-distributed Data Room is OUT OF SCOPE and will be developed in a separate repository.

The existing Data Room module remains an internal page only.

---

### 2.4 Security & Governance
The platform enforces:

- Entra ID authentication (SWA EasyAuth + JWT)
- RBAC with roles:
  ADMIN, MANAGER, ANALYST, INVESTOR, AUDITOR
- Fund-scoped access boundaries
- Immutable audit logging for governance actions

AUTHZ bypass mechanisms must be monitored and never silently enabled.

---

### 2.5 Frontend Architectural Unity
The frontend must remain single-architecture.

Legacy SAP UI5 MVC artifacts must be removed.

The UI is a presenter layer only:

- No client-side governance inference
- No economic calculations outside backend
- No mutation outside explicit API workflows

---

## 3. DEVELOPMENT PRIORITIES (2026)

Phase 1 — Operational Hardening  
- App Insights instrumentation  
- CI test execution  
- Schema drift elimination  

Phase 2 — Frontend Simplification  
- Legacy purge  
- Completion of ES module migration  

Phase 3 — AI Governance Robustness  
- Validation layers  
- Confidence scoring  
- Operational metrics  

Phase 4 — External Investor Plane (Separate Repo)  
- Distributed Data Room product  
- Snapshot + watermarking  
- Read-only API boundary  

---

## 4. DEFINITION OF INSTITUTIONAL READINESS

Netz OS is considered institutionally ready when:

- Traces are visible in App Insights
- Alerts fire on failure simulation
- CI runs tests before deploy
- Database is Alembic-governed only
- Frontend has zero legacy dead code
- Governance actions are fully auditable

---

End of Constitution v1.
