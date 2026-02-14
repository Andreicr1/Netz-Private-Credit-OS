import * as signaturesApi from "../api/signatures.js";

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
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    return safe(asOf);
  }
  return "—";
}

function getGovernanceSignal(payload, fallbackThreshold = LATENCY_THRESHOLD) {
  const latency = Number(firstDefined(payload?.dataLatency, payload?.data_latency, payload?.latency_ms));
  const threshold = Number(firstDefined(payload?.dataLatencyThreshold, payload?.latency_threshold, fallbackThreshold));
  const quality = safe(firstDefined(payload?.dataQuality, payload?.data_quality), "OK");

  if ((!Number.isNaN(latency) && !Number.isNaN(threshold) && latency > threshold) || quality !== "OK") {
    return { latency: Number.isNaN(latency) ? null : latency, threshold: Number.isNaN(threshold) ? fallbackThreshold : threshold, quality };
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
  const viewportWidth = window.innerWidth || 1440;
  const visibleColumns = viewportWidth <= 960
    ? columns.filter((column) => column.priority === "P1")
    : viewportWidth <= 1280
      ? columns.filter((column) => column.priority !== "P3")
      : columns;
  const hiddenColumns = columns.filter((column) => !visibleColumns.includes(column));

  const table = document.createElement("ui5-table");
  table.className = "netz-wave-table-dense";

  const headerRow = document.createElement("ui5-table-header-row");
  headerRow.setAttribute("slot", "headerRow");
  visibleColumns.forEach((column) => {
    const headerCell = document.createElement("ui5-table-header-cell");
    headerCell.textContent = `${column.label} ${column.priority}`;
    headerRow.appendChild(headerCell);
  });
  if (hiddenColumns.length) {
    const detailsHeader = document.createElement("ui5-table-header-cell");
    detailsHeader.textContent = "Details P1";
    headerRow.appendChild(detailsHeader);
  }
  table.appendChild(headerRow);

  rows.forEach((row) => {
    const tr = document.createElement("ui5-table-row");
    visibleColumns.forEach((column) => {
      const td = document.createElement("ui5-table-cell");
      td.textContent = safe(row[column.key]);
      tr.appendChild(td);
    });

    if (hiddenColumns.length) {
      const detailsCell = document.createElement("ui5-table-cell");
      const button = document.createElement("ui5-button");
      button.design = "Transparent";
      button.textContent = "View";

      const popover = document.createElement("ui5-responsive-popover");
      popover.headerText = "Collapsed Columns";
      const list = document.createElement("ui5-list");
      hiddenColumns.forEach((column) => {
        const item = document.createElement("ui5-li");
        item.textContent = column.label;
        item.description = safe(row[column.key]);
        list.appendChild(item);
      });
      popover.appendChild(list);
      button.addEventListener("click", () => popover.showAt(button));

      detailsCell.append(button, popover);
      tr.appendChild(detailsCell);
    }

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

export class SignaturesPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.state = {
      filters: { status: "", executed: "", counterparty: "" },
      savedView: "DEFAULT",
      activeFiltersCount: 0,
      asOf: "—",
    };

    this.el = document.createElement("ui5-dynamic-page");

    const pageTitle = document.createElement("ui5-dynamic-page-title");
    const heading = document.createElement("ui5-title");
    heading.level = "H1";
    heading.textContent = "Signatures";
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
    header.subtitleText = "Signature filters";
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
    title.textContent = "Signatures Command";
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

    this.pendingSelect = document.createElement("ui5-select");
    this.pendingSelect.accessibleName = "Pending";
    setOptions(this.pendingSelect, ["PENDING", "NOT_PENDING"], this.state.filters.status);

    this.executedSelect = document.createElement("ui5-select");
    this.executedSelect.accessibleName = "Executed";
    setOptions(this.executedSelect, ["EXECUTED", "NOT_EXECUTED"], this.state.filters.executed);

    this.counterpartySelect = document.createElement("ui5-select");
    this.counterpartySelect.accessibleName = "Counterparty";

    this.savedViewSelect = document.createElement("ui5-select");
    this.savedViewSelect.accessibleName = "Saved View";
    setOptions(this.savedViewSelect, ["DEFAULT", "PENDING_QUEUE", "EXECUTED"], this.state.savedView);

    const applyBtn = document.createElement("ui5-button");
    applyBtn.design = "Emphasized";
    applyBtn.textContent = "Apply";
    applyBtn.addEventListener("click", () => this._applyFilters());

    const clearBtn = document.createElement("ui5-button");
    clearBtn.design = "Transparent";
    clearBtn.textContent = "Clear";
    clearBtn.addEventListener("click", () => this._clearFilters());

    controls.append(this.pendingSelect, this.executedSelect, this.counterpartySelect, this.savedViewSelect, applyBtn, clearBtn);
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
    header.subtitleText = "Pending Signatures Table (dense)";
    header.setAttribute("slot", "header");
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "netz-wave-layer-body";

    this.operationalGovernanceHost = document.createElement("div");
    body.appendChild(this.operationalGovernanceHost);

    this.tableHost = document.createElement("div");
    this.tableHost.className = "netz-wave-table-host";
    body.appendChild(this.tableHost);

    card.appendChild(body);
    return card;
  }

  _buildMonitoringLayer() {
    const card = document.createElement("ui5-card");
    card.className = "netz-wave-layer-card";

    const header = document.createElement("ui5-card-header");
    header.titleText = "Layer 4 — Monitoring";
    header.subtitleText = "Execution Alerts";
    header.setAttribute("slot", "header");
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "netz-wave-layer-body";

    this.monitoringGovernanceHost = document.createElement("div");
    body.appendChild(this.monitoringGovernanceHost);

    const panel = document.createElement("ui5-panel");
    panel.headerText = "Execution Alerts";
    this.alertsHost = document.createElement("div");
    panel.appendChild(this.alertsHost);

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
    this.state.activeFiltersCount = [this.state.filters.status, this.state.filters.executed, this.state.filters.counterparty].filter(Boolean).length;
    this.activeFiltersTag.textContent = `activeFiltersCount ${this.state.activeFiltersCount}`;
    this.asOfTag.textContent = `asOf ${this.state.asOf}`;
  }

  _applyFilters() {
    this.state.savedView = String(this.savedViewSelect.selectedOption?.value || "DEFAULT");
    this.state.filters = {
      status: this.pendingSelect.selectedOption?.value || "",
      executed: this.executedSelect.selectedOption?.value || "",
      counterparty: this.counterpartySelect.selectedOption?.value || "",
    };
    this.onShow();
  }

  _clearFilters() {
    this.state.filters = { status: "", executed: "", counterparty: "" };
    this.state.savedView = "DEFAULT";
    this.onShow();
  }

  _setLayerGovernance(host, payload) {
    host.replaceChildren();
    const strip = buildGovernanceStrip(payload);
    if (strip) host.appendChild(strip);
  }

  _renderAnalytical(rows) {
    const pending = rows.filter((row) => String(firstDefined(row.status, row.workflow_stage, "")).toLowerCase().includes("pending")).length;
    const overdue = rows.filter((row) => {
      const dueValue = firstDefined(row.expiration_date, row.expires_at, row.deadline_at);
      if (!dueValue) return false;
      const due = new Date(dueValue);
      return !Number.isNaN(due.getTime()) && due.getTime() < Date.now() && String(firstDefined(row.status, "")).toLowerCase().includes("pending");
    }).length;

    this.kpiStrip.replaceChildren(
      buildKpiCard({ title: "Pending Signatures", value: safe(pending), status: pending > 0 ? "Warning" : "Success" }),
      buildKpiCard({ title: "Overdue", value: safe(overdue), status: overdue > 0 ? "Error" : "Success" }),
    );
  }

  _renderOperational(rows) {
    const columns = [
      { key: "documentName", label: "Document Name", priority: "P1" },
      { key: "counterparty", label: "Counterparty", priority: "P1" },
      { key: "signatureStatus", label: "Signature Status", priority: "P1" },
      { key: "initiatedDate", label: "Initiated Date", priority: "P2" },
      { key: "expirationDate", label: "Expiration Date", priority: "P2" },
      { key: "lastActionBy", label: "Last Action By", priority: "P2" },
      { key: "owner", label: "Owner", priority: "P1" },
    ];

    const tableRows = rows.map((row) => ({
      documentName: firstDefined(row.document_name, row.document, row.title, row.id),
      counterparty: firstDefined(row.counterparty, row.signer_name, row.signer),
      signatureStatus: firstDefined(row.signature_status, row.status),
      initiatedDate: formatDate(firstDefined(row.initiated_date, row.created_at, row.started_at)),
      expirationDate: formatDate(firstDefined(row.expiration_date, row.expires_at, row.deadline_at, row.due_date)),
      lastActionBy: firstDefined(row.last_action_by, row.updated_by, row.last_actor),
      owner: firstDefined(row.owner, row.owner_name, row.signer_name),
    }));

    this.tableHost.replaceChildren(buildDenseTable(columns, tableRows));
  }

  _renderMonitoring(rows) {
    const alerts = rows
      .filter((row) => {
        const status = String(firstDefined(row.status, "")).toLowerCase();
        const dueValue = firstDefined(row.expiration_date, row.expires_at, row.deadline_at);
        const due = dueValue ? new Date(dueValue) : null;
        const overdue = due && !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
        return status.includes("pending") && overdue;
      })
      .slice(0, 10)
      .map((row) => ({
        text: firstDefined(row.document_name, row.title, row.id, "Execution alert"),
        description: `${safe(firstDefined(row.signer, row.signer_name, row.counterparty), "—")} • overdue`,
      }));

    this.alertsHost.replaceChildren(buildList(alerts, "No execution alerts."));
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
      const signatures = await signaturesApi.listSignatureRequests(this.fundId, {
        limit: 100,
        offset: 0,
        status: this.state.filters.status,
        executed: this.state.filters.executed,
        counterparty: this.state.filters.counterparty,
        saved_view: this.state.savedView,
      });

      let rows = toItems(signatures);

      if (this.state.filters.executed === "EXECUTED") {
        rows = rows.filter((row) => String(firstDefined(row.status, row.signature_status, "")).toLowerCase().includes("execut"));
      }
      if (this.state.filters.executed === "NOT_EXECUTED") {
        rows = rows.filter((row) => !String(firstDefined(row.status, row.signature_status, "")).toLowerCase().includes("execut"));
      }
      if (this.state.filters.status === "PENDING") {
        rows = rows.filter((row) => String(firstDefined(row.status, row.signature_status, "")).toLowerCase().includes("pending"));
      }
      if (this.state.filters.status === "NOT_PENDING") {
        rows = rows.filter((row) => !String(firstDefined(row.status, row.signature_status, "")).toLowerCase().includes("pending"));
      }
      if (this.state.filters.counterparty) {
        rows = rows.filter((row) => String(firstDefined(row.counterparty, row.signer_name, row.signer, "")) === this.state.filters.counterparty);
      }

      this.state.asOf = getAsOf(signatures);
      this._refreshCommandMeta();

      setOptions(
        this.counterpartySelect,
        [...new Set(toItems(signatures).map((row) => firstDefined(row.counterparty, row.signer_name, row.signer)).filter(Boolean))],
        this.state.filters.counterparty,
      );

      this._setLayerGovernance(this.commandGovernanceHost, signatures);
      this._setLayerGovernance(this.analyticalGovernanceHost, signatures);
      this._setLayerGovernance(this.operationalGovernanceHost, signatures);
      this._setLayerGovernance(this.monitoringGovernanceHost, signatures);

      this._renderAnalytical(rows);
      this._renderOperational(rows);
      this._renderMonitoring(rows);
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to load signatures data");
    } finally {
      this.busy.active = false;
    }
  }
}
