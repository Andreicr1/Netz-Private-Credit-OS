import * as portfolioApi from "../api/portfolio.js";

const LATENCY_THRESHOLD = 300;

function safe(value, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function toItems(payload) {
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload)) return payload;
  return [];
}

function toTotals(payload) {
  return payload?.totals && typeof payload.totals === "object" ? payload.totals : {};
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
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

function formatPercent(value) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  if (Number.isNaN(number)) return safe(value);
  return `${number.toFixed(2)}%`;
}

function getAsOf(...payloads) {
  for (const payload of payloads) {
    const asOf = firstDefined(payload?.asOf, payload?.as_of, payload?.timestamp, payload?.generated_at);
    if (asOf) return formatDate(asOf);
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
  const empty = document.createElement("ui5-option");
  empty.value = "";
  empty.textContent = "All";
  select.appendChild(empty);

  options.forEach((value) => {
    const option = document.createElement("ui5-option");
    option.value = String(value);
    option.textContent = String(value);
    if (selected && String(selected) === String(value)) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

function setMultiComboItems(combo, options, selectedSet) {
  combo.replaceChildren();
  options.forEach((value) => {
    const item = document.createElement("ui5-mcb-item");
    item.text = String(value);
    item.value = String(value);
    if (selectedSet?.has(String(value))) {
      item.selected = true;
    }
    combo.appendChild(item);
  });
}

function selectedMultiValues(combo) {
  return Array.from(combo.querySelectorAll("ui5-mcb-item")).filter((item) => item.selected).map((item) => String(item.value || item.text || "").trim()).filter(Boolean);
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
    const cell = document.createElement("ui5-table-header-cell");
    cell.textContent = `${column.label} ${column.priority}`;
    headerRow.appendChild(cell);
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
    if (item.description) li.description = safe(item.description);
    list.appendChild(li);
  });
  return list;
}

export class PortfolioPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.state = {
      filters: {
        vehicle: "",
        borrower: [],
        riskBand: [],
        dateRange: "",
      },
      savedView: "DEFAULT",
      activeFiltersCount: 0,
      asOf: "—",
    };

    this.el = document.createElement("ui5-dynamic-page");

    const pageTitle = document.createElement("ui5-dynamic-page-title");
    const heading = document.createElement("ui5-title");
    heading.level = "H1";
    heading.textContent = "Portfolio";
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
    this.operationalLayer = this._buildOperationalLayer();
    this.monitoringLayer = this._buildMonitoringLayer();

    content.append(this.commandLayer, this.operationalLayer, this.monitoringLayer);
    this.busy.appendChild(content);
    this.el.appendChild(this.busy);
  }

  _buildCommandLayer() {
    const card = document.createElement("ui5-card");
    card.className = "netz-wave-layer-card";

    const header = document.createElement("ui5-card-header");
    header.titleText = "Layer 1 — Command";
    header.subtitleText = "Filters, saved view and execution scope";
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
    title.textContent = "Fund + Portfolio Snapshot";
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

    this.fundTag = document.createElement("ui5-tag");
    this.fundTag.design = "Set2";
    right.appendChild(this.fundTag);

    bar.append(left, right);

    const controls = document.createElement("div");
    controls.className = "netz-wave-command-controls";

    this.vehicleSelect = document.createElement("ui5-select");
    this.borrowerCombo = document.createElement("ui5-multi-combobox");
    this.riskBandCombo = document.createElement("ui5-multi-combobox");
    this.dateRange = document.createElement("ui5-date-range-picker");
    this.savedViewSelect = document.createElement("ui5-select");

    this.vehicleSelect.accessibleName = "Vehicle";
    this.borrowerCombo.accessibleName = "Borrower";
    this.riskBandCombo.accessibleName = "Risk Band";
    this.dateRange.accessibleName = "Date Range";
    this.savedViewSelect.accessibleName = "Saved View";

    setOptions(this.savedViewSelect, ["DEFAULT", "RISK_COMMITTEE", "CREDIT_DESK"], this.state.savedView);

    const applyBtn = document.createElement("ui5-button");
    applyBtn.design = "Emphasized";
    applyBtn.textContent = "Apply";
    applyBtn.addEventListener("click", () => this._applyFilters());

    const clearBtn = document.createElement("ui5-button");
    clearBtn.design = "Transparent";
    clearBtn.textContent = "Clear";
    clearBtn.addEventListener("click", () => this._clearFilters());

    controls.append(this.vehicleSelect, this.borrowerCombo, this.riskBandCombo, this.dateRange, this.savedViewSelect, applyBtn, clearBtn);

    body.append(bar, controls);
    card.appendChild(body);
    return card;
  }

  _buildOperationalLayer() {
    const card = document.createElement("ui5-card");
    card.className = "netz-wave-layer-card";

    const header = document.createElement("ui5-card-header");
    header.titleText = "Layer 3 — Operational";
    header.subtitleText = "Audit-grade dense tables";
    header.setAttribute("slot", "header");
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "netz-wave-layer-body";

    this.operationalGovernanceHost = document.createElement("div");
    body.appendChild(this.operationalGovernanceHost);

    this.borrowersCard = document.createElement("ui5-card");
    const borrowersHeader = document.createElement("ui5-card-header");
    borrowersHeader.titleText = "Borrowers Table";
    borrowersHeader.subtitleText = "Institutional operating table";
    borrowersHeader.setAttribute("slot", "header");
    this.borrowersCard.appendChild(borrowersHeader);
    this.borrowersHost = document.createElement("div");
    this.borrowersHost.className = "netz-wave-table-host";
    this.borrowersCard.appendChild(this.borrowersHost);

    this.loansCard = document.createElement("ui5-card");
    const loansHeader = document.createElement("ui5-card-header");
    loansHeader.titleText = "Loans Table";
    loansHeader.subtitleText = "Institutional operating table";
    loansHeader.setAttribute("slot", "header");
    this.loansCard.appendChild(loansHeader);
    this.loansHost = document.createElement("div");
    this.loansHost.className = "netz-wave-table-host";
    this.loansCard.appendChild(this.loansHost);

    body.append(this.borrowersCard, this.loansCard);
    card.appendChild(body);
    return card;
  }

  _buildMonitoringLayer() {
    const card = document.createElement("ui5-card");
    card.className = "netz-wave-layer-card";

    const header = document.createElement("ui5-card-header");
    header.titleText = "Layer 4 — Monitoring";
    header.subtitleText = "Backend-driven alerts only";
    header.setAttribute("slot", "header");
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "netz-wave-layer-body";

    this.monitoringGovernanceHost = document.createElement("div");
    body.appendChild(this.monitoringGovernanceHost);

    const panel = document.createElement("ui5-panel");
    panel.headerText = "Alerts Panel";

    this.monitoringContent = document.createElement("div");
    this.monitoringContent.className = "netz-wave-monitor-grid";
    panel.appendChild(this.monitoringContent);

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
      this.state.filters.vehicle,
      this.state.filters.dateRange,
      ...(this.state.filters.borrower || []),
      ...(this.state.filters.riskBand || []),
    ].filter(Boolean).length;

    this.activeFiltersTag.textContent = `activeFiltersCount ${this.state.activeFiltersCount}`;
    this.asOfTag.textContent = `asOf ${this.state.asOf}`;
    this.fundTag.textContent = `fund ${safe(this.fundId)}`;
  }

  _applyFilters() {
    const selectedView = this.savedViewSelect.selectedOption?.value || "DEFAULT";
    this.state.savedView = String(selectedView);
    this.state.filters = {
      vehicle: this.vehicleSelect.selectedOption?.value || "",
      borrower: selectedMultiValues(this.borrowerCombo),
      riskBand: selectedMultiValues(this.riskBandCombo),
      dateRange: this.dateRange.value || "",
    };
    this.onShow();
  }

  _clearFilters() {
    this.state.filters = { vehicle: "", borrower: [], riskBand: [], dateRange: "" };
    this.state.savedView = "DEFAULT";
    this.vehicleSelect.selectedIndex = 0;
    this.dateRange.value = "";
    setOptions(this.savedViewSelect, ["DEFAULT", "RISK_COMMITTEE", "CREDIT_DESK"], this.state.savedView);
    this.onShow();
  }

  _setLayerGovernance(host, payload) {
    host.replaceChildren();
    const strip = buildGovernanceStrip(payload);
    if (strip) host.appendChild(strip);
  }

  _renderOperational(payload) {
    const borrowerRows = toItems(payload.borrowers).map((row) => ({
      borrowerName: firstDefined(row.borrower_name, row.borrower, row.name),
      legalEntity: firstDefined(row.legal_entity, row.legalEntity, row.entity_name),
      exposure: formatCurrency(firstDefined(row.exposure, row.exposure_usd, row.notional)),
      navPct: formatPercent(firstDefined(row.nav_pct, row.percent_nav, row.pct_nav, row.nav_percentage)),
      riskBand: firstDefined(row.risk_band, row.risk_rating),
      covenantStatus: firstDefined(row.covenant_status, row.covenantStatus),
      country: firstDefined(row.country, row.country_code),
      sector: firstDefined(row.sector, row.industry),
      lastReviewDate: formatDate(firstDefined(row.last_review_date, row.reviewed_at, row.last_reviewed_at)),
      owner: firstDefined(row.owner, row.owner_name, row.relationship_manager),
    }));

    const loanRows = toItems(payload.loans).map((row) => ({
      facilityName: firstDefined(row.facility_name, row.facility, row.loan_name),
      borrower: firstDefined(row.borrower_name, row.borrower, row.counterparty),
      principalOutstanding: formatCurrency(firstDefined(row.principal_outstanding, row.principal, row.principal_amount, row.notional)),
      interestRate: firstDefined(row.interest_rate, row.rate),
      rateType: firstDefined(row.rate_type, row.interest_rate_type),
      maturityDate: formatDate(firstDefined(row.maturity_date, row.maturity)),
      daysToMaturity: firstDefined(row.days_to_maturity, row.daysToMaturity),
      covenantStatus: firstDefined(row.covenant_status, row.status, row.state),
      collateralType: firstDefined(row.collateral_type, row.collateral),
      internalRating: firstDefined(row.internal_rating, row.rating),
      status: firstDefined(row.status, row.workflow_status, row.state),
    }));

    const borrowerColumns = [
      { key: "borrowerName", label: "Borrower Name", priority: "P1" },
      { key: "legalEntity", label: "Legal Entity", priority: "P2" },
      { key: "exposure", label: "Exposure", priority: "P1" },
      { key: "navPct", label: "% NAV", priority: "P1" },
      { key: "riskBand", label: "Risk Band", priority: "P2" },
      { key: "covenantStatus", label: "Covenant Status", priority: "P1" },
      { key: "country", label: "Country", priority: "P2" },
      { key: "sector", label: "Sector", priority: "P2" },
      { key: "lastReviewDate", label: "Last Review Date", priority: "P3" },
      { key: "owner", label: "Owner", priority: "P2" },
    ];

    const loansColumns = [
      { key: "facilityName", label: "Facility Name", priority: "P1" },
      { key: "borrower", label: "Borrower", priority: "P1" },
      { key: "principalOutstanding", label: "Principal Outstanding", priority: "P1" },
      { key: "interestRate", label: "Interest Rate", priority: "P2" },
      { key: "rateType", label: "Rate Type", priority: "P2" },
      { key: "maturityDate", label: "Maturity Date", priority: "P2" },
      { key: "daysToMaturity", label: "Days to Maturity", priority: "P1" },
      { key: "covenantStatus", label: "Covenant Status", priority: "P1" },
      { key: "collateralType", label: "Collateral Type", priority: "P3" },
      { key: "internalRating", label: "Internal Rating", priority: "P2" },
      { key: "status", label: "Status", priority: "P1" },
    ];

    this.borrowersHost.replaceChildren(buildDenseTable(borrowerColumns, borrowerRows));
    this.loansHost.replaceChildren(buildDenseTable(loansColumns, loanRows));
  }

  _renderMonitoring(payload) {
    const alertsItems = toItems(payload.alerts).slice(0, 12).map((item) => ({
      text: firstDefined(item.alert_type, item.name, item.borrower, "Alert"),
      description: firstDefined(item.message, item.severity, item.status, "—"),
    }));

    const alertsWrap = document.createElement("div");
    const alertsTitle = document.createElement("ui5-title");
    alertsTitle.level = "H6";
    alertsTitle.textContent = "Backend Alerts";
    alertsWrap.append(alertsTitle, buildList(alertsItems, "No backend alerts."));

    this.monitoringContent.replaceChildren(alertsWrap);
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
      const borrowerParams = {
        limit: 50,
        offset: 0,
        vehicle: this.state.filters.vehicle,
        risk_band: this.state.filters.riskBand.join(","),
        borrower: this.state.filters.borrower.join(","),
        as_of_range: this.state.filters.dateRange,
        saved_view: this.state.savedView,
      };

      const loanParams = {
        limit: 50,
        offset: 0,
        vehicle: this.state.filters.vehicle,
        borrower: this.state.filters.borrower.join(","),
        as_of_range: this.state.filters.dateRange,
        saved_view: this.state.savedView,
      };

      const [borrowers, loans, alerts] = await Promise.all([
        portfolioApi.listBorrowers(this.fundId, borrowerParams),
        portfolioApi.listLoans(this.fundId, loanParams),
        portfolioApi.listAlerts(this.fundId, { limit: 50, offset: 0 }),
      ]);

      this.state.asOf = getAsOf(borrowers, loans, alerts);
      this._refreshCommandMeta();

      setOptions(
        this.vehicleSelect,
        [...new Set(toItems(borrowers).map((row) => firstDefined(row.vehicle, row.vehicle_name)).filter(Boolean))],
        this.state.filters.vehicle,
      );

      setMultiComboItems(
        this.borrowerCombo,
        [...new Set(toItems(borrowers).map((row) => firstDefined(row.borrower, row.name, row.borrower_name)).filter(Boolean))],
        new Set(this.state.filters.borrower),
      );

      setMultiComboItems(
        this.riskBandCombo,
        [...new Set(toItems(borrowers).map((row) => firstDefined(row.risk_band, row.risk_rating)).filter(Boolean))],
        new Set(this.state.filters.riskBand),
      );

      const viewPayload = { borrowers, loans, alerts };

      this._setLayerGovernance(this.commandGovernanceHost, borrowers);
      this._setLayerGovernance(this.operationalGovernanceHost, viewPayload);
      this._setLayerGovernance(this.monitoringGovernanceHost, alerts);

      this._renderOperational(viewPayload);
      this._renderMonitoring(viewPayload);
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to load portfolio data");
    } finally {
      this.busy.active = false;
    }
  }
}
