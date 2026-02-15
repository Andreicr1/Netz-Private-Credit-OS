import * as portfolioApi from "../api/portfolio.js";

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

function getAsOf(...payloads) {
  for (const payload of payloads) {
    const asOf = firstDefined(payload?.asOf, payload?.as_of, payload?.timestamp, payload?.generated_at);
    if (asOf) return formatDate(asOf);
  }
  return "—";
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

function makeStatusBadge(text) {
  const status = document.createElement("ui5-tag");
  const normalized = String(text || "").toLowerCase();
  status.textContent = safe(text, "—");
  status.design = normalized.includes("breach") || normalized.includes("late") || normalized.includes("overdue")
    ? "Negative"
    : normalized.includes("watch") || normalized.includes("pending")
      ? "Critical"
      : "Positive";
  return status;
}

function buildItemList(rows, onSelect) {
  const list = document.createElement("div");
  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "netz-meta-text";
    empty.textContent = "No records available.";
    list.appendChild(empty);
    return list;
  }

  rows.forEach((row) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "netz-entity-row";

    const title = document.createElement("div");
    title.className = "netz-entity-title";
    title.textContent = safe(row.borrowerName);

    const meta = document.createElement("div");
    meta.className = "netz-entity-meta";
    meta.textContent = `${safe(row.exposure)} • ${safe(row.riskBand)}`;

    const badgeWrap = document.createElement("div");
    badgeWrap.className = "netz-entity-badge";
    badgeWrap.appendChild(makeStatusBadge(row.covenantStatus));
    meta.appendChild(badgeWrap);

    item.append(title, meta);
    item.addEventListener("click", () => onSelect(row));
    list.appendChild(item);
  });

  return list;
}

function buildOverviewList(items) {
  const list = document.createElement("ui5-list");
  if (!items.length) {
    const empty = document.createElement("ui5-li");
    empty.textContent = "No records available.";
    list.appendChild(empty);
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

function buildSelectableList(items, onSelect) {
  const list = document.createElement("div");
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "netz-meta-text";
    empty.textContent = "No records available.";
    list.appendChild(empty);
    return list;
  }

  items.forEach((item) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "netz-entity-row";

    const title = document.createElement("div");
    title.className = "netz-entity-title";
    title.textContent = safe(item.text);

    const meta = document.createElement("div");
    meta.className = "netz-entity-meta";
    meta.textContent = safe(item.description);

    row.append(title, meta);
    row.addEventListener("click", () => onSelect(item));
    list.appendChild(row);
  });

  return list;
}

async function listFacilities(fundId, params) {
  return portfolioApi.listLoans(fundId, params);
}

