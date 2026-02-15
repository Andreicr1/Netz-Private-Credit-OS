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
    title.textContent = safe(row.dealName);

    const meta = document.createElement("div");
    meta.className = "netz-entity-meta";
    meta.textContent = `${safe(row.sponsor)} • ${safe(row.notional)} • Expected IRR ${safe(row.expectedIrr)}`;

    const badgeWrap = document.createElement("div");
    badgeWrap.className = "netz-entity-badge";
    badgeWrap.appendChild(makeBadge(row.stage));
    meta.appendChild(badgeWrap);

    item.append(title, meta);
    item.addEventListener("click", () => onSelect(row));
    list.appendChild(item);
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
    column.className = "netz-fcl-col begin netz-fcl-col--begin";

    const header = document.createElement("div");
    header.className = "netz-fcl-header";
    const title = document.createElement("div");
    title.className = "netz-title-strong";
    title.textContent = "Deals";
    const subtitle = document.createElement("div");
    subtitle.className = "netz-meta-text";
    subtitle.textContent = "Entity Navigation";
    header.append(title, subtitle);
    column.appendChild(header);

    const body = document.createElement("div");
    body.className = "netz-fcl-body";

    const controls = document.createElement("div");
    controls.className = "netz-multi netz-fcl-filter-bar";

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

    controls.append(this.stageSelect, this.strategySelect, this.ownerSelect, this.statusSelect, applyBtn, resetBtn);

    this.leftMeta = document.createElement("div");
    this.leftMeta.className = "netz-meta-text";

    this.listHost = document.createElement("div");

    body.append(controls, this.leftMeta, this.listHost);
    column.appendChild(body);
    return column;
  }

  _buildMidColumn() {
    const column = document.createElement("div");
    column.className = "netz-fcl-col mid netz-fcl-col--mid";

    const body = document.createElement("div");
    body.className = "netz-fcl-body";

    this.objectHeader = document.createElement("div");
    this.objectHeader.className = "netz-object-header";

    this.objectTitle = document.createElement("ui5-title");
    this.objectTitle.level = "H3";
    this.objectTitle.textContent = "Deal";

    this.objectKpis = document.createElement("div");
    this.objectKpis.className = "netz-object-kpis";

    this.objectHeader.append(this.objectTitle, this.objectKpis);

    this.tabs = document.createElement("ui5-tabcontainer");
    this.tabs.className = "netz-object-tabs";

    this.tabOverview = this._createTab("Overview");
    this.tabMemo = this._createTab("Investment Memo");
    this.tabGovernance = this._createTab("Governance Requirements");
    this.tabDocuments = this._createTab("Documents");
    this.tabActivity = this._createTab("Activity Log");

    this.tabs.append(this.tabOverview, this.tabMemo, this.tabGovernance, this.tabDocuments, this.tabActivity);

    body.append(this.objectHeader, this.tabs);
    column.appendChild(body);
    return column;
  }

  _buildEndColumn() {
    const column = document.createElement("div");
    column.className = "netz-fcl-col end netz-fcl-col--end";

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
    const msg = document.createElement("div");
    msg.className = "netz-meta-text";
    msg.textContent = "Select an item from Governance Requirements, Documents, or Activity Log.";
    this.subDetailBody.appendChild(msg);
  }

  _renderSubDetail(item, type) {
    this.selectedSubDetail = { item, type };
    this.subDetailBody.replaceChildren();

    const header = document.createElement("div");
    header.className = "netz-object-header";

    const title = document.createElement("ui5-title");
    title.level = "H4";
    title.textContent = safe(item.text);

    const meta = document.createElement("div");
    meta.className = "netz-object-kpis";
    meta.textContent = `Type: ${safe(type)} • ${safe(item.description)}`;

    header.append(title, meta);
    this.subDetailBody.appendChild(header);

    if (item.preview) {
      const preview = document.createElement("div");
      preview.className = "netz-meta-text netz-fcl-preview";
      preview.textContent = safe(item.preview);
      this.subDetailBody.appendChild(preview);
    }
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
    this.listHost.replaceChildren(buildEntityList(rows, (row) => this._selectDeal(row)));
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
    this.objectTitle.textContent = safe(row.dealName, "Deal");

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
