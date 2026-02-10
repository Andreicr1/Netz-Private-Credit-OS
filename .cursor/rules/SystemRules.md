SYSTEM PRINCIPLES

You are building an audit-ready, multi-tenant Credit Fund Portfolio Operating System.

This is NOT a loan management system.

The portfolio must support multiple asset classes typical of a private equity style credit fund:

Direct Loans

Fund Investments (FoF / commitments)

Equity Stakes in Credit Platforms

SPV Notes / Structured Credit

Warehouse Facilities

Preferred Equity

Derivatives / Hedges

The system must remain asset-first forever.

CORE DOMAIN CANONICAL MODEL
PortfolioAsset is the single source of truth

All investments must be represented as:

PortfolioAsset


No module is allowed to assume that the portfolio consists only of loans.

Loans, funds, equity positions, SPVs are extensions of the base asset.

MANDATORY ARCHITECTURE RULES
1. Fund Scoping is Non-Negotiable

Every domain route must be fund-scoped:

/funds/{fund_id}/...


No global endpoints.

All queries must enforce:

fund_id isolation

RBAC role validation

2. Asset-First Design

Never build features directly on Loan.

Always build on:

PortfolioAsset

AssetObligation

Alerts

Actions

Loans are only one subtype.

3. Obligation Engine (Not Covenant Engine)

Monitoring is obligation-based, not loan-based.

Examples:

Loan → covenant test due monthly

Fund Investment → NAV report due quarterly

Equity Stake → board reporting due monthly

SPV Note → collateral verification due weekly

Obligations generate alerts and actions.

4. Audit Trail is Institutional

Every create/update/decision must write an audit event:

actor

entity_type

entity_id

before/after

request_id

Auditors must be able to reconstruct:

what happened

when

who approved

what evidence exists

5. Multi-Tenant + Multi-Role by Default

Roles:

ADMIN

COMPLIANCE

INVESTMENT_TEAM

OPERATIONS

AUDITOR

INVESTOR_READONLY

No endpoint should assume a single user type.

6. Evidence & Documents are First-Class

Every Action may require:

uploaded evidence document

versioned metadata

timestamp + responsible party

Documents must integrate with Azure Blob Storage later.

7. Backend is the Source of Truth

Frontend is only a projection.

All business logic lives in backend services.

No “UI-driven state”.

8. Implementation Style

FastAPI + SQLAlchemy typed models

Alembic migrations required for all schema changes

Pagination required for list endpoints

Deterministic enums, no free-text statuses

Tests required for scoping + RBAC

✅ BACKEND IMPLEMENTATION PLAN (Asset-First)

Agora o roadmap técnico, já em ordem correta.

EPIC 1 — Portfolio Asset Core (Foundation)
Goal

Introduce PortfolioAsset as the canonical investment object.

Deliverables
Database

Create table:

portfolio_assets (
  id UUID PK,
  fund_id UUID FK,
  asset_type ENUM,
  strategy ENUM,
  name TEXT,
  status ENUM,
  currency TEXT,
  commitment_amount NUMERIC,
  invested_amount NUMERIC,
  fair_value NUMERIC,
  risk_rating TEXT,
  inception_date DATE,
  created_at TIMESTAMP
)

Enums

AssetType:

DIRECT_LOAN

FUND_INVESTMENT

EQUITY_STAKE

SPV_NOTE

WAREHOUSE_LINE

PREFERRED_EQUITY

DERIVATIVE_HEDGE

StrategyType:

CORE_DIRECT_LENDING

SPECIAL_SITUATIONS

FUND_SECONDARIES

PLATFORM_EQUITY

STRUCTURED_CREDIT

API

Endpoints:

POST /funds/{fund_id}/assets

GET /funds/{fund_id}/assets

GET /funds/{fund_id}/assets/{asset_id}

PATCH /funds/{fund_id}/assets/{asset_id}

Audit Events

asset.created

asset.updated

EPIC 2 — Asset Extensions (Loans, Funds, Equity)
Goal

Support subtype-specific fields without breaking asset-first.

Tables
loans
loans (
  asset_id UUID PK FK portfolio_assets,
  borrower_id UUID,
  maturity_date DATE,
  interest_rate NUMERIC
)

fund_investments
fund_investments (
  asset_id UUID PK,
  manager_name TEXT,
  reporting_frequency ENUM,
  nav_source TEXT
)

equity_positions
equity_positions (
  asset_id UUID PK,
  company_name TEXT,
  ownership_pct NUMERIC,
  governance_rights TEXT
)

Rule

Subtype endpoints must always require asset_id.

EPIC 3 — Obligation Engine (Universal Monitoring)
Goal

Replace covenant-only logic with obligation-based governance.

Table
asset_obligations (
  id UUID PK,
  asset_id UUID FK,
  obligation_type ENUM,
  due_date DATE,
  frequency ENUM,
  responsible_role ENUM,
  status ENUM
)


ObligationType examples:

COVENANT_TEST

NAV_REPORT

BOARD_REPORT

COLLATERAL_REVIEW

VALUATION_UPDATE

API

POST /funds/{fund_id}/assets/{asset_id}/obligations

GET /funds/{fund_id}/obligations?status=open

EPIC 4 — Alerts + Actions Execution Layer
Goal

Operational workflow.

Obligation missed → Alert → Action required.

Actions become the “work engine” of the fund.

EPIC 5 — Deal Intake (“Esteira de Análise”)
Goal

All opportunities enter through structured intake.

Key:

deal_type → maps to asset_type

qualification rules by type

rejection reasons mandatory

EPIC 6 — Compliance Module (CIMA + Auditor Ready)

Fund-level obligations + reporting calendar.

EPIC 7 — Documents + Evidence + Blob Integration

Evidence linked to Actions + Audit events.