export class PortfolioPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.state = {
      filters: {
        investmentType: "",
        borrower: [],
        riskBand: [],
      },
      listView: "BORROWERS",
      asOf: "—",
      investmentTypes: [],
    };
    this.data = {
      borrowers: [],
      facilities: [],
      alerts: [],
    };
    this.selectedItem = null;
    this.selectedSubDetail = null;

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

    const layout = document.createElement("div");
    layout.className = "netz-fcl";

    this.beginColumn = this._buildBeginColumn();
    this.midColumn = this._buildMidColumn();
    this.endColumn = this._buildEndColumn();
    layout.append(this.beginColumn, this.midColumn, this.endColumn);

    content.appendChild(layout);
    this.busy.appendChild(content);
    this.el.appendChild(this.busy);
  }

  _buildBeginColumn() {
    const column = document.createElement("div");
    column.className = "netz-fcl-col netz-fcl-col--begin";

    const header = document.createElement("div");
    header.className = "netz-fcl-header";
    const title = document.createElement("div");
    title.className = "netz-title-strong";
    title.textContent = "Borrowers";
    const subtitle = document.createElement("div");
    subtitle.className = "netz-meta-text";
    subtitle.textContent = "Entity Navigation";
    header.append(title, subtitle);
    column.appendChild(header);

    const body = document.createElement("div");
    body.className = "netz-fcl-body";

    const controls = document.createElement("div");
    controls.className = "netz-multi netz-fcl-filter-bar";

    this.listViewSelect = document.createElement("ui5-select");
    this.listViewSelect.accessibleName = "Navigation";
    setOptions(this.listViewSelect, ["Borrowers", "Facilities"], "Borrowers");
    this.listViewSelect.addEventListener("change", () => {
      this.state.listView = this.listViewSelect.selectedOption?.value === "Facilities" ? "FACILITIES" : "BORROWERS";
      this._renderLeftList();
    });

    this.investmentTypeSelect = document.createElement("ui5-select");
    this.investmentTypeSelect.accessibleName = "Investment Type";
    this.investmentTypeSelect.addEventListener("change", () => {
      this.state.filters.investmentType = this.investmentTypeSelect.selectedOption?.value || "";
      this.onShow();
    });

    this.borrowerCombo = document.createElement("ui5-multi-combobox");
    this.borrowerCombo.accessibleName = "Borrower";

    this.riskBandCombo = document.createElement("ui5-multi-combobox");
    this.riskBandCombo.accessibleName = "Risk Band";

    this.newTypeInput = document.createElement("ui5-input");
    this.newTypeInput.placeholder = "New investment type";

    const addTypeBtn = document.createElement("ui5-button");
    addTypeBtn.textContent = "Add Type";
    addTypeBtn.design = "Transparent";
    addTypeBtn.addEventListener("click", () => this._addInvestmentType());

    const applyBtn = document.createElement("ui5-button");
    applyBtn.design = "Emphasized";
    applyBtn.textContent = "Apply";
    applyBtn.addEventListener("click", () => this._applyFilters());

    const resetBtn = document.createElement("ui5-button");
    resetBtn.design = "Transparent";
    resetBtn.textContent = "Reset";
    resetBtn.addEventListener("click", () => this._resetFilters());

    controls.append(
      this.listViewSelect,
      this.investmentTypeSelect,
      this.borrowerCombo,
      this.riskBandCombo,
      this.newTypeInput,
      addTypeBtn,
      applyBtn,
      resetBtn,
    );

    this.leftMeta = document.createElement("div");
    this.leftMeta.className = "netz-meta-text";

    this.listHost = document.createElement("div");

    body.append(controls, this.leftMeta, this.listHost);
    column.appendChild(body);
    return column;
  }

  _buildMidColumn() {
    const column = document.createElement("div");
    column.className = "netz-fcl-col netz-fcl-col--mid";

    const body = document.createElement("div");
    body.className = "netz-fcl-body";

    this.objectHeader = document.createElement("div");
    this.objectHeader.className = "netz-object-header";

    this.objectTitle = document.createElement("ui5-title");
    this.objectTitle.level = "H3";
    this.objectTitle.textContent = "Borrower";

    this.objectKpis = document.createElement("div");
    this.objectKpis.className = "netz-object-kpis";

    this.objectHeader.append(this.objectTitle, this.objectKpis);

    this.tabs = document.createElement("ui5-tabcontainer");
    this.tabs.className = "netz-object-tabs";

    this.tabOverview = this._createTab("overview", "Overview");
    this.tabFacilities = this._createTab("facilities", "Facilities");
    this.tabCovenants = this._createTab("covenants", "Covenants");
    this.tabDocuments = this._createTab("documents", "Documents");

    this.tabs.append(this.tabOverview, this.tabFacilities, this.tabCovenants, this.tabDocuments);
    body.append(this.objectHeader, this.tabs);
    column.appendChild(body);
    return column;
  }

  _buildEndColumn() {
    const column = document.createElement("div");
    column.className = "netz-fcl-col netz-fcl-col--end";

    const header = document.createElement("div");
    header.className = "netz-fcl-header";
    const title = document.createElement("div");
    title.className = "netz-title-strong";
    title.textContent = "Contextual Sub-Detail";
    header.appendChild(title);

    this.subDetailBody = document.createElement("div");
    this.subDetailBody.className = "netz-fcl-body";

    column.append(header, this.subDetailBody);
    this._renderSubDetailPlaceholder();
    return column;
  }

  _createTab(id, text) {
    const tab = document.createElement("ui5-tab");
    tab.id = id;
    tab.text = text;
    const content = document.createElement("div");
    content.className = "netz-fcl-tab-content";
    tab.appendChild(content);
    return tab;
  }

  _setError(message) {
    this.errorStrip.textContent = message;
    this.errorStrip.style.display = "block";
  }

  _clearError() {
    this.errorStrip.textContent = "";
    this.errorStrip.style.display = "none";
  }

  _refreshMeta() {
    this.leftMeta.textContent = `As of: ${safe(this.state.asOf)} • Fund: ${safe(this.fundId)}`;
  }

  _renderSubDetailPlaceholder() {
    this.subDetailBody.replaceChildren();
    const msg = document.createElement("div");
    msg.className = "netz-meta-text";
    msg.textContent = "Select a facility or covenant to inspect sub-detail.";
    this.subDetailBody.appendChild(msg);
  }

  _renderSubDetail(item, type) {
    this.selectedSubDetail = { item, type };
    this.subDetailBody.replaceChildren();

    const wrap = document.createElement("div");
    wrap.className = "netz-object-header";

    const title = document.createElement("ui5-title");
    title.level = "H4";
    title.textContent = safe(item.text);

    const meta = document.createElement("div");
    meta.className = "netz-object-kpis";
    meta.textContent = `Type: ${type} • ${safe(item.description)}`;

    wrap.append(title, meta);
    this.subDetailBody.appendChild(wrap);
  }

  _applyFilters() {
    this.state.filters = {
      investmentType: this.investmentTypeSelect.selectedOption?.value || "",
      borrower: selectedMultiValues(this.borrowerCombo),
      riskBand: selectedMultiValues(this.riskBandCombo),
    };
    this.onShow();
  }

  _resetFilters() {
    this.state.filters = { investmentType: "", borrower: [], riskBand: [] };
    this.onShow();
  }

  _addInvestmentType() {
    const newType = String(this.newTypeInput.value || "").trim();
    if (!newType) return;

    if (!this.state.investmentTypes.includes(newType)) {
      this.state.investmentTypes = [...this.state.investmentTypes, newType].sort((a, b) => a.localeCompare(b));
    }
    this.state.filters.investmentType = newType;
    this.newTypeInput.value = "";
    this._syncInvestmentTypeOptions();
  }

  _toBorrowerRows(payload) {
    return toItems(payload).map((row) => ({
      id: firstDefined(row.id, row.borrower_id, row.external_reference, row.borrower_name, row.name),
      borrowerName: firstDefined(row.borrower_name, row.borrower, row.name),
      exposure: formatCurrency(firstDefined(row.exposure, row.exposure_usd, row.notional)),
      riskBand: firstDefined(row.risk_band, row.risk_rating),
      covenantStatus: firstDefined(row.covenant_status, row.covenantStatus),
      lastReviewDate: formatDate(firstDefined(row.last_review_date, row.reviewed_at, row.last_reviewed_at)),
      internalRating: firstDefined(row.internal_rating, row.rating),
      investmentType: firstDefined(row.investment_type, row.asset_type, row.category),
    }));
  }

  _toFacilityRows(payload) {
    return toItems(payload).map((row) => ({
      id: firstDefined(row.id, row.facility_id, row.external_reference, row.facility_name, row.facility, row.name),
      facilityName: firstDefined(row.facility_name, row.facility, row.name),
      borrower: firstDefined(row.borrower_name, row.borrower, row.counterparty),
      exposure: formatCurrency(firstDefined(row.principal_outstanding, row.principal, row.principal_amount, row.notional)),
      riskBand: firstDefined(row.risk_band, row.risk_rating, row.internal_rating),
      covenantStatus: firstDefined(row.covenant_status, row.status, row.state),
      maturityDate: formatDate(firstDefined(row.maturity_date, row.maturity)),
      internalRating: firstDefined(row.internal_rating, row.rating),
      investmentType: firstDefined(row.investment_type, row.asset_type, row.category),
    }));
  }

  _applyClientFilters(rows) {
    return rows.filter((row) => {
      const borrowerMatch = !this.state.filters.borrower.length || this.state.filters.borrower.includes(String(row.borrowerName || row.borrower || ""));
      const riskMatch = !this.state.filters.riskBand.length || this.state.filters.riskBand.includes(String(row.riskBand || ""));
      const typeMatch = !this.state.filters.investmentType || String(row.investmentType || "") === this.state.filters.investmentType;
      return borrowerMatch && riskMatch && typeMatch;
    });
  }

  _syncInvestmentTypeOptions() {
    setOptions(this.investmentTypeSelect, this.state.investmentTypes, this.state.filters.investmentType);
  }

  _renderLeftList() {
    const source = this.state.listView === "FACILITIES" ? this.data.facilities : this.data.borrowers;
    const filtered = this._applyClientFilters(source);
    this.listHost.replaceChildren(buildItemList(filtered, (row) => this._selectItem(row)));
  }

  _selectItem(row) {
    this.selectedItem = row;

    this.objectTitle.textContent = safe(row.borrowerName || row.borrower, "Borrower");

    this.objectKpis.replaceChildren();
    const fragments = [
      `Internal Rating: ${safe(row.internalRating)}`,
      `Exposure: ${safe(row.exposure)}`,
      "Risk Status:",
      `Last Review Date: ${safe(row.lastReviewDate || row.maturityDate)}`,
    ];
    fragments.forEach((fragment) => {
      const span = document.createElement("span");
      span.textContent = fragment;
      this.objectKpis.appendChild(span);
    });
    this.objectKpis.appendChild(makeStatusBadge(row.covenantStatus));

    const facilitiesItems = this.data.facilities
      .filter((facility) => String(facility.borrower || "") === String(row.borrowerName || row.borrower || ""))
      .map((facility) => ({
        text: safe(facility.facilityName),
        description: `${safe(facility.exposure)} • Maturity ${safe(facility.maturityDate)}`,
        source: facility,
      }));

    const covenantItems = this.data.alerts
      .filter((alert) => String(firstDefined(alert.entity_type, "")).toLowerCase().includes("covenant") || String(firstDefined(alert.alert_type, "")).toLowerCase().includes("covenant"))
      .map((alert) => ({
        text: firstDefined(alert.alert_type, "Covenant"),
        description: firstDefined(alert.message, alert.status, alert.severity, "—"),
        source: alert,
      }));

    const documentItems = [
      { text: "Investment Memo", description: safe(row.borrowerName || row.borrower) },
      { text: "Credit Review", description: safe(row.lastReviewDate || row.maturityDate) },
    ];

    this.tabOverview.firstElementChild.replaceChildren(
      buildOverviewList([
        { text: "Alerts", description: `${this.data.alerts.length} items` },
        { text: "Exceptions", description: this.data.alerts.length ? "Open items available" : "No open items" },
        { text: "Covenant Monitoring", description: safe(row.covenantStatus) },
      ]),
    );
    this.tabFacilities.firstElementChild.replaceChildren(
      buildSelectableList(facilitiesItems, (item) => this._renderSubDetail(item, "Facility")),
    );
    this.tabCovenants.firstElementChild.replaceChildren(
      buildSelectableList(covenantItems, (item) => this._renderSubDetail(item, "Covenant")),
    );
    this.tabDocuments.firstElementChild.replaceChildren(buildOverviewList(documentItems));

    this._renderSubDetailPlaceholder();
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
        limit: 100,
        offset: 0,
        investment_type: this.state.filters.investmentType,
      };

      const facilityParams = {
        limit: 100,
        offset: 0,
        investment_type: this.state.filters.investmentType,
      };

      const [borrowers, facilitiesPayload, alerts] = await Promise.all([
        portfolioApi.listBorrowers(this.fundId, borrowerParams),
        listFacilities(this.fundId, facilityParams),
        portfolioApi.listAlerts(this.fundId, { limit: 50, offset: 0 }),
      ]);

      this.state.asOf = getAsOf(borrowers, facilitiesPayload, alerts);
      this._refreshMeta();

      const borrowerRows = this._toBorrowerRows(borrowers);
      const facilityRows = this._toFacilityRows(facilitiesPayload).map((row) => ({
        borrowerName: row.borrower,
        exposure: row.exposure,
        riskBand: row.riskBand,
        covenantStatus: row.covenantStatus,
        ...row,
      }));

      this.data.borrowers = borrowerRows;
      this.data.facilities = facilityRows;
      this.data.alerts = toItems(alerts);

      const typeSet = new Set(this.state.investmentTypes);
      // TODO: Investment categories must be DB-driven (multi-asset)
      [
        "Facilities",
        "Equity Participations",
        "Investment Funds",
      ].forEach((value) => typeSet.add(value));

      borrowerRows.forEach((row) => {
        if (row.investmentType) typeSet.add(String(row.investmentType));
      });
      facilityRows.forEach((row) => {
        if (row.investmentType) typeSet.add(String(row.investmentType));
      });
      this.state.investmentTypes = Array.from(typeSet).sort((a, b) => a.localeCompare(b));
      this._syncInvestmentTypeOptions();

      setOptions(
        this.listViewSelect,
        ["Borrowers", "Facilities"],
        this.state.listView === "FACILITIES" ? "Facilities" : "Borrowers",
      );

      setMultiComboItems(
        this.borrowerCombo,
        [...new Set(borrowerRows.map((row) => row.borrowerName).filter(Boolean))],
        new Set(this.state.filters.borrower),
      );

      setMultiComboItems(
        this.riskBandCombo,
        [...new Set(borrowerRows.map((row) => row.riskBand).filter(Boolean))],
        new Set(this.state.filters.riskBand),
      );

      this._renderLeftList();
      if (!this.selectedItem && borrowerRows.length) {
        this._selectItem(borrowerRows[0]);
      } else if (this.selectedItem) {
        const candidate = [...borrowerRows, ...facilityRows].find((row) => String(row.id) === String(this.selectedItem.id));
        this._selectItem(candidate || borrowerRows[0] || facilityRows[0] || { borrowerName: "Portfolio", exposure: "—", riskBand: "—", covenantStatus: "—" });
      }
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to load portfolio data");
    } finally {
      this.busy.active = false;
    }
  }
}
