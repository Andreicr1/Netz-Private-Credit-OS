# NETZ PRIVATE CREDIT OS — DEVELOPMENT PLAYBOOK
Status: Institutional Development Protocol  
Scope: Backend, Frontend, Infrastructure

---

## 1. PURPOSE

This playbook defines how features are built without compromising governance, observability, or institutional integrity.

All contributors must follow this protocol.

---

## 2. FEATURE DEVELOPMENT FLOW

### Step 1 — Define Scope

For every feature:

- Identify affected layer (Frontend / Backend / Infra)
- Identify RBAC impact
- Identify migration requirements
- Identify observability impact

No code before scope clarity.

---

### Step 2 — Backend First

If the feature involves business logic:

1. Implement domain service.
2. Add endpoint.
3. Add migration (if schema changes).
4. Add tests.
5. Validate telemetry.

Frontend comes last.

---

### Step 3 — Database Discipline

All model changes require:

- Alembic migration
- Upgrade validation
- Downgrade validation (if applicable)

Never introduce schema changes outside migrations.

---

### Step 4 — Telemetry Verification

After implementing a feature:

- Trigger endpoint locally
- Confirm request appears in App Insights
- Confirm dependencies are traced
- Confirm exceptions are captured

No blind features.

---

## 3. FRONTEND DEVELOPMENT RULES

### 3.1 No Business Logic Duplication

Frontend must not:

- Recalculate financial values
- Determine governance authority
- Infer compliance state

All data comes from backend.

---

### 3.2 API Discipline

All calls must:

- Use canonical API client
- Use relative `/api` path
- Respect SWA auth context

---

### 3.3 Architectural Consistency

- Modern ES modules only
- No reintroduction of legacy MVC
- No mixing patterns

---

## 4. SECURITY & ACCESS

Any feature touching:

- Role permissions
- Fund boundaries
- Document visibility

Must explicitly document:

- Role matrix impact
- Access escalation risk
- Audit impact

---

## 5. AI FEATURE DEVELOPMENT

When modifying AI engine:

- Define deterministic vs probabilistic behavior
- Define validation logic
- Define confidence handling
- Persist outputs if governance-relevant
- Ensure failure paths are safe

No hidden AI side effects.

---

## 6. CI/CD REQUIREMENTS

Before merging:

- Tests pass
- Build passes
- No migration drift
- No telemetry regression
- No removal of alert configuration

Deployment must preserve staging → swap → rollback model.

---

## 7. CHANGE CATEGORIES

### Low Risk
- UI styling
- Read-only queries
- Internal refactors without API change

### Medium Risk
- New endpoints
- New migrations
- AI prompt modifications

### High Risk
- RBAC changes
- Compliance logic modifications
- Database schema restructuring
- Infra changes

High-risk changes require architectural review.

---

## 8. DEFINITION OF DONE

A feature is complete only if:

- Code implemented
- Tests written
- Telemetry verified
- Migration applied (if needed)
- No governance regression
- Documentation updated

---

End of Development Playbook.
