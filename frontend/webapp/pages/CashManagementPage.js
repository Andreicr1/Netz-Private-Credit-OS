import * as cashApi from "../api/cash.js";

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

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  if (Number.isNaN(number)) return safe(value);
  return number.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
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
    headerCell.textContent = column.label;
    headerRow.appendChild(headerCell);
  });
  if (hiddenColumns.length) {
    const detailsHeader = document.createElement("ui5-table-header-cell");
    detailsHeader.textContent = "Details";
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

export class CashManagementPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.state = {
      filters: {
        account: "",
        currency: "",
        dateRange: "",
      },
      savedView: "TREASURY",
      activeFiltersCount: 0,
      asOf: "—",
    };
    this.lastTransactionsRows = [];

    this.el = document.createElement("ui5-dynamic-page");

    const pageTitle = document.createElement("ui5-dynamic-page-title");
    const heading = document.createElement("ui5-title");
    heading.level = "H1";
    heading.textContent = "Cash Management";
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
    header.subtitleText = "Cash query filters";
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
    title.textContent = "Treasury Filters";
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

    this.accountSelect = document.createElement("ui5-select");
    this.accountSelect.accessibleName = "Account";

    this.currencySelect = document.createElement("ui5-select");
    this.currencySelect.accessibleName = "Currency";

    this.dateRange = document.createElement("ui5-date-range-picker");
    this.dateRange.accessibleName = "Date Range";

    this.savedViewSelect = document.createElement("ui5-select");
    this.savedViewSelect.accessibleName = "Saved View";
    setOptions(this.savedViewSelect, ["TREASURY", "RECONCILIATION"], this.state.savedView);

    const applyBtn = document.createElement("ui5-button");
    applyBtn.design = "Emphasized";
    applyBtn.textContent = "Apply";
    applyBtn.addEventListener("click", () => this._applyFilters());

    const resetBtn = document.createElement("ui5-button");
    resetBtn.design = "Default";
    resetBtn.textContent = "Reset";
    resetBtn.addEventListener("click", () => this._clearFilters());

    const exportBtn = document.createElement("ui5-button");
    exportBtn.design = "Transparent";
    exportBtn.textContent = "Export";
    exportBtn.addEventListener("click", () => this._exportTransactions());

    controls.append(this.accountSelect, this.currencySelect, this.dateRange, this.savedViewSelect, applyBtn, resetBtn, exportBtn);
    body.append(bar, controls);
    card.appendChild(body);
    return card;
  }

  _buildAnalyticalLayer() {
    const card = document.createElement("ui5-card");
    card.className = "netz-wave-layer-card";

    const header = document.createElement("ui5-card-header");
    header.titleText = "Layer 2 — Analytical";
    header.subtitleText = "Liquidity Overview";
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
    header.subtitleText = "Cash Transactions";
    header.setAttribute("slot", "header");
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "netz-wave-layer-body";

    this.operationalGovernanceHost = document.createElement("div");
    body.appendChild(this.operationalGovernanceHost);

    this.transactionsCard = document.createElement("ui5-card");
    const transactionsHeader = document.createElement("ui5-card-header");
    transactionsHeader.titleText = "Cash Transactions";
    transactionsHeader.subtitleText = "Treasury execution queue";
    transactionsHeader.setAttribute("slot", "header");
    this.transactionsCard.appendChild(transactionsHeader);
    this.transactionsHost = document.createElement("div");
    this.transactionsHost.className = "netz-wave-table-host";
    this.transactionsCard.appendChild(this.transactionsHost);

    body.append(this.transactionsCard);
    card.appendChild(body);
    return card;
  }

  _buildMonitoringLayer() {
    const card = document.createElement("ui5-card");
    card.className = "netz-wave-layer-card";

    const header = document.createElement("ui5-card-header");
    header.titleText = "Layer 4 — Monitoring";
    header.subtitleText = "Exceptions & Alerts";
    header.setAttribute("slot", "header");
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "netz-wave-layer-body";

    this.monitoringGovernanceHost = document.createElement("div");
    body.appendChild(this.monitoringGovernanceHost);

    this.monitoringPanel = document.createElement("ui5-panel");
    this.monitoringPanel.headerText = "Exceptions & Alerts";
    this.monitoringHost = document.createElement("div");
    this.monitoringPanel.appendChild(this.monitoringHost);

    body.appendChild(this.monitoringPanel);
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
      this.state.filters.account,
      this.state.filters.currency,
      this.state.filters.dateRange,
    ].filter(Boolean).length;

    this.activeFiltersTag.textContent = `Filters ${this.state.activeFiltersCount}`;
    this.asOfTag.textContent = `As of: ${this.state.asOf}`;
  }

  _applyFilters() {
    this.state.savedView = String(this.savedViewSelect.selectedOption?.value || "TREASURY");
    this.state.filters = {
      account: this.accountSelect.selectedOption?.value || "",
      currency: this.currencySelect.selectedOption?.value || "",
      dateRange: this.dateRange.value || "",
    };
    this.onShow();
  }

  _clearFilters() {
    this.state.filters = { account: "", currency: "", dateRange: "" };
    this.state.savedView = "TREASURY";
    this.dateRange.value = "";
    this.onShow();
  }

  _setLayerGovernance(host, payload) {
    host.replaceChildren();
    const strip = buildGovernanceStrip(payload);
    if (strip) host.appendChild(strip);
  }

  _exportTransactions() {
    const rows = Array.isArray(this.lastTransactionsRows) ? this.lastTransactionsRows : [];
    const content = JSON.stringify(rows, null, 2);
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cash-transactions-export.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  _renderAnalytical(data) {
    const snapshotTotals = toTotals(data.snapshot);
    const reportTotals = toTotals(data.report);

    const cashAvailable = firstDefined(
      snapshotTotals.cash_available,
      data.snapshot?.cash_available,
      reportTotals.cash_available,
    );

    const runwayDays = firstDefined(
      snapshotTotals.runway_days,
      reportTotals.runway_days,
      data.snapshot?.runway_days,
      data.report?.runway_days,
    );

    const pendingCalls = firstDefined(
      snapshotTotals.pending_calls,
      reportTotals.pending_calls,
      data.snapshot?.pending_calls,
      data.report?.pending_calls,
    );

    this.kpiStrip.replaceChildren(
      buildKpiCard({ title: "Cash Available", value: formatCurrency(cashAvailable), status: "Success" }),
      buildKpiCard({ title: "Runway Days", value: safe(runwayDays), status: "Information" }),
      buildKpiCard({ title: "Pending Calls", value: safe(pendingCalls), status: Number(pendingCalls) > 0 ? "Warning" : "Success" }),
    );
  }

  _renderOperational(data) {
    const transactionsColumns = [
      { key: "transactionId", label: "Transaction ID", priority: "P1" },
      { key: "bookingDate", label: "Booking Date", priority: "P1" },
      { key: "valueDate", label: "Value Date", priority: "P2" },
      { key: "counterparty", label: "Counterparty", priority: "P1" },
      { key: "currency", label: "Currency", priority: "P2" },
      { key: "amount", label: "Amount", priority: "P1" },
      { key: "matchStatus", label: "Match Status", priority: "P1" },
      { key: "approvalStatus", label: "Approval Status", priority: "P1" },
      { key: "agingBucket", label: "Aging Bucket", priority: "P2" },
      { key: "enteredBy", label: "Entered By", priority: "P3" },
    ];

    const transactionsRows = toItems(data.transactions).map((row) => ({
      transactionId: firstDefined(row.transaction_id, row.tx_id, row.id),
      bookingDate: formatDate(firstDefined(row.booking_date, row.date, row.created_at)),
      valueDate: formatDate(firstDefined(row.value_date, row.settlement_date)),
      counterparty: firstDefined(row.counterparty, row.counterparty_name, row.bank_name),
      currency: firstDefined(row.currency, row.ccy),
      amount: formatCurrency(firstDefined(row.amount_usd, row.amount, row.value)),
      matchStatus: firstDefined(row.match_status, row.reconciliation_status, row.matched),
      approvalStatus: firstDefined(row.approval_status, row.workflow_status, row.status),
      agingBucket: firstDefined(row.aging_bucket, row.aging, row.bucket),
      enteredBy: firstDefined(row.entered_by, row.created_by, row.owner),
    }));

    this.lastTransactionsRows = transactionsRows;

    this.transactionsHost.replaceChildren(buildDenseTable(transactionsColumns, transactionsRows));
  }

  _renderMonitoring(unmatchedPayload, reportPayload) {
    const bucketRows = Array.isArray(reportPayload?.aging_buckets)
      ? reportPayload.aging_buckets
      : Array.isArray(reportPayload?.exceptions_by_aging)
        ? reportPayload.exceptions_by_aging
        : Array.isArray(unmatchedPayload?.aging_buckets)
          ? unmatchedPayload.aging_buckets
          : [];

    const bucketItems = bucketRows.map((row) => ({
      text: firstDefined(row.bucket, row.aging_bucket, row.label, "Aging bucket"),
      description: `count ${safe(firstDefined(row.count, row.total, row.items), "—")} • amount ${formatCurrency(firstDefined(row.amount, row.amount_usd, row.total_amount))}`,
    }));

    this.monitoringHost.replaceChildren(buildList(bucketItems, "No aging bucket exceptions."));
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
      const params = {
        limit: 100,
        offset: 0,
        account: this.state.filters.account,
        currency: this.state.filters.currency,
        date_range: this.state.filters.dateRange,
        saved_view: this.state.savedView,
      };

      const [snapshot, transactions, unmatchedPayload, report] = await Promise.all([
        cashApi.getCashSnapshot(this.fundId),
        cashApi.listCashTransactions(this.fundId, params),
        cashApi.listCashUnmatchedReconciliationLines(this.fundId, params),
        cashApi.getCashReconciliationReport(this.fundId),
      ]);

      const unmatched = toItems(unmatchedPayload);
      this.state.asOf = getAsOf(snapshot, transactions, unmatchedPayload, report);
      this._refreshCommandMeta();

      const txRows = toItems(transactions);
      setOptions(
        this.accountSelect,
        [...new Set(txRows.map((row) => firstDefined(row.account, row.account_name, row.bank_account)).filter(Boolean))],
        this.state.filters.account,
      );

      setOptions(
        this.currencySelect,
        [...new Set(txRows.map((row) => firstDefined(row.currency, row.ccy)).filter(Boolean))],
        this.state.filters.currency,
      );

      const viewData = { snapshot, transactions, unmatched, report };

      this._setLayerGovernance(this.commandGovernanceHost, transactions);
      this._setLayerGovernance(this.analyticalGovernanceHost, snapshot);
      this._setLayerGovernance(this.operationalGovernanceHost, unmatchedPayload);
      this._setLayerGovernance(this.monitoringGovernanceHost, report);

      this._renderAnalytical(viewData);
      this._renderOperational(viewData);
      this._renderMonitoring(unmatchedPayload, report);
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to load cash management data");
    } finally {
      this.busy.active = false;
    }
  }
}
