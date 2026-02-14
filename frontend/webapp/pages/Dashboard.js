import * as complianceApi from "../api/compliance.js";
import * as dealsApi from "../api/deals.js";
import * as adminAuditApi from "../api/adminAudit.js";

const LATENCY_THRESHOLD = 300;

function safe(value, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function toItems(payload) {
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload)) return payload;
  return [];
}

function toTotals(payload) {
  return payload?.totals && typeof payload.totals === "object" ? payload.totals : {};
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return safe(value);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return safe(value);
  return date.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getAsOf(...payloads) {
  for (const payload of payloads) {
    const asOf = firstDefined(payload?.asOf, payload?.as_of, payload?.timestamp, payload?.generated_at);
    if (!asOf) continue;
    const date = new Date(asOf);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    }
    return safe(asOf);
  }
  return "—";
}

function getGovernanceSignal(payload, fallbackThreshold = LATENCY_THRESHOLD) {
  const latency = Number(firstDefined(payload?.dataLatency, payload?.data_latency, payload?.latency_ms));
  const threshold = Number(firstDefined(payload?.dataLatencyThreshold, payload?.latency_threshold, fallbackThreshold));
  const quality = safe(firstDefined(payload?.dataQuality, payload?.data_quality), "OK");

  if ((!Number.isNaN(latency) && !Number.isNaN(threshold) && latency > threshold) || quality !== "OK") {
    return {
      latency: Number.isNaN(latency) ? null : latency,
      threshold: Number.isNaN(threshold) ? fallbackThreshold : threshold,
      quality,
    };
  }
  return null;
}

function buildGovernanceStrip(payload) {
  const signal = getGovernanceSignal(payload);
  if (!signal) return null;

  const strip = document.createElement("ui5-message-strip");
  strip.design = "Warning";
  strip.hideCloseButton = true;
  const latencyText = signal.latency == null ? "n/a" : `${signal.latency}ms`;
  strip.textContent = `Data governance warning — latency ${latencyText} (threshold ${signal.threshold}ms), quality ${signal.quality}.`;
  return strip;
}

function buildKpiCard({ title, value, status = "Information" }) {
  const card = document.createElement("ui5-card");
  card.className = "netz-wave-kpi-card";

  const header = document.createElement("ui5-card-header");
  header.titleText = title;
  header.setAttribute("slot", "header");
  card.appendChild(header);

  const body = document.createElement("div");
  body.className = "netz-wave-kpi-body";

  const main = document.createElement("ui5-title");
  main.level = "H3";
  main.textContent = safe(value);

  const objectStatus = document.createElement("ui5-object-status");
  objectStatus.state = status;
  objectStatus.text = "as-of backend";

  body.append(main, objectStatus);
  card.appendChild(body);
  return card;
}

