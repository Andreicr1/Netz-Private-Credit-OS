import * as reportingApi from "../api/reporting.js";
import * as cashApi from "../api/cash.js";
import * as complianceApi from "../api/compliance.js";
import * as dealsApi from "../api/deals.js";
import * as portfolioApi from "../api/portfolio.js";
import * as alertsDomainApi from "../api/alertsDomain.js";

/* ── Helpers ── */

function safe(v, fallback) {
  return v != null && v !== "" ? String(v) : (fallback ?? "—");
}

function fmtCurrency(v) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

/**
 * KPI Card — large numeric hero with contextual subtitle.
 * Clean PE aesthetic: generous padding, single dominant figure.
 */
function makeKpiCard(icon, title, value, subtitle) {
  const card = document.createElement("ui5-card");
  card.className = "netz-kpi-card";

  const header = document.createElement("ui5-card-header");
  header.titleText = title;
  header.setAttribute("slot", "header");
  if (icon) {
    const ic = document.createElement("ui5-icon");
    ic.name = icon;
    ic.setAttribute("slot", "avatar");
    header.appendChild(ic);
  }
  card.appendChild(header);

  const body = document.createElement("div");
  body.className = "netz-kpi-body";

  const num = document.createElement("ui5-title");
  num.level = "H1";
  num.textContent = value;
  num.className = "netz-kpi-value";
  body.appendChild(num);

  if (subtitle) {
    const sub = document.createElement("ui5-label");
    sub.className = "netz-kpi-subtitle";
    sub.textContent = subtitle;
    body.appendChild(sub);
  }

  card.appendChild(body);
  return card;
}

/**
 * Queue Card — attention list with bounded item count.
 * Shows at most 5 items to keep it scannable.
 */
function makeQueueCard(icon, title, items, emptyText) {
  const card = document.createElement("ui5-card");
  card.className = "netz-queue-card";

  const header = document.createElement("ui5-card-header");
  header.titleText = title;
  header.subtitleText = items.length
    ? `${items.length} item${items.length !== 1 ? "s" : ""}`
    : "Clear";
  header.setAttribute("slot", "header");
  if (icon) {
    const ic = document.createElement("ui5-icon");
    ic.name = icon;
    ic.setAttribute("slot", "avatar");
    header.appendChild(ic);
  }
  card.appendChild(header);

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "netz-queue-empty";
    empty.textContent = emptyText || "No items";
    card.appendChild(empty);
    return card;
  }

  const list = document.createElement("ui5-list");
  list.noDataText = emptyText || "No items";
  list.separators = "Inner";
  items.slice(0, 5).forEach((item) => {
    const li = document.createElement("ui5-li");
    li.textContent = item.text || "—";
    if (item.description) li.description = item.description;
    if (item.icon) li.icon = item.icon;
    if (item.highlight) li.setAttribute("highlight", item.highlight);
    list.appendChild(li);
  });
  card.appendChild(list);

  return card;
}

/* ── Dashboard Page ── */

