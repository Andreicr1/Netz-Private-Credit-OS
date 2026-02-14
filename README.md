# Netz Private Credit OS

Institutional-grade operating system for private credit governance.

---

## Overview

Netz Private Credit OS is the internal Control Plane of the group’s credit operations.

It provides an institutional operating layer for:

- Portfolio governance
- Deal lifecycle management
- Cash workflows
- Compliance monitoring
- Institutional reporting
- AI-assisted intelligence cycles

The platform is deployed on Microsoft Azure and engineered under strict governance, audit, and operational discipline.

This repository represents the authoritative system of record for the internal Control Plane.

---

## Architecture

### Core Stack

- **Frontend**: Azure Static Web App  
  - UI5 Web Components  
  - ES Modules  
  - Institutional Layout System (FCL + Multi-Instance)

- **Backend**: FastAPI (Python 3.11)

- **Database**: Azure PostgreSQL Flexible Server  
  - Alembic-managed schema  
  - No auto-DDL

- **Storage**: Azure Blob Storage (Managed Identity)

- **Search**: Azure Cognitive Search

- **AI**: Azure OpenAI (Foundry Responses API)

- **Observability**: Azure Application Insights  
  - OpenTelemetry instrumentation  
  - Dependency tracking  
  - Exception monitoring  

---

## Frontend Layout System

The UI follows a formal institutional layout constitution.

### Entity Modules (FCL — 3 Column Standard)

Used for:

- Portfolio
- Deals
- Signatures

Structure:

- **Begin Column** → Entity List  
- **Mid Column** → Object Page  
- **End Column** → Contextual Sub-detail  

No dashboard or board semantics allowed.

### Multi-Instance Modules (4-Layer Standard)

Used for:

- Cash
- Compliance
- Reporting

Structure:

1. Command  
2. Analytical  
3. Operational  
4. Monitoring  

Layer mixing is prohibited.

See:

- `docs/architecture/frontend-layout-constitution.md`

---

## Governance Model

The system enforces strict institutional governance:

- All schema changes via **Alembic migrations**
- No `create_all()` or auto-DDL in production
- Full **audit trail** for governance actions
- RBAC-enforced fund boundaries
- Telemetry-first deployment discipline
- No global prompt governance outside the repository

Authoritative governance documents:

- `docs/architecture/NETZ-OS-Technical-Constitution-v1.md`
- `docs/architecture/frontend-layout-constitution.md`
- `docs/development/agent-guidelines.md`

---

## Observability

The backend is instrumented using Azure Monitor OpenTelemetry.

Production requirements:

- Application Insights request tracing
- Dependency monitoring (Postgres, Search, OpenAI)
- Exception capture
- Structured JSON logging

Observability is not optional.

---

## Development Discipline

All development must follow:

- `docs/development/development-playbook.md`
- `docs/development/agent-guidelines.md`

Rules:

- No business logic in frontend
- No backend vocabulary exposed in UI
- No schema mutation outside Alembic
- No governance artifacts outside version control

---

## Scope

This repository contains:

✔ Internal Control Plane  
✔ Internal Data Room page (internal consumption only)

This repository does NOT contain:

✖ Distributed Investor Data Room product  
✖ External investor-facing distribution system  

A separate repository will govern the distributed Data Room product.

---

## Deployment

- Active production deployment on Azure
- CI/CD via GitHub Actions
- Staging → production swap model
- Migration gates enforced

---

## Status

Production — actively maintained.

---

End.
