import * as reportingApi from "../api/reporting.js";

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
  strip.textContent = `Data quality notice — latency ${latencyText} (threshold ${signal.threshold}ms), quality ${signal.quality}.`;
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
  objectStatus.text = "Current snapshot";

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

export class ReportingPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.state = {
      filters: {
        period: "",
        reportType: "",
      },
      savedView: "PUBLISHING",
      asOf: "—",
    };

    this.latestPublishedPack = null;

    this.el = document.createElement("ui5-dynamic-page");

    const pageTitle = document.createElement("ui5-dynamic-page-title");
    const heading = document.createElement("ui5-title");
    heading.level = "H1";
    heading.textContent = "Reporting";
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
    header.subtitleText = "Reporting Filters";
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
    title.textContent = "Reporting Filters";
    left.appendChild(title);

    const right = document.createElement("div");
    right.className = "netz-wave-command-meta";
    right.setAttribute("slot", "endContent");

    this.asOfTag = document.createElement("ui5-tag");
    this.asOfTag.design = "Neutral";
    right.appendChild(this.asOfTag);

    bar.append(left, right);

    const controls = document.createElement("div");
    controls.className = "netz-wave-command-controls";

    this.periodSelect = document.createElement("ui5-select");
    this.periodSelect.accessibleName = "Period";

    this.reportTypeSelect = document.createElement("ui5-select");
    this.reportTypeSelect.accessibleName = "Report Type";
    setOptions(this.reportTypeSelect, ["MONTHLY_PACK", "NAV_SNAPSHOT", "INVESTOR_STATEMENT"], this.state.filters.reportType);

    this.savedViewSelect = document.createElement("ui5-select");
    this.savedViewSelect.accessibleName = "Saved View";
    setOptions(this.savedViewSelect, ["PUBLISHING", "NAV"], this.state.savedView);

    const applyBtn = document.createElement("ui5-button");
    applyBtn.design = "Emphasized";
    applyBtn.textContent = "Apply";
    applyBtn.addEventListener("click", () => this._applyFilters());

    const resetBtn = document.createElement("ui5-button");
    resetBtn.design = "Transparent";
    resetBtn.textContent = "Reset";
    resetBtn.addEventListener("click", () => this._clearFilters());

    this.downloadBtn = document.createElement("ui5-button");
    this.downloadBtn.design = "Transparent";
    this.downloadBtn.textContent = "Download Latest Published";
    this.downloadBtn.addEventListener("click", () => this._downloadLatestPublished());

    this.exportBtn = document.createElement("ui5-button");
    this.exportBtn.design = "Transparent";
    this.exportBtn.textContent = "Export Evidence Pack";
    this.exportBtn.addEventListener("click", () => this._exportEvidencePack());

    controls.append(this.periodSelect, this.reportTypeSelect, this.savedViewSelect, applyBtn, resetBtn, this.downloadBtn, this.exportBtn);
    body.append(bar, controls);
    card.appendChild(body);
    return card;
  }

  _buildAnalyticalLayer() {
    const card = document.createElement("ui5-card");
    card.className = "netz-wave-layer-card";

    const header = document.createElement("ui5-card-header");
    header.titleText = "Layer 2 — Analytical";
    header.subtitleText = "Reporting Overview";
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
    header.subtitleText = "Published Reports";
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
    header.subtitleText = "Outstanding Deliverables";
    header.setAttribute("slot", "header");
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "netz-wave-layer-body";

    this.monitoringGovernanceHost = document.createElement("div");
    body.appendChild(this.monitoringGovernanceHost);

    const panel = document.createElement("ui5-panel");
    panel.headerText = "Outstanding Deliverables";
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
    this.asOfTag.textContent = `As of: ${this.state.asOf}`;
  }

  _applyFilters() {
    this.state.savedView = String(this.savedViewSelect.selectedOption?.value || "PUBLISHING");
    this.state.filters = {
      period: this.periodSelect.selectedOption?.value || "",
      reportType: this.reportTypeSelect.selectedOption?.value || "",
    };
    this.onShow();
  }

  _clearFilters() {
    this.state.filters = { period: "", reportType: "" };
    this.state.savedView = "PUBLISHING";
    this.onShow();
  }

  _setLayerGovernance(host, payload) {
    host.replaceChildren();
    const strip = buildGovernanceStrip(payload);
    if (strip) host.appendChild(strip);
  }

  _renderAnalytical(viewData) {
    const navRows = toItems(viewData.navSnapshots);
    const packsRows = toItems(viewData.monthlyPacks);

    const latestNav = navRows[0];
    const latestNavDisplay = latestNav ? firstDefined(latestNav.id, latestNav.snapshot_id, latestNav.period_month) : "—";

    const publishedCount = packsRows.filter((row) => {
      const status = String(firstDefined(row.status, row.workflow_status, "")).toLowerCase();
      return status.includes("published") || status.includes("final");
    }).length;

    this.kpiStrip.replaceChildren(
      buildKpiCard({ title: "Latest NAV Snapshot", value: safe(latestNavDisplay), status: "Information" }),
      buildKpiCard({ title: "Reports Published", value: safe(publishedCount), status: publishedCount > 0 ? "Success" : "Warning" }),
    );
  }

  _renderOperational(rows) {
    const columns = [
      { key: "reportName", label: "Report Name", priority: "CORE" },
      { key: "period", label: "Period", priority: "CORE" },
      { key: "status", label: "Status", priority: "CORE" },
      { key: "version", label: "Version", priority: "SUPPORT" },
      { key: "publishedDate", label: "Published Date", priority: "SUPPORT" },
    ];

    const tableRows = rows.map((row) => ({
      reportName: firstDefined(row.report_name, row.title, row.name, row.id),
      period: firstDefined(row.period_month, row.period, row.month),
      status: firstDefined(row.status, row.workflow_status),
      version: firstDefined(row.version, row.revision),
      publishedDate: formatDate(firstDefined(row.published_at, row.published_date, row.updated_at)),
      raw: row,
    }));

    this.tableHost.replaceChildren(buildDenseTable(columns, tableRows));
  }

  _renderMonitoring(rows) {
    const alerts = rows
      .filter((row) => {
        const status = String(firstDefined(row.status, row.workflow_status, "")).toLowerCase();
        return status.includes("missing") || status.includes("pending") || status.includes("draft");
      })
      .slice(0, 10)
      .map((row) => ({
        text: firstDefined(row.report_name, row.title, row.name, "Missing report"),
        description: `${safe(firstDefined(row.period_month, row.period), "—")} • ${safe(firstDefined(row.status, row.workflow_status), "—")}`,
      }));

    this.alertsHost.replaceChildren(buildList(alerts, "No outstanding deliverables."));
  }

  _resolveLatestPublished(rows) {
    return rows.find((row) => {
      const status = String(firstDefined(row.status, row.workflow_status, "")).toLowerCase();
      return status.includes("published") || status.includes("final");
    }) || null;
  }

  async _downloadLatestPublished() {
    if (!this.latestPublishedPack) {
      this._setError("No published report is available for download.");
      return;
    }

    const packId = firstDefined(this.latestPublishedPack.id, this.latestPublishedPack.pack_id);
    if (!packId) {
      this._setError("Unable to download: missing report identifier.");
      return;
    }

    this.busy.active = true;
    this._clearError();
    try {
      await reportingApi.downloadMonthlyPack(this.fundId, packId);
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to download monthly pack");
    } finally {
      this.busy.active = false;
    }
  }

  async _exportEvidencePack() {
    if (!this.latestPublishedPack) {
      this._setError("No published report is available for export.");
      return;
    }

    this.busy.active = true;
    this._clearError();
    try {
      await reportingApi.exportEvidencePack(this.fundId, {
        period_month: firstDefined(this.latestPublishedPack.period_month, this.latestPublishedPack.period),
        pack_id: firstDefined(this.latestPublishedPack.id, this.latestPublishedPack.pack_id),
      });
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to export evidence pack");
    } finally {
      this.busy.active = false;
    }
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
      const [navSnapshots, monthlyPacks] = await Promise.all([
        reportingApi.listNavSnapshots(this.fundId, {
          limit: 100,
          offset: 0,
          period_month: this.state.filters.period,
          report_type: this.state.filters.reportType,
          saved_view: this.state.savedView,
        }),
        reportingApi.listMonthlyPacks(this.fundId),
      ]);

      const packsRows = toItems(monthlyPacks).filter((row) => {
        const period = this.state.filters.period;
        const reportType = this.state.filters.reportType;

        const periodMatch = !period || String(firstDefined(row.period_month, row.period, "")) === period;
        const typeValue = String(firstDefined(row.report_type, row.type, "MONTHLY_PACK"));
        const typeMatch = !reportType || typeValue === reportType;
        return periodMatch && typeMatch;
      });

      this.latestPublishedPack = this._resolveLatestPublished(packsRows);
      this.downloadBtn.disabled = !this.latestPublishedPack;
      this.exportBtn.disabled = !this.latestPublishedPack;

      this.state.asOf = getAsOf(navSnapshots, monthlyPacks);
      this._refreshCommandMeta();

      setOptions(
        this.periodSelect,
        [...new Set(toItems(monthlyPacks).map((row) => firstDefined(row.period_month, row.period)).filter(Boolean))],
        this.state.filters.period,
      );

      this._setLayerGovernance(this.commandGovernanceHost, monthlyPacks);
      this._setLayerGovernance(this.analyticalGovernanceHost, navSnapshots);
      this._setLayerGovernance(this.operationalGovernanceHost, monthlyPacks);
      this._setLayerGovernance(this.monitoringGovernanceHost, monthlyPacks);

      this._renderAnalytical({ navSnapshots, monthlyPacks });
      this._renderOperational(packsRows);
      this._renderMonitoring(packsRows);
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to load reporting packs data");
    } finally {
      this.busy.active = false;
    }
  }
}
