# NETZ PRIVATE CREDIT OS — ARCHITECTURE OVERVIEW
Status: Institutional Architecture Baseline  
Date: 2026-02-14  
Scope: Control Plane (Internal OS)

---

## 1. PLATFORM IDENTITY

Netz Private Credit OS is an institutional-grade operating system designed for private credit fund governance.

It functions as the Control Plane of the group’s credit operations, integrating:

- Portfolio oversight
- Deal lifecycle management
- Cash management workflows
- Compliance enforcement
- Institutional reporting
- AI-assisted governance intelligence

This document defines the structural architecture of the system.

---

## 2. HIGH-LEVEL ARCHITECTURE

### 2.1 Logical Layers

The platform is structured into five primary layers:

1. Presentation Layer (Frontend)
2. API Layer (FastAPI)
3. Domain & Governance Layer
4. Data & Persistence Layer
5. Infrastructure & Observability Layer

---

### 2.2 Topology Overview

Frontend (Azure Static Web App)
        ↓
FastAPI Backend (Azure App Service)
        ↓
Domain Services + AI Engine
        ↓
PostgreSQL (Azure Flexible Server)
Azure Blob Storage
Azure Cognitive Search
Azure OpenAI
        ↓
Application Insights + Log Analytics

---

## 3. FRONTEND ARCHITECTURE

### 3.1 Framework

- Modern ES Modules
- UI5 Web Components
- Vite build system
- Client-side routing via AppShell

### 3.2 Architectural Principles

- Single-architecture only (no legacy SAP UI5 MVC)
- No business logic in frontend
- No governance inference client-side
- All mutations via backend endpoints

The frontend acts strictly as a presenter layer.

---

## 4. BACKEND ARCHITECTURE

### 4.1 Framework

- FastAPI (Python 3.11)
- Gunicorn + UvicornWorker (production)
- SQLAlchemy 2.x
- Alembic migrations

### 4.2 Layering

Backend modules are organized into:

- app/modules/ (legacy CRUD layer)
- app/domain/ (fund-scoped domain-driven layer)
- ai_engine/ (governance intelligence layer)
- infra/ (Azure integrations, telemetry)

### 4.3 API Surface

~140+ endpoints across domains:

- Portfolio
- Deals
- Cash Management
- Compliance
- Reporting
- Documents
- Signatures
- AI
- Data Room (internal only)

All write operations are audited.

---

## 5. DATA & GOVERNANCE

### 5.1 Database

- Azure PostgreSQL Flexible Server (v15)
- 27+ Alembic migrations
- No auto-DDL in production
- Immutable audit trail (AuditEvent table)

Schema evolution is strictly migration-based.

### 5.2 RBAC Model

Roles:

- ADMIN
- MANAGER
- ANALYST
- INVESTOR
- AUDITOR

Access is fund-scoped and enforced via dependencies.

---

## 6. AI ENGINE

The AI layer includes:

- Document scanning
- Classification
- Obligation extraction
- Authority resolution
- Knowledge graph linking
- Portfolio intelligence monitoring

Principles:

- Deterministic where required
- Auditable outputs
- Persisted responses
- No silent governance inference

---

## 7. INFRASTRUCTURE

### 7.1 Azure Resources

- Azure Static Web App (frontend)
- Azure App Service (backend)
- Azure PostgreSQL
- Azure Key Vault
- Azure Blob Storage
- Azure Cognitive Search
- Azure OpenAI
- Azure Application Insights
- Azure API Management (outbound usage)

### 7.2 Identity

- Entra ID authentication
- SWA EasyAuth
- Managed Identity for Azure services

No hardcoded secrets permitted.

---

## 8. OBSERVABILITY

The system must maintain:

- OpenTelemetry instrumentation
- Application Insights traces
- Dependency tracking
- Exception visibility
- Alert rules (5xx, latency, health)

Operating without telemetry is considered non-institutional.

---

## 9. CURRENT SCOPE

This architecture describes the internal Control Plane only.

The distributed Investor Data Room product will be developed in a separate repository and is out of scope for this document.

---

End of Architecture Overview.