export class DashboardPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.el = document.createElement("ui5-dynamic-page");

    /* Page title */
    const pageTitle = document.createElement("ui5-dynamic-page-title");
    const heading = document.createElement("ui5-title");
    heading.level = "H1";
    heading.textContent = "Dashboard";
    pageTitle.appendChild(heading);
    this.el.appendChild(pageTitle);

    /* Header — fund scope */
    const pageHeader = document.createElement("ui5-dynamic-page-header");
    const strip = document.createElement("ui5-message-strip");
    strip.design = "Information";
    strip.hideCloseButton = true;
    strip.textContent = this.fundId
      ? `Fund: ${this.fundId}`
      : "No fund scope set. Provide ?fundId= in the URL.";
    pageHeader.appendChild(strip);
    this.el.appendChild(pageHeader);

    /* Busy indicator */
    this.busy = document.createElement("ui5-busy-indicator");
    this.busy.active = true;
    this.busy.style.width = "100%";

    /* Content container */
    this.content = document.createElement("div");
    this.content.className = "netz-page-content netz-dashboard-content";
    this.busy.appendChild(this.content);
    this.el.appendChild(this.busy);
  }

  async onShow() {
    this.busy.active = true;
    this.content.replaceChildren();

    if (!this.fundId) {
      this.busy.active = false;
      return;
    }

    try {
      /* Parallel data fetch — all read-only backend endpoints */
      const [navSnaps, cashSnap, compSnap, pipelineDeals, alerts, breaches, cashTxs, gaps] =
        await Promise.all([
          reportingApi.listNavSnapshots(this.fundId, { limit: 1, offset: 0 }).catch(() => null),
          cashApi.getCashSnapshot(this.fundId).catch(() => null),
          complianceApi.getComplianceSnapshot(this.fundId).catch(() => null),
          dealsApi.listPipelineDeals(this.fundId, { limit: 20 }).catch(() => null),
          alertsDomainApi.listDomainAlerts(this.fundId).catch(() => null),
          portfolioApi.listBreaches(this.fundId, { limit: 10, offset: 0 }).catch(() => null),
          cashApi.listCashTransactions(this.fundId, { limit: 20, offset: 0 }).catch(() => null),
          complianceApi.listComplianceGaps(this.fundId, { limit: 10 }).catch(() => null),
        ]);

      /* ── KPI Row ── */
      const kpiRow = document.createElement("div");
      kpiRow.className = "netz-kpi-row";

      const latestNav = Array.isArray(navSnaps?.items) ? navSnaps.items[0] : navSnaps;
      const navValue = latestNav?.total_nav ?? latestNav?.nav_total ?? null;
      kpiRow.appendChild(
        makeKpiCard("bar-chart", "Net Asset Value", fmtCurrency(navValue), latestNav?.snapshot_date ?? "Latest")
      );

      const cashBal = cashSnap?.available_balance ?? cashSnap?.balance ?? null;
      kpiRow.appendChild(
        makeKpiCard("wallet", "Cash Position", fmtCurrency(cashBal), "Available")
      );

      const openObl = compSnap?.total_open_obligations ?? compSnap?.open_count ?? null;
      kpiRow.appendChild(
        makeKpiCard("shield", "Open Obligations", safe(openObl, "0"), "Compliance")
      );

      const dealItems = Array.isArray(pipelineDeals?.items) ? pipelineDeals.items : (Array.isArray(pipelineDeals) ? pipelineDeals : []);
      kpiRow.appendChild(
        makeKpiCard("lead", "Pipeline", safe(dealItems.length, "0"), "Active deals")
      );

      this.content.appendChild(kpiRow);

      /* ── Section divider ── */
      const divider = document.createElement("div");
      divider.className = "netz-section-divider";
      const divTitle = document.createElement("ui5-title");
      divTitle.level = "H4";
      divTitle.textContent = "Attention Items";
      divider.appendChild(divTitle);
      this.content.appendChild(divider);

      /* ── Queue Row ── */
      const queueRow = document.createElement("div");
      queueRow.className = "netz-queue-row";

      // Portfolio Health
      const alertItems = Array.isArray(alerts?.items) ? alerts.items : (Array.isArray(alerts) ? alerts : []);
      const healthItems = [];
      const breachItems = Array.isArray(breaches?.items) ? breaches.items : (Array.isArray(breaches) ? breaches : []);
      breachItems.slice(0, 3).forEach((b) => {
        healthItems.push({
          text: b.description || b.covenant_name || b.title || "Breach",
          description: b.severity || b.status || "",
          icon: "warning",
          highlight: "Critical",
        });
      });
      alertItems.slice(0, 3).forEach((a) => {
        healthItems.push({
          text: a.message || a.title || a.alert_type || "Alert",
          description: a.severity || a.status || "",
          icon: "alert",
          highlight: a.severity === "critical" ? "Critical" : "Warning",
        });
      });
      queueRow.appendChild(
        makeQueueCard("inspection", "Portfolio Health", healthItems, "No active alerts or breaches")
      );

      // Operations Queue
      const txItems = Array.isArray(cashTxs?.items) ? cashTxs.items : (Array.isArray(cashTxs) ? cashTxs : []);
      const pendingTxs = txItems
        .filter((t) => t.status && !["reconciled", "executed", "rejected", "cancelled"].includes(t.status.toLowerCase()))
        .slice(0, 5);
      const opsItems = pendingTxs.map((t) => ({
        text: `${t.type || t.transaction_type || "Transfer"} — ${fmtCurrency(t.amount)}`,
        description: t.status || "",
        icon: "money-bills",
      }));
      queueRow.appendChild(
        makeQueueCard("wallet", "Pending Operations", opsItems, "No pending operations")
      );

      // Governance
      const gapItems = Array.isArray(gaps?.items) ? gaps.items : (Array.isArray(gaps) ? gaps : []);
      const govItems = gapItems.slice(0, 5).map((g) => ({
        text: g.obligation_title || g.title || g.description || "Gap",
        description: g.gap_type || g.status || "",
        icon: "commission-check",
        highlight: "Warning",
      }));
      queueRow.appendChild(
        makeQueueCard("shield", "Governance", govItems, "No compliance gaps")
      );

      this.content.appendChild(queueRow);
    } catch (e) {
      const errStrip = document.createElement("ui5-message-strip");
      errStrip.design = "Negative";
      errStrip.hideCloseButton = true;
      errStrip.textContent = `Failed to load dashboard: ${e?.message || "Unknown error"}`;
      this.content.appendChild(errStrip);
    } finally {
      this.busy.active = false;
    }
  }
}
