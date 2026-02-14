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
  if (!rows.length) {
    const empty = document.createElement("ui5-li");
    empty.textContent = "No records available.";
    list.appendChild(empty);
    return list;
  }

  rows.forEach((row) => {
    const item = document.createElement("ui5-li-custom");
    const wrap = document.createElement("div");
    wrap.className = "netz-fcl-list-item";

    const title = document.createElement("div");
    title.className = "netz-fcl-list-title";
    title.textContent = safe(row.borrowerName);

    const meta = document.createElement("div");
    meta.className = "netz-fcl-list-meta";
    meta.textContent = `${safe(row.exposure)} • Risk ${safe(row.riskBand)}`;

    const badgeWrap = document.createElement("div");
    badgeWrap.className = "netz-fcl-list-badge";
    badgeWrap.appendChild(makeStatusBadge(row.covenantStatus));

    wrap.append(title, meta, badgeWrap);
    item.appendChild(wrap);
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
    layout.className = "netz-fcl-layout";

    this.leftColumn = this._buildLeftColumn();
    this.rightColumn = this._buildRightColumn();
    layout.append(this.leftColumn, this.rightColumn);

    content.appendChild(layout);
    this.busy.appendChild(content);
    this.el.appendChild(this.busy);
  }

  _buildLeftColumn() {
    const column = document.createElement("ui5-card");
    column.className = "netz-fcl-column";

    const header = document.createElement("ui5-card-header");
    header.titleText = "Portfolio Navigation";
    header.subtitleText = "Borrowers and Facilities";
    header.setAttribute("slot", "header");
    column.appendChild(header);

    const body = document.createElement("div");
    body.className = "netz-fcl-column-body";

    const controls = document.createElement("div");
    controls.className = "netz-fcl-controls";

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
    resetBtn.design = "Default";
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
    this.leftMeta.className = "netz-fcl-meta";

    this.listHost = document.createElement("div");

    body.append(controls, this.leftMeta, this.listHost);
    column.appendChild(body);
    return column;
  }

  _buildRightColumn() {
    const column = document.createElement("ui5-card");
    column.className = "netz-fcl-column";

    const header = document.createElement("ui5-card-header");
    header.titleText = "Borrower Detail";
    header.setAttribute("slot", "header");
    this.detailHeader = header;
    column.appendChild(header);

    const body = document.createElement("div");
    body.className = "netz-fcl-column-body";

    this.detailMeta = document.createElement("div");
    this.detailMeta.className = "netz-fcl-detail-meta";

    this.tabs = document.createElement("ui5-tabcontainer");
    this.tabs.className = "netz-fcl-tabs";

    this.tabOverview = this._createTab("overview", "Overview");
    this.tabFacilities = this._createTab("facilities", "Facilities");
    this.tabCovenants = this._createTab("covenants", "Covenants");
    this.tabDocuments = this._createTab("documents", "Documents");

    this.tabs.append(this.tabOverview, this.tabFacilities, this.tabCovenants, this.tabDocuments);
    body.append(this.detailMeta, this.tabs);
    column.appendChild(body);
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
      id: firstDefined(row.id, row.loan_id, row.external_reference, row.facility_name, row.loan_name),
      facilityName: firstDefined(row.facility_name, row.facility, row.loan_name),
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

    this.detailHeader.titleText = safe(row.borrowerName || row.borrower, "Borrower Detail");

    this.detailMeta.replaceChildren();
    const fragments = [
      `Internal Rating: ${safe(row.internalRating)}`,
      `Exposure: ${safe(row.exposure)}`,
      `Risk Status: ${safe(row.riskBand)}`,
      `Last Review Date: ${safe(row.lastReviewDate || row.maturityDate)}`,
    ];
    const badge = makeStatusBadge(row.covenantStatus);
    const text = document.createElement("span");
    text.textContent = fragments.join(" • ");
    this.detailMeta.append(text, badge);

    const facilitiesItems = this.data.facilities
      .filter((facility) => String(facility.borrower || "") === String(row.borrowerName || row.borrower || ""))
      .map((facility) => ({
        text: safe(facility.facilityName),
        description: `${safe(facility.exposure)} • Maturity ${safe(facility.maturityDate)}`,
      }));

    const covenantItems = this.data.alerts
      .filter((alert) => String(firstDefined(alert.entity_type, "")).toLowerCase().includes("covenant") || String(firstDefined(alert.alert_type, "")).toLowerCase().includes("covenant"))
      .map((alert) => ({
        text: firstDefined(alert.alert_type, "Covenant Monitoring"),
        description: firstDefined(alert.message, alert.status, alert.severity, "—"),
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
    this.tabFacilities.firstElementChild.replaceChildren(buildOverviewList(facilitiesItems));
    this.tabCovenants.firstElementChild.replaceChildren(buildOverviewList(covenantItems));
    this.tabDocuments.firstElementChild.replaceChildren(buildOverviewList(documentItems));
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

      const loanParams = {
        limit: 100,
        offset: 0,
        investment_type: this.state.filters.investmentType,
      };

      const [borrowers, loans, alerts] = await Promise.all([
        portfolioApi.listBorrowers(this.fundId, borrowerParams),
        portfolioApi.listLoans(this.fundId, loanParams),
        portfolioApi.listAlerts(this.fundId, { limit: 50, offset: 0 }),
      ]);

      this.state.asOf = getAsOf(borrowers, loans, alerts);
      this._refreshMeta();

      const borrowerRows = this._toBorrowerRows(borrowers);
      const facilityRows = this._toFacilityRows(loans).map((row) => ({
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
      [
        "Direct Loans",
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