function buildDenseTable(columns, rows) {
  const table = document.createElement("ui5-table");
  table.className = "netz-wave-table-dense";

  const headerRow = document.createElement("ui5-table-header-row");
  headerRow.setAttribute("slot", "headerRow");
  columns.forEach((column) => {
    const headerCell = document.createElement("ui5-table-header-cell");
    headerCell.textContent = `${column.label} ${column.priority}`;
    headerRow.appendChild(headerCell);
  });
  table.appendChild(headerRow);

  rows.forEach((row) => {
    const tr = document.createElement("ui5-table-row");
    columns.forEach((column) => {
      const td = document.createElement("ui5-table-cell");
      td.textContent = safe(row[column.key]);
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  return table;
}

function buildList(items, emptyText) {
  const list = document.createElement("ui5-list");
  if (!items.length) {
    const li = document.createElement("ui5-li");
    li.textContent = emptyText;
    list.appendChild(li);
    return list;
  }

  items.forEach((item) => {
    const li = document.createElement("ui5-li");
    li.textContent = safe(item.text);
    li.description = safe(item.description);
    list.appendChild(li);
  });
  return list;
}

export class DashboardPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.state = {
      asOf: "—",
      activeFiltersCount: 1,
      view: "BOARD",
    };

    this.el = document.createElement("ui5-dynamic-page");

    const pageTitle = document.createElement("ui5-dynamic-page-title");
    const heading = document.createElement("ui5-title");
    heading.level = "H1";
    heading.textContent = "Governance Board Control Center";
    pageTitle.appendChild(heading);
    this.el.appendChild(pageTitle);

    this.busy = document.createElement("ui5-busy-indicator");
    this.busy.active = false;
    this.busy.style.width = "100%";

    const content = document.createElement("div");
    content.className = "netz-page-content netz-wave-page";

    this.errorStrip = document.createElement("ui5-message-strip");
    this.errorStrip.design = "Negative";
    this.errorStrip.style.display = "none";
    content.appendChild(this.errorStrip);

    this.commandLayer = this._buildCommandLayer();
    this.analyticalLayer = this._buildAnalyticalLayer();
    this.operationalLayer = this._buildOperationalLayer();
    this.monitoringLayer = this._buildMonitoringLayer();

    content.append(this.commandLayer, this.analyticalLayer, this.operationalLayer, this.monitoringLayer);
    this.busy.appendChild(content);
    this.el.appendChild(this.busy);
  }

  _buildCommandLayer() {
    const card = document.createElement("ui5-card");
    card.className = "netz-wave-layer-card";

    const header = document.createElement("ui5-card-header");
    header.titleText = "Governance.Command.Header";
    header.subtitleText = "Board governance context";
    header.setAttribute("slot", "header");
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "netz-wave-layer-body";

    this.commandGovernanceHost = document.createElement("div");
    body.appendChild(this.commandGovernanceHost);

    const bar = document.createElement("ui5-bar");
    bar.className = "netz-wave-command-bar";

    const left = document.createElement("div");
    left.setAttribute("slot", "startContent");
    const title = document.createElement("ui5-title");
    title.level = "H5";
    title.textContent = "Board Command";
    left.appendChild(title);

    const right = document.createElement("div");
    right.className = "netz-wave-command-meta";
    right.setAttribute("slot", "endContent");

    this.fundTag = document.createElement("ui5-tag");
    this.fundTag.design = "Set2";

    this.asOfTag = document.createElement("ui5-tag");
    this.asOfTag.design = "Neutral";

    this.activeTag = document.createElement("ui5-tag");
    this.activeTag.design = "Information";

    right.append(this.fundTag, this.asOfTag, this.activeTag);
    bar.append(left, right);

    body.appendChild(bar);
    card.appendChild(body);
    return card;
  }

  _buildAnalyticalLayer() {
    const card = document.createElement("ui5-card");
    card.className = "netz-wave-layer-card";

    const header = document.createElement("ui5-card-header");
    header.titleText = "Governance.Analytical.RiskSummary";
    header.subtitleText = "Board risk summary";
    header.setAttribute("slot", "header");
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "netz-wave-layer-body";

    this.analyticalGovernanceHost = document.createElement("div");
    body.appendChild(this.analyticalGovernanceHost);

    this.kpiStrip = document.createElement("div");
    this.kpiStrip.className = "netz-wave-kpi-strip";
    body.appendChild(this.kpiStrip);

    card.appendChild(body);
    return card;
  }

  _buildOperationalLayer() {
    const card = document.createElement("ui5-card");
    card.className = "netz-wave-layer-card";

    const header = document.createElement("ui5-card-header");
    header.titleText = "Governance.Operational.ActionsQueue";
    header.subtitleText = "Pending approvals + governed actions";
    header.setAttribute("slot", "header");
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "netz-wave-layer-body";

    this.operationalGovernanceHost = document.createElement("div");
    body.appendChild(this.operationalGovernanceHost);

    this.actionsQueueHost = document.createElement("div");
    this.actionsQueueHost.className = "netz-wave-table-host";
    body.appendChild(this.actionsQueueHost);

    card.appendChild(body);
    return card;
  }

  _buildMonitoringLayer() {
    const card = document.createElement("ui5-card");
    card.className = "netz-wave-layer-card";

    const header = document.createElement("ui5-card-header");
    header.titleText = "Governance.Monitoring.AuditExceptions";
    header.subtitleText = "Audit exceptions backend-driven";
    header.setAttribute("slot", "header");
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "netz-wave-layer-body";

    this.monitoringGovernanceHost = document.createElement("div");
    body.appendChild(this.monitoringGovernanceHost);

    const panel = document.createElement("ui5-panel");
    panel.headerText = "Audit Exceptions";
    this.auditExceptionsHost = document.createElement("div");
    panel.appendChild(this.auditExceptionsHost);

    body.appendChild(panel);
    card.appendChild(body);
    return card;
  }

  _setError(message) {
    this.errorStrip.textContent = message;
    this.errorStrip.style.display = "block";
  }

  _clearError() {
    this.errorStrip.textContent = "";
    this.errorStrip.style.display = "none";
  }

  _refreshCommandMeta() {
    this.fundTag.textContent = `fund ${safe(this.fundId)}`;
    this.asOfTag.textContent = `asOf ${this.state.asOf}`;
    this.activeTag.textContent = `activeFiltersCount ${safe(this.state.activeFiltersCount)}`;
  }

  _setLayerGovernance(host, payload) {
    host.replaceChildren();
    const strip = buildGovernanceStrip(payload);
    if (strip) host.appendChild(strip);
  }

  _renderAnalytical(viewData) {
    const complianceTotals = toTotals(viewData.complianceSnapshot);
    const obligationsTotals = toTotals(viewData.obligations);

    const openObligations = firstDefined(
      complianceTotals.open_obligations,
      obligationsTotals.open,
      viewData.obligationsRows.length,
    );

    const overdueObligations = firstDefined(
      complianceTotals.overdue,
      obligationsTotals.overdue,
    );

    const pendingApprovals = viewData.pendingApprovals.length;
    const auditExceptions = viewData.auditExceptions.length;

    this.kpiStrip.replaceChildren(
      buildKpiCard({ title: "Compliance Health", value: Number(overdueObligations) > 0 ? "ATTENTION" : "STABLE", status: Number(overdueObligations) > 0 ? "Warning" : "Success" }),
      buildKpiCard({ title: "Open Obligations", value: safe(openObligations), status: Number(openObligations) > 0 ? "Information" : "Success" }),
      buildKpiCard({ title: "Pending Approvals", value: safe(pendingApprovals), status: pendingApprovals > 0 ? "Warning" : "Success" }),
      buildKpiCard({ title: "Audit Exceptions", value: safe(auditExceptions), status: auditExceptions > 0 ? "Error" : "Success" }),
    );
  }

  _renderOperational(viewData) {
    const actionRows = [];

    viewData.pendingApprovals.forEach((row) => {
      actionRows.push({
        action: firstDefined(row.deal_name, row.name, row.stage, "Pending approval"),
        owner: firstDefined(row.owner, row.assignee, row.desk_owner),
        due: firstDefined(row.sla_due, row.sla_due_date, row.due_date),
        source: "Pipeline",
        status: firstDefined(row.approval_status, row.ic_status, row.status),
      });
    });

    viewData.obligationsRows
      .filter((row) => {
        const workflowStatus = String(firstDefined(row.workflow_status, row.status, "")).toLowerCase();
        return workflowStatus.includes("pending") || workflowStatus.includes("open");
      })
      .slice(0, 20)
      .forEach((row) => {
        actionRows.push({
          action: firstDefined(row.title, row.name, row.obligation, row.id),
          owner: firstDefined(row.owner, row.owner_name),
          due: formatDate(firstDefined(row.due_date, row.dueDate)),
          source: "Compliance",
          status: firstDefined(row.workflow_status, row.status),
        });
      });

    const columns = [
      { key: "action", label: "Action", priority: "P1" },
      { key: "owner", label: "Owner", priority: "P1" },
      { key: "due", label: "Due", priority: "P1" },
      { key: "source", label: "Source", priority: "P2" },
      { key: "status", label: "Status", priority: "P2" },
    ];

    this.actionsQueueHost.replaceChildren(buildDenseTable(columns, actionRows));
  }

  _renderMonitoring(viewData) {
    const exceptionItems = viewData.auditExceptions.map((row) => ({
      text: firstDefined(row.action, row.name, row.workflow_action, row.title, "Audit exception"),
      description: `${safe(firstDefined(row.status, row.workflow_status), "—")} • ${formatDateTime(firstDefined(row.updated_at, row.created_at, row.timestamp))}`,
    }));

    this.auditExceptionsHost.replaceChildren(buildList(exceptionItems, "No audit exceptions."));
  }

  async onShow() {
    this.busy.active = true;
    this._clearError();

    if (!this.fundId) {
      this._setError("No fund scope. Provide ?fundId= in the URL.");
      this.busy.active = false;
      return;
    }

    try {
      const [complianceSnapshot, obligations, pipelineDeals, governedEvents, executionEvents] = await Promise.all([
        complianceApi.getComplianceSnapshot(this.fundId),
        complianceApi.listComplianceObligations(this.fundId, { limit: 100, offset: 0, view: "all" }),
        dealsApi.listPipelineDeals(this.fundId, { limit: 100, offset: 0 }),
        adminAuditApi.listGovernedAuditEvents(this.fundId),
        adminAuditApi.listAdminAuditEvents(this.fundId, { limit: 100, offset: 0 }),
      ]);

      const obligationsRows = toItems(obligations);
      const approvalsRows = Array.isArray(pipelineDeals?.pending_approvals)
        ? pipelineDeals.pending_approvals
        : Array.isArray(pipelineDeals?.approvals_queue)
          ? pipelineDeals.approvals_queue
          : [];

      const auditRows = [...toItems(governedEvents), ...toItems(executionEvents)];
      const auditExceptions = auditRows.filter((row) => {
        const status = String(firstDefined(row.status, row.workflow_status, "")).toLowerCase();
        const action = String(firstDefined(row.action, row.workflow_action, row.name, "")).toLowerCase();
        return status.includes("fail") || status.includes("error") || status.includes("exception") || action.includes("exception");
      });

      this.state.asOf = getAsOf(complianceSnapshot, obligations, pipelineDeals, governedEvents, executionEvents);
      this._refreshCommandMeta();

      const viewData = {
        complianceSnapshot,
        obligations,
        obligationsRows,
        pendingApprovals: approvalsRows,
        auditExceptions,
      };

      this._setLayerGovernance(this.commandGovernanceHost, complianceSnapshot);
      this._setLayerGovernance(this.analyticalGovernanceHost, complianceSnapshot);
      this._setLayerGovernance(this.operationalGovernanceHost, pipelineDeals);
      this._setLayerGovernance(this.monitoringGovernanceHost, executionEvents);

      this._renderAnalytical(viewData);
      this._renderOperational(viewData);
      this._renderMonitoring(viewData);
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to load governance board data");
    } finally {
      this.busy.active = false;
    }
  }
}
