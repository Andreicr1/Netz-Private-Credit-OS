import * as complianceApi from "../api/compliance.js";
import * as portfolioApi from "../api/portfolio.js";

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
    headerCell.textContent = column.label;
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

function normalizeFlag(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "YES" : "NO";
  return safe(value);
}

export class CompliancePage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.state = {
      filters: {
        obligationType: "",
        dueWindow: "",
        owner: "",
      },
      savedView: "REGULATORY",
      activeFiltersCount: 0,
      asOf: "—",
    };

    this.el = document.createElement("ui5-dynamic-page");

    const pageTitle = document.createElement("ui5-dynamic-page-title");
    const heading = document.createElement("ui5-title");
    heading.level = "H1";
    heading.textContent = "Compliance";
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
    header.subtitleText = "Compliance filters";
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
    title.textContent = "Compliance Filters";
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

    this.obligationTypeSelect = document.createElement("ui5-select");
    this.obligationTypeSelect.accessibleName = "Obligation Type";

    this.dueWindowSelect = document.createElement("ui5-select");
    this.dueWindowSelect.accessibleName = "Due Window";
    setOptions(this.dueWindowSelect, ["7D", "30D", "90D"], this.state.filters.dueWindow);

    this.ownerSelect = document.createElement("ui5-select");
    this.ownerSelect.accessibleName = "Owner";

    this.savedViewSelect = document.createElement("ui5-select");
    this.savedViewSelect.accessibleName = "Saved View";
    setOptions(this.savedViewSelect, ["REGULATORY", "AUDIT"], this.state.savedView);

    const applyBtn = document.createElement("ui5-button");
    applyBtn.design = "Emphasized";
    applyBtn.textContent = "Apply";
    applyBtn.addEventListener("click", () => this._applyFilters());

    const resetBtn = document.createElement("ui5-button");
    resetBtn.design = "Default";
    resetBtn.textContent = "Reset";
    resetBtn.addEventListener("click", () => this._clearFilters());

    controls.append(this.obligationTypeSelect, this.dueWindowSelect, this.ownerSelect, this.savedViewSelect, applyBtn, resetBtn);
    body.append(bar, controls);
    card.appendChild(body);
    return card;
  }

  _buildAnalyticalLayer() {
    const card = document.createElement("ui5-card");
    card.className = "netz-wave-layer-card";

    const header = document.createElement("ui5-card-header");
    header.titleText = "Layer 2 — Analytical";
    header.subtitleText = "Compliance Overview";
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
    header.subtitleText = "Covenant Monitoring and Obligation Register";
    header.setAttribute("slot", "header");
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "netz-wave-layer-body";

    this.operationalGovernanceHost = document.createElement("div");
    body.appendChild(this.operationalGovernanceHost);

    this.covenantCard = document.createElement("ui5-card");
    const covenantHeader = document.createElement("ui5-card-header");
    covenantHeader.titleText = "Covenant Monitoring";
    covenantHeader.subtitleText = "Audit-grade covenant monitoring";
    covenantHeader.setAttribute("slot", "header");
    this.covenantCard.appendChild(covenantHeader);
    this.covenantHost = document.createElement("div");
    this.covenantHost.className = "netz-wave-table-host";
    this.covenantCard.appendChild(this.covenantHost);

    this.obligationCard = document.createElement("ui5-card");
    const obligationHeader = document.createElement("ui5-card-header");
    obligationHeader.titleText = "Obligation Register";
    obligationHeader.subtitleText = "Institutional obligations";
    obligationHeader.setAttribute("slot", "header");
    this.obligationCard.appendChild(obligationHeader);
    this.obligationsHost = document.createElement("div");
    this.obligationsHost.className = "netz-wave-table-host";
    this.obligationCard.appendChild(this.obligationsHost);

    body.append(this.covenantCard, this.obligationCard);

    card.appendChild(body);
    return card;
  }

  _buildMonitoringLayer() {
    const card = document.createElement("ui5-card");
    card.className = "netz-wave-layer-card";

    const header = document.createElement("ui5-card-header");
    header.titleText = "Layer 4 — Monitoring";
    header.subtitleText = "Compliance Alerts and Governance Notes";
    header.setAttribute("slot", "header");
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "netz-wave-layer-body";

    this.monitoringGovernanceHost = document.createElement("div");
    body.appendChild(this.monitoringGovernanceHost);

    this.monitorGrid = document.createElement("div");
    this.monitorGrid.className = "netz-wave-monitor-grid";

    this.breachPanel = document.createElement("ui5-panel");
    this.breachPanel.headerText = "Compliance Alerts";
    this.breachHost = document.createElement("div");
    this.breachPanel.appendChild(this.breachHost);

    this.governancePanel = document.createElement("ui5-panel");
    this.governancePanel.headerText = "Governance Notes";
    this.covenantIntegrationStrip = document.createElement("ui5-message-strip");
    this.covenantIntegrationStrip.design = "Information";
    this.covenantIntegrationStrip.hideCloseButton = true;
    this.covenantIntegrationStrip.textContent = "Covenant obligations are tracked and surfaced for review.";
    this.governancePanel.appendChild(this.covenantIntegrationStrip);
    this.governanceHost = document.createElement("div");
    this.governancePanel.appendChild(this.governanceHost);

    this.monitorGrid.append(this.breachPanel, this.governancePanel);
    body.appendChild(this.monitorGrid);
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
      this.state.filters.obligationType,
      this.state.filters.dueWindow,
      this.state.filters.owner,
    ].filter(Boolean).length;

    this.activeFiltersTag.textContent = `Filters ${this.state.activeFiltersCount}`;
    this.asOfTag.textContent = `As of: ${this.state.asOf}`;
  }

  _applyFilters() {
    this.state.savedView = String(this.savedViewSelect.selectedOption?.value || "REGULATORY");
    this.state.filters = {
      obligationType: this.obligationTypeSelect.selectedOption?.value || "",
      dueWindow: this.dueWindowSelect.selectedOption?.value || "",
      owner: this.ownerSelect.selectedOption?.value || "",
    };
    this.onShow();
  }

  _clearFilters() {
    this.state.filters = { obligationType: "", dueWindow: "", owner: "" };
    this.state.savedView = "REGULATORY";
    this.onShow();
  }

  _setLayerGovernance(host, payload) {
    host.replaceChildren();
    const strip = buildGovernanceStrip(payload);
    if (strip) host.appendChild(strip);
  }

  _renderAnalytical(data) {
    const snapshotTotals = toTotals(data.snapshot);
    const obligationsTotals = toTotals(data.obligations);

    const openObligations = firstDefined(
      snapshotTotals.open_obligations,
      obligationsTotals.open,
      data.snapshot?.open_obligations,
      data.obligationsRows.length,
    );

    const overdue = firstDefined(
      snapshotTotals.overdue,
      obligationsTotals.overdue,
      data.snapshot?.overdue,
    );

    const evidenceMissing = firstDefined(
      snapshotTotals.evidence_missing,
      obligationsTotals.evidence_missing,
      data.snapshot?.evidence_missing,
    );

    this.kpiStrip.replaceChildren(
      buildKpiCard({ title: "Open Obligations", value: safe(openObligations), status: "Information" }),
      buildKpiCard({ title: "Overdue", value: safe(overdue), status: Number(overdue) > 0 ? "Error" : "Success" }),
      buildKpiCard({ title: "Evidence Missing", value: safe(evidenceMissing), status: Number(evidenceMissing) > 0 ? "Warning" : "Success" }),
    );
  }

  _renderCovenantTable(covenantsRows, breachesRows) {
    const byCovenantId = new Map();
    const byCovenantName = new Map();

    breachesRows.forEach((row) => {
      const id = firstDefined(row.covenant_id, row.covenantId);
      const name = firstDefined(row.covenant, row.covenant_name, row.name, row.code);
      if (id) byCovenantId.set(String(id), row);
      if (name) byCovenantName.set(String(name), row);
    });

    const rows = covenantsRows.map((row) => {
      const id = firstDefined(row.id, row.covenant_id, row.covenantId);
      const name = firstDefined(row.covenant, row.covenant_name, row.name, row.code);
      const breach = (id && byCovenantId.get(String(id))) || (name && byCovenantName.get(String(name))) || null;

      return {
        covenant: name,
        threshold: firstDefined(row.threshold, row.threshold_value, row.limit, row.test_threshold),
        actual: firstDefined(row.actual, row.actual_value, breach?.actual, breach?.actual_value),
        breachFlag: normalizeFlag(firstDefined(row.breach_flag, row.is_breach, breach?.breach_flag, breach?.is_breach, breach?.status)),
        lastTested: formatDate(firstDefined(row.last_tested, row.last_tested_at, breach?.last_tested, breach?.tested_at, breach?.created_at)),
        evidenceLink: firstDefined(row.evidence_link, row.evidence_url, breach?.evidence_link, breach?.evidence_url),
      };
    });

    const columns = [
      { key: "covenant", label: "Covenant", priority: "P1" },
      { key: "threshold", label: "Threshold", priority: "P1" },
      { key: "actual", label: "Actual", priority: "P1" },
      { key: "breachFlag", label: "Breach Flag", priority: "P1" },
      { key: "lastTested", label: "Last Tested", priority: "P2" },
      { key: "evidenceLink", label: "Evidence Link", priority: "P2" },
    ];

    this.covenantHost.replaceChildren(buildDenseTable(columns, rows));
  }

  _renderOperational(obligationsRows) {
    const columns = [
      { key: "obligation", label: "Obligation", priority: "P1" },
      { key: "dueDate", label: "Due Date", priority: "P1" },
      { key: "evidenceStatus", label: "Evidence Status", priority: "P1" },
      { key: "workflowStatus", label: "Workflow Status", priority: "P2" },
      { key: "type", label: "Type", priority: "P2" },
      { key: "owner", label: "Owner", priority: "P3" },
    ];

    const rows = obligationsRows.map((row) => ({
      obligation: firstDefined(row.title, row.name, row.obligation, row.id),
      dueDate: formatDate(firstDefined(row.due_date, row.dueDate)),
      evidenceStatus: firstDefined(row.evidence_status, row.evidenceStatus, row.evidence),
      workflowStatus: firstDefined(row.workflow_status, row.status),
      type: firstDefined(row.obligation_type, row.type),
      owner: firstDefined(row.owner, row.owner_name),
    }));

    this.obligationsHost.replaceChildren(buildDenseTable(columns, rows));
  }

  _renderMonitoring(data) {
    const breachItems = toItems(data.gaps).slice(0, 10).map((row) => ({
      text: firstDefined(row.title, row.name, row.code, "Compliance breach"),
      description: firstDefined(row.severity, row.status, row.message, "—"),
    }));

    const covenantObligationItems = data.obligationsRows
      .filter((row) => {
        const type = String(firstDefined(row.obligation_type, row.type, "")).toLowerCase();
        return type.includes("covenant") || type.includes("breach");
      })
      .slice(0, 10)
      .map((row) => ({
        text: firstDefined(row.title, row.name, row.obligation, row.id, "Covenant obligation"),
        description: `${safe(firstDefined(row.workflow_status, row.status), "—")} • evidence ${safe(firstDefined(row.evidence_status, row.evidenceStatus, row.evidence), "—")}`,
      }));

    const governanceItems = [
      {
        text: "As of",
        description: safe(this.state.asOf),
      },
      {
        text: "Filters Applied",
        description: safe(this.state.activeFiltersCount),
      },
      {
        text: "View",
        description: safe(this.state.savedView),
      },
    ];

    this.breachHost.replaceChildren(buildList(breachItems, "No alerts available."));
    this.governanceHost.replaceChildren(buildList(covenantObligationItems.length ? covenantObligationItems : governanceItems, covenantObligationItems.length ? "No covenant obligations available." : "No governance notes available."));
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
      const obligationParams = {
        limit: 100,
        offset: 0,
        view: "all",
        obligation_type: this.state.filters.obligationType,
        due_window: this.state.filters.dueWindow,
        owner: this.state.filters.owner,
        saved_view: this.state.savedView,
      };

      const [snapshot, obligations, gaps, covenants, breaches] = await Promise.all([
        complianceApi.getComplianceSnapshot(this.fundId),
        complianceApi.listComplianceObligations(this.fundId, obligationParams),
        complianceApi.listComplianceGaps(this.fundId, { limit: 100, offset: 0 }),
        portfolioApi.listCovenants(this.fundId, { limit: 100, offset: 0 }),
        portfolioApi.listBreaches(this.fundId, { limit: 100, offset: 0 }),
      ]);

      const obligationsRows = toItems(obligations);
      const covenantsRows = toItems(covenants);
      const breachesRows = toItems(breaches);

      this.state.asOf = getAsOf(snapshot, obligations, gaps, covenants, breaches);
      this._refreshCommandMeta();

      setOptions(
        this.obligationTypeSelect,
        [...new Set(obligationsRows.map((row) => firstDefined(row.obligation_type, row.type)).filter(Boolean))],
        this.state.filters.obligationType,
      );

      setOptions(
        this.ownerSelect,
        [...new Set(obligationsRows.map((row) => firstDefined(row.owner, row.owner_name)).filter(Boolean))],
        this.state.filters.owner,
      );

      const viewData = { snapshot, obligations, gaps, obligationsRows, covenantsRows, breachesRows };

      this._setLayerGovernance(this.commandGovernanceHost, obligations);
      this._setLayerGovernance(this.analyticalGovernanceHost, snapshot);
      this._setLayerGovernance(this.operationalGovernanceHost, covenants);
      this._setLayerGovernance(this.monitoringGovernanceHost, gaps);

      this._renderAnalytical(viewData);
      this._renderCovenantTable(covenantsRows, breachesRows);
      this._renderOperational(obligationsRows);
      this._renderMonitoring(viewData);
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to load compliance data");
    } finally {
      this.busy.active = false;
    }
  }
}
