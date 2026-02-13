import * as portfolioApi from "../api/portfolio.js";
import * as alertsDomainApi from "../api/alertsDomain.js";
import * as portfolioActionsApi from "../api/portfolioActions.js";
import * as assetObligationsApi from "../api/assetObligations.js";

/* ── Table schema per tab ── */
/*
 * Minimal-column schemas: 3 columns max per tab.
 * PE portal aesthetic — key identifier, one metric, status.
 */

const TAB_SCHEMAS = {
  borrowers: {
    columns: ["Name", "Risk Rating", "Status"],
    fields: ["name", "risk_rating", "status"],
  },
  loans: {
    columns: ["Borrower", "Principal", "Maturity"],
    fields: ["borrower_name", "principal_amount", "maturity_date"],
  },
  assets: {
    columns: ["Alert", "Severity", "Message"],
    fields: ["alert_type", "severity", "message"],
  },
  covenants: {
    columns: ["Covenant", "Type", "Status"],
    fields: ["name", "covenant_type", "status"],
  },
  alerts: {
    columns: ["Message", "Severity", "Status"],
    fields: ["message", "severity", "status"],
  },
  "portfolio-actions": {
    columns: ["Action", "Status", "Due Date"],
    fields: ["title", "status", "due_date"],
  },
  "fund-investments": {
    columns: ["Info"],
    fields: ["placeholder"],
  },
  "asset-obligations": {
    columns: ["Title", "Status", "Due Date"],
    fields: ["title", "status", "due_date"],
  },
};

/* ── Helpers ── */

function safe(v) {
  if (v == null || v === "") return "—";
  return String(v);
}

function fmtCurrency(v) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function fmtDate(v) {
  if (!v) return "—";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return String(v);
  }
}

function cellValue(field, row) {
  const raw = row?.[field];
  if (field.includes("date") || field === "created_at" || field === "maturity_date" || field === "due_date") {
    return fmtDate(raw);
  }
  if (field === "principal_amount" || field === "amount") {
    return fmtCurrency(raw);
  }
  return safe(raw);
}

