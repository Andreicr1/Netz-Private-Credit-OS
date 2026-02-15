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
  const list = document.createElement("ui5-list");
  list.mode = "SingleSelect";
  list.separators = "Inner";
  list.noDataText = "No records available.";

  rows.forEach((row) => {
    const li = document.createElement("ui5-li");
    li.textContent = safe(row.borrowerName);
    li.description = safe(row.riskBand);
    li.additionalText = safe(row.exposure);
    li.type = "Navigation";
    li.addEventListener("click", () => onSelect(row));
    list.appendChild(li);
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
  const list = document.createElement("ui5-list");
  list.mode = "SingleSelect";
  list.separators = "Inner";
  list.noDataText = "No records available.";

  items.forEach((item) => {
    const li = document.createElement("ui5-li");
    li.textContent = safe(item.text);
    li.description = safe(item.description);
    li.type = "Navigation";
    li.addEventListener("click", () => onSelect(item));
    list.appendChild(li);
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

    /* ── Header (SAP S/4HANA pattern) ── */
    const header = document.createElement("div");
    header.className = "netz-fcl-header";

    this.beginTitle = document.createElement("div");
    this.beginTitle.className = "netz-fcl-header-title";
    this.beginTitle.textContent = "Borrowers";

    const searchRow = document.createElement("div");
    searchRow.className = "netz-fcl-search-row";

    this.searchInput = document.createElement("ui5-input");
    this.searchInput.type = "Search";
    this.searchInput.placeholder = "Search";
    this.searchInput.addEventListener("input", () => this._renderLeftList());

    const filterBtn = document.createElement("ui5-button");
    filterBtn.icon = "action-settings";
    filterBtn.design = "Transparent";
    filterBtn.tooltip = "Filters";
    filterBtn.addEventListener("click", () => {
      this.filterBar.style.display = this.filterBar.style.display === "none" ? "" : "none";
    });

    searchRow.append(this.searchInput, filterBtn);
    header.append(this.beginTitle, searchRow);
    column.appendChild(header);

    /* ── Filter bar (collapsible) ── */
    this.filterBar = document.createElement("div");
    this.filterBar.className = "netz-fcl-filter-bar";
    this.filterBar.style.display = "none";

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

    this.filterBar.append(
      this.listViewSelect,
      this.investmentTypeSelect,
      this.borrowerCombo,
      this.riskBandCombo,
      this.newTypeInput,
      addTypeBtn,
      applyBtn,
      resetBtn,
    );
    column.appendChild(this.filterBar);

    /* ── Body (list) ── */
    const body = document.createElement("div");
    body.className = "netz-fcl-body";

    this.leftMeta = document.createElement("div");
    this.leftMeta.className = "netz-meta-text";
    this.leftMeta.style.padding = "0.5rem";

    this.listHost = document.createElement("div");

    body.append(this.leftMeta, this.listHost);
    column.appendChild(body);
    return column;
  }

  _buildMidColumn() {
    const column = document.createElement("div");
    column.className = "netz-fcl-col netz-fcl-col--mid";

    /* ── Object Header (SAP S/4HANA: Avatar + Title + Facets) ── */
    this.objectHeader = document.createElement("div");
    this.objectHeader.className = "netz-object-header";

    const headerRow = document.createElement("div");
    headerRow.className = "netz-object-header-row";

    this.objectAvatar = document.createElement("ui5-avatar");
    this.objectAvatar.size = "M";
    this.objectAvatar.shape = "Circle";
    this.objectAvatar.initials = "B";
    this.objectAvatar.colorScheme = "Accent6";

    const headerInfo = document.createElement("div");
    headerInfo.className = "netz-object-header-info";

    this.objectTitle = document.createElement("ui5-title");
    this.objectTitle.level = "H3";
    this.objectTitle.textContent = "Borrower";

    this.objectKpis = document.createElement("div");
    this.objectKpis.className = "netz-object-kpis";

    headerInfo.append(this.objectTitle, this.objectKpis);
    headerRow.append(this.objectAvatar, headerInfo);
    this.objectHeader.appendChild(headerRow);
    column.appendChild(this.objectHeader);

    /* ── Icon Tab Bar ── */
    this.tabs = document.createElement("ui5-tabcontainer");
    this.tabs.className = "netz-object-tabs";
    this.tabs.style.flex = "1";
    this.tabs.style.overflow = "auto";

    this.tabOverview = this._createTab("overview", "Overview");
    this.tabFacilities = this._createTab("facilities", "Facilities");
    this.tabCovenants = this._createTab("covenants", "Covenants");
    this.tabDocuments = this._createTab("documents", "Documents");

    this.tabs.append(this.tabOverview, this.tabFacilities, this.tabCovenants, this.tabDocuments);
    column.appendChild(this.tabs);
    return column;
  }

  _buildEndColumn() {
    const column = document.createElement("div");
    column.className = "netz-fcl-col netz-fcl-col--end";

    /* ── End header: title + fullscreen/close (SAP S/4HANA pattern) ── */
    const header = document.createElement("div");
    header.className = "netz-fcl-end-header";

    this.endTitle = document.createElement("div");
    this.endTitle.className = "netz-fcl-end-header-title";
    this.endTitle.textContent = "Detail";

    const actions = document.createElement("div");
    actions.className = "netz-fcl-end-header-actions";

    const fullscreenBtn = document.createElement("ui5-button");
    fullscreenBtn.icon = "full-screen";
    fullscreenBtn.design = "Transparent";
    fullscreenBtn.tooltip = "Full Screen";

    const closeBtn = document.createElement("ui5-button");
    closeBtn.icon = "decline";
    closeBtn.design = "Transparent";
    closeBtn.tooltip = "Close";
    closeBtn.addEventListener("click", () => {
      this.selectedSubDetail = null;
      this._renderSubDetailPlaceholder();
    });

    actions.append(fullscreenBtn, closeBtn);
    header.append(this.endTitle, actions);
    column.appendChild(header);

    /* ── Scrollable content ── */
    this.subDetailBody = document.createElement("div");
    this.subDetailBody.className = "netz-fcl-end-content";

    column.appendChild(this.subDetailBody);
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
    this.endTitle.textContent = "Detail";
    const card = document.createElement("div");
    card.className = "netz-fcl-form-card";
    const msg = document.createElement("div");
    msg.className = "netz-meta-text";
    msg.textContent = "Select a facility or covenant to inspect sub-detail.";
    card.appendChild(msg);
    this.subDetailBody.appendChild(card);
  }

  _renderSubDetail(item, type) {
    this.selectedSubDetail = { item, type };
    this.subDetailBody.replaceChildren();
    this.endTitle.textContent = safe(item.text);

    const card = document.createElement("div");
    card.className = "netz-fcl-form-card";

    const groupTitle = document.createElement("div");
    groupTitle.className = "netz-fcl-form-group-title";
    groupTitle.textContent = safe(type);
    card.appendChild(groupTitle);

    const pairs = [
      ["Name:", safe(item.text)],
      ["Details:", safe(item.description)],
    ];
    if (item.source) {
      pairs.push(["Status:", safe(item.source.covenantStatus || item.source.status)]);
    }

    pairs.forEach(([label, value]) => {
      const formItem = document.createElement("div");
      formItem.className = "netz-fcl-form-item";
      const lbl = document.createElement("ui5-label");
      lbl.textContent = label;
      const val = document.createElement("span");
      val.className = "netz-fcl-value";
      val.textContent = value;
      formItem.append(lbl, val);
      card.appendChild(formItem);
    });

    this.subDetailBody.appendChild(card);
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
    const searchTerm = (this.searchInput?.value || "").toLowerCase();
    const searched = searchTerm
      ? filtered.filter((row) => {
          const name = String(row.borrowerName || row.facilityName || "").toLowerCase();
          return name.includes(searchTerm);
        })
      : filtered;
    const label = this.state.listView === "FACILITIES" ? "Facilities" : "Borrowers";
    this.beginTitle.textContent = `${label} (${searched.length})`;
    this.listHost.replaceChildren(buildItemList(searched, (row) => this._selectItem(row)));
  }

  _selectItem(row) {
    this.selectedItem = row;

    const displayName = safe(row.borrowerName || row.borrower, "Borrower");
    this.objectTitle.textContent = displayName;
    this.objectAvatar.initials = displayName.substring(0, 2).toUpperCase();
    this.endTitle.textContent = displayName;

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
