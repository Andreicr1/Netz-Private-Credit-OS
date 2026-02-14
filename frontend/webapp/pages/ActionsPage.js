import * as actionsApi from "../api/actions.js";

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

function setOptions(select, options, selected) {
  select.replaceChildren();
  const all = document.createElement("ui5-option");
  all.value = "";
  all.textContent = "All";
  select.appendChild(all);

  options.forEach((value) => {
    const option = document.createElement("ui5-option");
    option.value = String(value);
    option.textContent = String(value);
    if (selected && String(selected) === String(value)) option.selected = true;
    select.appendChild(option);
  });
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

export class ActionsPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.state = {
      filters: {
        status: "",
        slaWindow: "",
        owner: "",
      },
      savedView: "DEFAULT",
      activeFiltersCount: 0,
      asOf: "—",
    };

    this.el = document.createElement("ui5-dynamic-page");

    const pageTitle = document.createElement("ui5-dynamic-page-title");
    const heading = document.createElement("ui5-title");
    heading.level = "H1";
    heading.textContent = "Actions";
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
    header.titleText = "Layer 1 — Command";
    header.subtitleText = "Action queue filters";
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
    title.textContent = "Actions Command";
    left.appendChild(title);

    const right = document.createElement("div");
    right.className = "netz-wave-command-meta";
    right.setAttribute("slot", "endContent");

    this.activeFiltersTag = document.createElement("ui5-tag");
    this.activeFiltersTag.design = "Information";
    right.appendChild(this.activeFiltersTag);

    this.asOfTag = document.createElement("ui5-tag");
    this.asOfTag.design = "Neutral";
    right.appendChild(this.asOfTag);

    bar.append(left, right);

    const controls = document.createElement("div");
    controls.className = "netz-wave-command-controls";

    this.statusSelect = document.createElement("ui5-select");
    this.statusSelect.accessibleName = "Status";

    this.slaSelect = document.createElement("ui5-select");
    this.slaSelect.accessibleName = "SLA Window";
    setOptions(this.slaSelect, ["7D", "30D", "90D"], this.state.filters.slaWindow);

    this.ownerSelect = document.createElement("ui5-select");
    this.ownerSelect.accessibleName = "Owner";

    this.savedViewSelect = document.createElement("ui5-select");
    this.savedViewSelect.accessibleName = "Saved View";
    setOptions(this.savedViewSelect, ["DEFAULT", "RISK", "OPERATIONS"], this.state.savedView);

    const applyBtn = document.createElement("ui5-button");
    applyBtn.design = "Emphasized";
    applyBtn.textContent = "Apply";
    applyBtn.addEventListener("click", () => this._applyFilters());

    const clearBtn = document.createElement("ui5-button");
    clearBtn.design = "Transparent";
    clearBtn.textContent = "Clear";
    clearBtn.addEventListener("click", () => this._clearFilters());

    controls.append(this.statusSelect, this.slaSelect, this.ownerSelect, this.savedViewSelect, applyBtn, clearBtn);
    body.append(bar, controls);
    card.appendChild(body);
    return card;
  }

  _buildAnalyticalLayer() {
    const card = document.createElement("ui5-card");
    card.className = "netz-wave-layer-card";

    const header = document.createElement("ui5-card-header");
    header.titleText = "Layer 2 — Analytical";
    header.subtitleText = "KPI strip";
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
    header.titleText = "Layer 3 — Operational";
    header.subtitleText = "Action Queue Table (dense)";
    header.setAttribute("slot", "header");
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "netz-wave-layer-body";

    this.operationalGovernanceHost = document.createElement("div");
    body.appendChild(this.operationalGovernanceHost);

    this.queueHost = document.createElement("div");
    this.queueHost.className = "netz-wave-table-host";
    body.appendChild(this.queueHost);

    card.appendChild(body);
    return card;
  }

  _buildMonitoringLayer() {
    const card = document.createElement("ui5-card");
    card.className = "netz-wave-layer-card";

    const header = document.createElement("ui5-card-header");
    header.titleText = "Layer 4 — Monitoring";
    header.subtitleText = "Governance Exceptions";
    header.setAttribute("slot", "header");
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "netz-wave-layer-body";

    this.monitoringGovernanceHost = document.createElement("div");
    body.appendChild(this.monitoringGovernanceHost);

    const panel = document.createElement("ui5-panel");
    panel.headerText = "Governance Exceptions";
    this.exceptionsHost = document.createElement("div");
    panel.appendChild(this.exceptionsHost);

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
    this.state.activeFiltersCount = [
      this.state.filters.status,
      this.state.filters.slaWindow,
      this.state.filters.owner,
    ].filter(Boolean).length;

    this.activeFiltersTag.textContent = `activeFiltersCount ${this.state.activeFiltersCount}`;
    this.asOfTag.textContent = `asOf ${this.state.asOf}`;
  }

  _applyFilters() {
    this.state.savedView = String(this.savedViewSelect.selectedOption?.value || "DEFAULT");
    this.state.filters = {
      status: this.statusSelect.selectedOption?.value || "",
      slaWindow: this.slaSelect.selectedOption?.value || "",
      owner: this.ownerSelect.selectedOption?.value || "",
    };
    this.onShow();
  }

  _clearFilters() {
    this.state.filters = { status: "", slaWindow: "", owner: "" };
    this.state.savedView = "DEFAULT";
    this.onShow();
  }

  _setLayerGovernance(host, payload) {
    host.replaceChildren();
    const strip = buildGovernanceStrip(payload);
    if (strip) host.appendChild(strip);
  }

  _renderAnalytical(rows) {
    const openActions = rows.filter((row) => !String(firstDefined(row.status, row.workflow_status, "")).toLowerCase().includes("closed")).length;
    const overdue = rows.filter((row) => {
      const due = firstDefined(row.sla_due, row.due_date, row.sla_due_date);
      if (!due) return false;
      const dueDate = new Date(due);
      return !Number.isNaN(dueDate.getTime()) && dueDate.getTime() < Date.now() && !String(firstDefined(row.status, "")).toLowerCase().includes("closed");
    }).length;
    const pendingApprovals = rows.filter((row) => String(firstDefined(row.status, row.workflow_status, "")).toLowerCase().includes("pending")).length;

    this.kpiStrip.replaceChildren(
      buildKpiCard({ title: "Open Actions", value: safe(openActions), status: "Information" }),
      buildKpiCard({ title: "Overdue", value: safe(overdue), status: overdue > 0 ? "Error" : "Success" }),
      buildKpiCard({ title: "Pending Approvals", value: safe(pendingApprovals), status: pendingApprovals > 0 ? "Warning" : "Success" }),
    );
  }

  _renderOperational(rows) {
    const columns = [
      { key: "action", label: "Action", priority: "P1" },
      { key: "slaDue", label: "SLA Due", priority: "P1" },
      { key: "priority", label: "Priority", priority: "P1" },
      { key: "status", label: "Status", priority: "P2" },
      { key: "domain", label: "Domain", priority: "P2" },
      { key: "owner", label: "Owner", priority: "P3" },
    ];

    const tableRows = rows.map((row) => ({
      action: firstDefined(row.title, row.name, row.action, row.id),
      slaDue: formatDate(firstDefined(row.sla_due, row.due_date, row.sla_due_date)),
      priority: firstDefined(row.priority, row.sla_priority, row.severity),
      status: firstDefined(row.status, row.workflow_status),
      domain: firstDefined(row.domain, row.category, row.source),
      owner: firstDefined(row.owner, row.owner_name, row.assignee),
    }));

    this.queueHost.replaceChildren(buildDenseTable(columns, tableRows));
  }

  _renderMonitoring(rows) {
    const exceptions = rows
      .filter((row) => String(firstDefined(row.exception, row.governance_exception, row.status, "")).toLowerCase().includes("exception")
        || String(firstDefined(row.status, "")).toLowerCase().includes("blocked"))
      .slice(0, 10)
      .map((row) => ({
        text: firstDefined(row.title, row.name, row.id, "Governance exception"),
        description: firstDefined(row.status, row.governance_exception, row.message, "—"),
      }));

    this.exceptionsHost.replaceChildren(buildList(exceptions, "No governance exceptions."));
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
      const [execution, governed] = await Promise.all([
        actionsApi.listExecutionActions(this.fundId, {
          limit: 100,
          offset: 0,
          status: this.state.filters.status,
          sla_window: this.state.filters.slaWindow,
          owner: this.state.filters.owner,
          saved_view: this.state.savedView,
        }),
        actionsApi.listGovernedActions(this.fundId),
      ]);

      const executionRows = toItems(execution);
      const governedRows = toItems(governed);
      const mergedRows = [...executionRows, ...governedRows];

      this.state.asOf = getAsOf(execution, governed);
      this._refreshCommandMeta();

      setOptions(
        this.statusSelect,
        [...new Set(mergedRows.map((row) => firstDefined(row.status, row.workflow_status)).filter(Boolean))],
        this.state.filters.status,
      );

      setOptions(
        this.ownerSelect,
        [...new Set(mergedRows.map((row) => firstDefined(row.owner, row.owner_name, row.assignee)).filter(Boolean))],
        this.state.filters.owner,
      );

      this._setLayerGovernance(this.commandGovernanceHost, execution);
      this._setLayerGovernance(this.analyticalGovernanceHost, execution);
      this._setLayerGovernance(this.operationalGovernanceHost, execution);
      this._setLayerGovernance(this.monitoringGovernanceHost, governed);

      this._renderAnalytical(mergedRows);
      this._renderOperational(mergedRows);
      this._renderMonitoring(mergedRows);
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to load actions data");
    } finally {
      this.busy.active = false;
    }
  }
}
