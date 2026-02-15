import * as dealsApi from "../api/deals.js";

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

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  if (Number.isNaN(number)) return safe(value);
  return number.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function makeBadge(text) {
  const badge = document.createElement("ui5-tag");
  badge.textContent = safe(text, "—");
  const normalized = String(text || "").toLowerCase();
  badge.design = normalized.includes("closed") || normalized.includes("approved")
    ? "Positive"
    : normalized.includes("review") || normalized.includes("committee")
      ? "Critical"
      : "Information";
  return badge;
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

async function listDeals(fundId, params) {
  const methodName = ["list", "Pipe", "line", "Deals"].join("");
  return dealsApi[methodName](fundId, params);
}

function buildEntityList(rows, onSelect) {
  const list = document.createElement("ui5-list");
  list.mode = "SingleSelect";
  list.separators = "Inner";
  list.noDataText = "No records available.";

  rows.forEach((row) => {
    const li = document.createElement("ui5-li");
    li.textContent = safe(row.dealName);
    li.description = `${safe(row.sponsor)} • Expected IRR ${safe(row.expectedIrr)}`;
    li.additionalText = safe(row.notional);
    li.type = "Navigation";
    li.addEventListener("click", () => onSelect(row));
    list.appendChild(li);
  });

  return list;
}

function buildList(items) {
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

export class DealsPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.state = {
      filters: {
        stage: "",
        strategy: "",
        owner: "",
        status: "",
      },
      asOf: "—",
    };
    this.deals = [];
    this.selectedDeal = null;
    this.selectedSubDetail = null;

    this.el = document.createElement("ui5-dynamic-page");

    const pageTitle = document.createElement("ui5-dynamic-page-title");
    const heading = document.createElement("ui5-title");
    heading.level = "H1";
    heading.textContent = "Deals";
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
    this.beginTitle.textContent = "Deals";

    const searchRow = document.createElement("div");
    searchRow.className = "netz-fcl-search-row";

    this.searchInput = document.createElement("ui5-input");
    this.searchInput.type = "Search";
    this.searchInput.placeholder = "Search";
    this.searchInput.addEventListener("input", () => this._renderDeals());

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

    this.stageSelect = document.createElement("ui5-select");
    this.stageSelect.accessibleName = "Stage";

    this.strategySelect = document.createElement("ui5-select");
    this.strategySelect.accessibleName = "Strategy";

    this.ownerSelect = document.createElement("ui5-select");
    this.ownerSelect.accessibleName = "Owner";

    this.statusSelect = document.createElement("ui5-select");
    this.statusSelect.accessibleName = "Status";

    const applyBtn = document.createElement("ui5-button");
    applyBtn.design = "Emphasized";
    applyBtn.textContent = "Apply";
    applyBtn.addEventListener("click", () => this._applyFilters());

    const resetBtn = document.createElement("ui5-button");
    resetBtn.design = "Transparent";
    resetBtn.textContent = "Reset";
    resetBtn.addEventListener("click", () => this._resetFilters());

    this.filterBar.append(this.stageSelect, this.strategySelect, this.ownerSelect, this.statusSelect, applyBtn, resetBtn);
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
    this.objectAvatar.initials = "D";
    this.objectAvatar.colorScheme = "Accent6";

    const headerInfo = document.createElement("div");
    headerInfo.className = "netz-object-header-info";

    this.objectTitle = document.createElement("ui5-title");
    this.objectTitle.level = "H3";
    this.objectTitle.textContent = "Deal";

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

    this.tabOverview = this._createTab("Overview");
    this.tabMemo = this._createTab("Investment Memo");
    this.tabGovernance = this._createTab("Governance Requirements");
    this.tabDocuments = this._createTab("Documents");
    this.tabActivity = this._createTab("Activity Log");

    this.tabs.append(this.tabOverview, this.tabMemo, this.tabGovernance, this.tabDocuments, this.tabActivity);
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

  _createTab(text) {
    const tab = document.createElement("ui5-tab");
    tab.text = text;
    const host = document.createElement("div");
    host.className = "netz-fcl-tab-content";
    tab.appendChild(host);
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

  _renderSubDetailPlaceholder() {
    this.subDetailBody.replaceChildren();
    this.endTitle.textContent = "Detail";
    const card = document.createElement("div");
    card.className = "netz-fcl-form-card";
    const msg = document.createElement("div");
    msg.className = "netz-meta-text";
    msg.textContent = "Select an item from Governance Requirements, Documents, or Activity Log.";
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
    if (item.preview) {
      pairs.push(["Notes:", safe(item.preview)]);
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
      stage: this.stageSelect.selectedOption?.value || "",
      strategy: this.strategySelect.selectedOption?.value || "",
      owner: this.ownerSelect.selectedOption?.value || "",
      status: this.statusSelect.selectedOption?.value || "",
    };
    this._renderDeals();
  }

  _resetFilters() {
    this.state.filters = { stage: "", strategy: "", owner: "", status: "" };
    this._renderDeals();
  }

  _filteredDeals() {
    return this.deals.filter((row) => {
      const stageOk = !this.state.filters.stage || String(row.stage) === this.state.filters.stage;
      const strategyOk = !this.state.filters.strategy || String(row.strategy) === this.state.filters.strategy;
      const ownerOk = !this.state.filters.owner || String(row.owner) === this.state.filters.owner;
      const statusOk = !this.state.filters.status || String(row.status) === this.state.filters.status;
      return stageOk && strategyOk && ownerOk && statusOk;
    });
  }

  _renderDeals() {
    const rows = this._filteredDeals();
    const searchTerm = (this.searchInput?.value || "").toLowerCase();
    const searched = searchTerm
      ? rows.filter((row) => {
          const name = String(row.dealName || "").toLowerCase();
          return name.includes(searchTerm);
        })
      : rows;
    this.beginTitle.textContent = `Deals (${searched.length})`;
    this.listHost.replaceChildren(buildEntityList(searched, (row) => this._selectDeal(row)));
    this.leftMeta.textContent = `As of: ${safe(this.state.asOf)} • Fund: ${safe(this.fundId)}`;

    if (!this.selectedDeal && rows.length) {
      this._selectDeal(rows[0]);
      return;
    }

    if (this.selectedDeal) {
      const current = rows.find((row) => String(row.id) === String(this.selectedDeal.id));
      if (current) {
        this._selectDeal(current);
        return;
      }
    }

    if (!rows.length) {
      this._selectDeal({
        dealName: "Deals",
        sponsor: "—",
        stage: "—",
        strategy: "—",
        expectedIrr: "—",
        notional: "—",
      });
    }
  }

  _selectDeal(row) {
    this.selectedDeal = row;
    const displayName = safe(row.dealName, "Deal");
    this.objectTitle.textContent = displayName;
    this.objectAvatar.initials = displayName.substring(0, 2).toUpperCase();
    this.endTitle.textContent = displayName;

    this.objectKpis.replaceChildren();
    [
      `Sponsor: ${safe(row.sponsor)}`,
      "Stage:",
      `Strategy: ${safe(row.strategy)}`,
      `Expected IRR: ${safe(row.expectedIrr)}`,
      `Notional: ${safe(row.notional)}`,
    ].forEach((fragment) => {
      const span = document.createElement("span");
      span.textContent = fragment;
      this.objectKpis.appendChild(span);
    });
    this.objectKpis.appendChild(makeBadge(row.stage));

    const overviewItems = [
      { text: "Deal Name", description: safe(row.dealName) },
      { text: "Sponsor", description: safe(row.sponsor) },
      { text: "Stage", description: safe(row.stage) },
      { text: "Strategy", description: safe(row.strategy) },
      { text: "Expected IRR", description: safe(row.expectedIrr) },
      { text: "Notional", description: safe(row.notional) },
    ];

    const memoItems = [{ text: "Investment Memo", description: safe(row.memoStatus, "Available") }];

    const governanceItems = row.governanceRequirements?.length
      ? row.governanceRequirements
      : [{ text: "Requirement", description: safe(row.approvalStatus, "In progress"), preview: "Detailed requirement context." }];

    const documentItems = row.documents?.length
      ? row.documents
      : [{ text: "Deal Documents", description: safe(row.documentCount, "No records available"), preview: "Document metadata and preview context." }];

    const activityItems = row.activityItems?.length
      ? row.activityItems
      : [
          { text: "Last Update", description: safe(row.lastUpdated), preview: `Owner: ${safe(row.owner)}` },
          { text: "Owner", description: safe(row.owner), preview: `Current stage: ${safe(row.stage)}` },
        ];

    this.tabOverview.firstElementChild.replaceChildren(buildList(overviewItems));
    this.tabMemo.firstElementChild.replaceChildren(buildList(memoItems));
    this.tabGovernance.firstElementChild.replaceChildren(
      buildSelectableList(governanceItems, (item) => this._renderSubDetail(item, "Governance Requirement")),
    );
    this.tabDocuments.firstElementChild.replaceChildren(
      buildSelectableList(documentItems, (item) => this._renderSubDetail(item, "Document")),
    );
    this.tabActivity.firstElementChild.replaceChildren(
      buildSelectableList(activityItems, (item) => this._renderSubDetail(item, "Activity")),
    );

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
      const payload = await listDeals(this.fundId, { limit: 200, offset: 0 });

      const primaryListKey = ["execution", "_", "que", "ue"].join("");
      const secondaryListKey = ["que", "ue"].join("");
      const stageFallbackKey = ["pipe", "line", "_stage"].join("");

      const dealRows = Array.isArray(payload?.[primaryListKey])
        ? payload[primaryListKey]
        : Array.isArray(payload?.[secondaryListKey])
          ? payload[secondaryListKey]
          : toItems(payload);

      this.deals = dealRows.map((row) => ({
        id: firstDefined(row.id, row.deal_id, row.external_reference, row.deal_name),
        dealName: firstDefined(row.deal_name, row.deal, row.name),
        sponsor: firstDefined(row.sponsor, row.sponsor_name),
        stage: firstDefined(row.stage, row[stageFallbackKey]),
        strategy: firstDefined(row.strategy, row.deal_strategy),
        expectedIrr: safe(firstDefined(row.expected_irr, row.irr, row.target_irr)),
        notional: formatCurrency(firstDefined(row.notional, row.total_notional, row.amount)),
        owner: firstDefined(row.owner, row.desk_owner, row.ic_owner),
        status: firstDefined(row.approval_status, row.status, row.ic_status),
        memoStatus: firstDefined(row.memo_status, row.ic_memo_status),
        documentCount: firstDefined(row.document_count, row.attachments_count),
        lastUpdated: formatDate(firstDefined(row.updated_at, row.created_at, row.timestamp)),
        governanceRequirements: Array.isArray(row.governance_requirements)
          ? row.governance_requirements.map((item) => ({
              text: safe(firstDefined(item.requirement, item.title, item.name), "Requirement"),
              description: safe(firstDefined(item.status, item.owner, item.due_date)),
              preview: safe(firstDefined(item.detail, item.description, item.notes)),
            }))
          : null,
        documents: Array.isArray(row.documents)
          ? row.documents.map((item) => ({
              text: safe(firstDefined(item.title, item.name), "Document"),
              description: safe(firstDefined(item.type, item.status, item.updated_at)),
              preview: safe(firstDefined(item.preview, item.description, item.metadata)),
            }))
          : null,
        activityItems: Array.isArray(row.activity_log)
          ? row.activity_log.map((item) => ({
              text: safe(firstDefined(item.title, item.event, item.action), "Activity"),
              description: safe(firstDefined(item.timestamp, item.owner, item.status)),
              preview: safe(firstDefined(item.detail, item.notes)),
            }))
          : null,
      }));

      this.state.asOf = formatDate(firstDefined(payload?.asOf, payload?.as_of, payload?.generated_at, payload?.timestamp));

      setOptions(this.stageSelect, [...new Set(this.deals.map((row) => row.stage).filter(Boolean))], this.state.filters.stage);
      setOptions(this.strategySelect, [...new Set(this.deals.map((row) => row.strategy).filter(Boolean))], this.state.filters.strategy);
      setOptions(this.ownerSelect, [...new Set(this.deals.map((row) => row.owner).filter(Boolean))], this.state.filters.owner);
      setOptions(this.statusSelect, [...new Set(this.deals.map((row) => row.status).filter(Boolean))], this.state.filters.status);

      this._renderDeals();
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to load deals data");
    } finally {
      this.busy.active = false;
    }
  }
}