/** Build a ui5-table from a schema and an array of row objects. */
function buildTable(schema, rows) {
  const table = document.createElement("ui5-table");
  table.className = "netz-portfolio-table";

  // Header row
  const headerRow = document.createElement("ui5-table-header-row");
  headerRow.setAttribute("slot", "headerRow");
  schema.columns.forEach((col) => {
    const cell = document.createElement("ui5-table-header-cell");
    cell.textContent = col;
    headerRow.appendChild(cell);
  });
  table.appendChild(headerRow);

  // Data rows
  rows.forEach((row) => {
    const tr = document.createElement("ui5-table-row");
    schema.fields.forEach((field) => {
      const td = document.createElement("ui5-table-cell");
      td.textContent = cellValue(field, row);
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  return table;
}

function buildEmptyState(text) {
  const strip = document.createElement("ui5-message-strip");
  strip.design = "Information";
  strip.hideCloseButton = true;
  strip.textContent = text || "No data available.";
  return strip;
}

/* ── Normalize API responses to arrays ── */

function toArray(payload) {
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload)) return payload;
  return [];
}

/**
 * PortfolioPage — tab container for all portfolio sub-domains.
 *
 * Tabs: Borrowers | Loans | Assets | Covenants | Alerts | Portfolio Actions | Fund Investments | Asset Obligations
 */
export class PortfolioPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this._activeTab = "borrowers";

    this.el = document.createElement("ui5-dynamic-page");

    // Page title
    const pageTitle = document.createElement("ui5-dynamic-page-title");
    const heading = document.createElement("ui5-title");
    heading.level = "H1";
    heading.textContent = "Portfolio";
    pageTitle.appendChild(heading);
    this.el.appendChild(pageTitle);

    // Tab container
    this.tabContainer = document.createElement("ui5-tabcontainer");
    this.tabContainer.className = "netz-portfolio-tabs";
    this.tabContainer.addEventListener("tab-select", (e) => {
      const key = e.detail?.tab?.dataset?.key;
      if (key) {
        this._activeTab = key;
        this._loadTabData(key);
      }
    });

    const tabDefs = [
      { key: "borrowers", text: "Borrowers", icon: "customer" },
      { key: "loans", text: "Loans", icon: "credit-card" },
      { key: "assets", text: "Assets", icon: "product" },
      { key: "covenants", text: "Covenants", icon: "locked" },
      { key: "alerts", text: "Alerts", icon: "alert" },
      { key: "portfolio-actions", text: "Portfolio Actions", icon: "action" },
      { key: "fund-investments", text: "Fund Investments", icon: "add-equipment" },
      { key: "asset-obligations", text: "Asset Obligations", icon: "receipt" },
    ];

    this._tabPanels = {};
    tabDefs.forEach((def, idx) => {
      const tab = document.createElement("ui5-tab");
      tab.text = def.text;
      tab.icon = def.icon;
      tab.dataset.key = def.key;
      if (idx === 0) tab.selected = true;

      const panel = document.createElement("div");
      panel.className = "netz-tab-panel";
      tab.appendChild(panel);

      this._tabPanels[def.key] = { tab, panel };
      this.tabContainer.appendChild(tab);
    });

    // Error strip
    this.error = document.createElement("ui5-message-strip");
    this.error.design = "Negative";
    this.error.style.display = "none";

    // Busy indicator wrapping tabs
    this.busy = document.createElement("ui5-busy-indicator");
    this.busy.active = false;
    this.busy.style.width = "100%";

    const content = document.createElement("div");
    content.className = "netz-page-content";
    content.append(this.error, this.tabContainer);
    this.busy.appendChild(content);
    this.el.appendChild(this.busy);
  }

  _setError(msg) {
    this.error.textContent = msg;
    this.error.style.display = "block";
  }

  _clearError() {
    this.error.style.display = "none";
    this.error.textContent = "";
  }

  async onShow() {
    this._clearError();
    if (!this.fundId) {
      this._setError("No fund scope. Provide ?fundId= in the URL.");
      return;
    }
    await this._loadTabData(this._activeTab);
  }

  async _loadTabData(key) {
    this.busy.active = true;
    this._clearError();
    const { panel } = this._tabPanels[key] ?? {};
    if (!panel) {
      this.busy.active = false;
      return;
    }

    try {
      let rows = [];
      const schema = TAB_SCHEMAS[key];

      switch (key) {
        case "borrowers":
          rows = toArray(await portfolioApi.listBorrowers(this.fundId, { limit: 50, offset: 0 }));
          break;
        case "loans":
          rows = toArray(await portfolioApi.listLoans(this.fundId, { limit: 50, offset: 0 }));
          break;
        case "assets":
          rows = toArray(await alertsDomainApi.listDomainAlerts(this.fundId));
          break;
        case "covenants":
          rows = toArray(await portfolioApi.listCovenants(this.fundId, { limit: 50, offset: 0 }));
          break;
        case "alerts": {
          const [domainAlerts, portfolioAlerts] = await Promise.all([
            alertsDomainApi.listDomainAlerts(this.fundId),
            portfolioApi.listAlerts(this.fundId, { limit: 50, offset: 0 }),
          ]);
          const da = toArray(domainAlerts).map((a) => ({ ...a, source: "Domain" }));
          const pa = toArray(portfolioAlerts).map((a) => ({ ...a, source: "Portfolio" }));
          rows = [...da, ...pa];
          break;
        }
        case "portfolio-actions":
          rows = toArray(await portfolioActionsApi.listPortfolioActions(this.fundId));
          break;
        case "fund-investments":
          // No list endpoint — show placeholder
          panel.replaceChildren(buildEmptyState("Select an asset to view fund investment details."));
          this.busy.active = false;
          return;
        case "asset-obligations":
          rows = toArray(await assetObligationsApi.listAssetObligations(this.fundId));
          break;
        default:
          rows = [];
      }

      if (rows.length === 0) {
        panel.replaceChildren(buildEmptyState(`No ${schema?.columns?.[0]?.toLowerCase() || "data"} found.`));
      } else {
        panel.replaceChildren(buildTable(schema, rows));
      }
    } catch (error) {
      this._setError(error?.message ? String(error.message) : `Failed to load ${key}`);
      panel.replaceChildren(buildEmptyState("Error loading data."));
    } finally {
      this.busy.active = false;
    }
  }
}
