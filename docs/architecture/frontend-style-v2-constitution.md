# Frontend Style V2 — Constitution

**Status:** Canonical · Effective 2026-02-14
**Source of truth:** `frontend/webapp/css/style-v2.css`
**Imported in:** `frontend/main.js`

---

## 1. Purpose

Style V2 is the **sole institutional layout system** for Netz Private Credit OS.

It defines a closed set of layout primitives that every page must compose from.
No page may invent its own grid, column, or structural CSS.
All layout behaviour flows from the selectors declared in `style-v2.css`.

---

## 2. Approved Layout Primitives

Every class listed below exists in `style-v2.css` and is the only sanctioned way to express its concern.

### 2.1 Global Baseline

| Selector | Purpose |
|---|---|
| `.netz-page` | Full-height page container, overflow hidden |
| `.netz-pad` | Institutional padding (1 rem) |
| `.netz-meta-text` | Secondary text — neutral colour, small size |
| `.netz-title-strong` | Bold title weight (600) |

### 2.2 Flexible Column Layout (FCL — 3 Columns)

Mandatory for: **Portfolio, Deals Pipeline, Signatures**

| Selector | Purpose |
|---|---|
| `.netz-fcl` | Grid root — 3 columns (`begin` / `mid` / `end`) |
| `.netz-fcl-col` | Column primitive — border, background, flex column |
| `.netz-fcl-col--begin` | Begin (left) column modifier |
| `.netz-fcl-col--mid` | Mid (centre) column modifier — takes flex priority |
| `.netz-fcl-col--end` | End (right) column modifier |
| `.netz-fcl-header` | Column header bar |
| `.netz-fcl-body` | Scrollable column body |
| `.netz-fcl-filter-bar` | Begin-column filter bar spacing (overrides netz-multi padding) |
| `.netz-fcl-preview` | Sub-detail preview spacing |

**Grid sizing:**

```
begin:  minmax(22rem, 28rem)
mid:    minmax(0, 1fr)
end:    minmax(24rem, 32rem)
```

### 2.3 Entity List Rows (Begin Column)

| Selector | Purpose |
|---|---|
| `.netz-entity-row` | Bordered row primitive |
| `button.netz-entity-row` | Button reset for entity row navigation (FCL) |
| `.netz-entity-title` | Row primary text (bold) |
| `.netz-entity-meta` | Row secondary text strip |
| `.netz-entity-badge` | Inline badge container |

### 2.4 Object Page Header (Mid Column)

| Selector | Purpose |
|---|---|
| `.netz-object-header` | Vertical header stack |
| `.netz-object-kpis` | Inline KPI strip under header |
| `.netz-object-tabs` | Tab-section spacing token |

### 2.5 Multi-Instance Layout (4-Layer Standard)

Mandatory for: **Cash Management, Compliance, Reporting**

| Selector | Purpose |
|---|---|
| `.netz-multi` | Vertical layer stack with 1 rem gap |
| `.netz-layer` | Layer card primitive |
| `.netz-layer-body` | Layer inner grid |
| `.netz-layer--command` | Command layer variant (shell background) |
| `.netz-layer--monitoring` | Monitoring layer variant |

### 2.6 KPI Strip

| Selector | Purpose |
|---|---|
| `.netz-kpi-strip` | 4-column KPI grid (responsive) |
| `.netz-kpi-card` | Individual KPI tile |

### 2.7 Table Baseline

| Selector | Purpose |
|---|---|
| `.netz-table` | Full-width table wrapper |

### 2.8 Button Standard

Button styling is handled via `ui5-button` `design` attribute — no CSS classes needed.

| Role | design attribute |
|---|---|
| Primary (Apply) | `"Emphasized"` |
| Secondary (Reset) | `"Transparent"` |
| Tertiary (Export) | `"Transparent"` |
| Semantic (attention) | `"Attention"` / `"Positive"` / `"Negative"` |

---

## 3. Responsive Rules

All responsive behaviour is defined exclusively in `style-v2.css`.
Pages must **not** add their own `@media` layout queries.

### FCL Breakpoints

| Breakpoint | Behaviour |
|---|---|
| **> 1280 px** | Full 3-column layout (begin + mid + end) |
| **≤ 1280 px** | 2-column layout (begin + mid); **end column hidden** |
| **≤ 960 px** | 1-column layout (end only visible); **begin and mid hidden** |

### KPI Strip Breakpoints

| Breakpoint | Columns |
|---|---|
| **> 1024 px** | 4 columns |
| **≤ 1024 px** | 2 columns |
| **≤ 768 px** | 1 column |

---

## 4. Forbidden Patterns

The following are **prohibited** across all frontend pages:

| Pattern | Reason |
|---|---|
| Ad-hoc `display: grid` or `display: flex` on page containers | Layout must come from V2 primitives |
| Inline `style.display`, `style.gridTemplateColumns` on structural elements | Breaks responsive contract |
| New column or grid class inventions per page | Fragments the design system |
| `!important` on layout properties (grid, flex, display) | Specificity escalation is not permitted; fix the selector instead |
| UI5 MVC legacy artifacts (`sap.m.Page`, `sap.f.FlexibleColumnLayout` JS API) | Replaced by `.netz-fcl` CSS grid |
| Duplicating V2 selectors inside page-specific CSS | Single source of truth is `style-v2.css` |

---

## 5. Migration Policy

1. **Gradual adoption** — pages migrate to V2 primitives over successive waves.
2. **No duplication** — a page must not redefine any V2 selector locally.
3. **V1 coexistence** — `style.css` (V1) remains loaded for pages not yet migrated. V1 class names (`netz-wave-*`, `netz-fcl-layout`, `netz-fcl-column`) are legacy and will be retired once all pages migrate.
4. **New pages** — must use V2 primitives exclusively. V1 classes are not permitted in new code.
5. **Import order** — `main.js` imports V1 first, then V2. V2 selectors take precedence by source order for any overlapping concerns.

---

## 6. Selector Inventory Checksum

Total V2 selectors: **30**

```
.netz-page
.netz-pad
.netz-meta-text
.netz-title-strong
.netz-fcl
.netz-fcl-col
.netz-fcl-col--begin
.netz-fcl-col--mid
.netz-fcl-col--end
.netz-fcl-body
.netz-fcl-header
.netz-fcl-filter-bar
.netz-fcl-preview
.netz-entity-row
button.netz-entity-row
.netz-entity-title
.netz-entity-meta
.netz-entity-badge
.netz-object-header
.netz-object-kpis
.netz-object-tabs
.netz-multi
.netz-layer
.netz-layer-body
.netz-layer--command
.netz-layer--monitoring
.netz-kpi-strip
.netz-kpi-card
.netz-table
```

Any selector not on this list is **not part of Style V2** and must not be assumed to exist.

---

*This document is the governing reference for all frontend layout decisions.
Changes to `style-v2.css` require a corresponding update to this constitution.*
