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

function buildEntityList(rows, onSelect) {
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
    title.textContent = safe(row.dealName);

    const meta = document.createElement("div");
    meta.className = "netz-fcl-list-meta";
    meta.textContent = `${safe(row.sponsor)} • ${safe(row.notional)} • IRR ${safe(row.expectedIrr)}`;

    const badgeWrap = document.createElement("div");
    badgeWrap.className = "netz-fcl-list-badge";
    badgeWrap.appendChild(makeBadge(row.stage));

    wrap.append(title, meta, badgeWrap);
    item.appendChild(wrap);
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

export class DealsPipelinePage {
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
    header.titleText = "Deal Navigation";
    header.subtitleText = "Stage, Strategy, Owner, Status";
    header.setAttribute("slot", "header");
    column.appendChild(header);

    const body = document.createElement("div");
    body.className = "netz-fcl-column-body";

    const controls = document.createElement("div");
    controls.className = "netz-fcl-controls";

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
    resetBtn.design = "Default";
    resetBtn.textContent = "Reset";
    resetBtn.addEventListener("click", () => this._resetFilters());

    controls.append(this.stageSelect, this.strategySelect, this.ownerSelect, this.statusSelect, applyBtn, resetBtn);

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
    header.titleText = "Deal Detail";
    header.setAttribute("slot", "header");
    this.detailHeader = header;
    column.appendChild(header);

    const body = document.createElement("div");
    body.className = "netz-fcl-column-body";

    this.detailMeta = document.createElement("div");
    this.detailMeta.className = "netz-fcl-detail-meta";

    this.tabs = document.createElement("ui5-tabcontainer");

    this.tabOverview = this._createTab("Overview");
    this.tabMemo = this._createTab("Investment Memo");
    this.tabGovernance = this._createTab("Governance Requirements");
    this.tabDocuments = this._createTab("Documents");
    this.tabActivity = this._createTab("Activity Log");

    this.tabs.append(this.tabOverview, this.tabMemo, this.tabGovernance, this.tabDocuments, this.tabActivity);

    body.append(this.detailMeta, this.tabs);
    column.appendChild(body);
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
    this.detailHeader.titleText = safe(row.dealName, "Deal Detail");

    this.detailMeta.replaceChildren();
    const summary = document.createElement("span");
    summary.textContent = [
      `Sponsor: ${safe(row.sponsor)}`,
      `Strategy: ${safe(row.strategy)}`,
      `Expected IRR: ${safe(row.expectedIrr)}`,
      `Notional: ${safe(row.notional)}`,
    ].join(" • ");

    this.detailMeta.append(summary, makeBadge(row.stage));

    const overviewItems = [
      { text: "Deal Name", description: safe(row.dealName) },
      { text: "Sponsor", description: safe(row.sponsor) },
      { text: "Stage", description: safe(row.stage) },
      { text: "Strategy", description: safe(row.strategy) },
      { text: "Expected IRR", description: safe(row.expectedIrr) },
      { text: "Notional", description: safe(row.notional) },
    ];

    this.tabOverview.firstElementChild.replaceChildren(buildList(overviewItems));
    this.tabMemo.firstElementChild.replaceChildren(buildList([{ text: "Investment Memo", description: safe(row.memoStatus, "Available") }]));
    this.tabGovernance.firstElementChild.replaceChildren(buildList([{ text: "Governance Requirements", description: safe(row.approvalStatus, "In progress") }]));
    this.tabDocuments.firstElementChild.replaceChildren(buildList([{ text: "Documents", description: safe(row.documentCount, "No records available") }]));
    this.tabActivity.firstElementChild.replaceChildren(
      buildList([
        { text: "Last Update", description: safe(row.lastUpdated) },
        { text: "Owner", description: safe(row.owner) },
      ]),
    );
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
      const payload = await dealsApi.listPipelineDeals(this.fundId, { limit: 200, offset: 0 });

      const queueRows = Array.isArray(payload?.execution_queue)
        ? payload.execution_queue
        : Array.isArray(payload?.queue)
          ? payload.queue
          : toItems(payload);

      this.deals = queueRows.map((row) => ({
        id: firstDefined(row.id, row.deal_id, row.external_reference, row.deal_name),
        dealName: firstDefined(row.deal_name, row.deal, row.name),
        sponsor: firstDefined(row.sponsor, row.sponsor_name),
        stage: firstDefined(row.stage, row.pipeline_stage),
        strategy: firstDefined(row.strategy, row.deal_strategy),
        expectedIrr: safe(firstDefined(row.expected_irr, row.irr, row.target_irr)),
        notional: formatCurrency(firstDefined(row.notional, row.total_notional, row.amount)),
        owner: firstDefined(row.owner, row.desk_owner, row.ic_owner),
        status: firstDefined(row.approval_status, row.status, row.ic_status),
        memoStatus: firstDefined(row.memo_status, row.ic_memo_status),
        documentCount: firstDefined(row.document_count, row.attachments_count),
        lastUpdated: formatDate(firstDefined(row.updated_at, row.created_at, row.timestamp)),
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
