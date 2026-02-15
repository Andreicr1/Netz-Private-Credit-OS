import * as signaturesApi from "../api/signatures.js";

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

function statusBadge(value) {
  const badge = document.createElement("ui5-tag");
  const text = safe(value, "—");
  const normalized = text.toLowerCase();
  badge.textContent = text;
  badge.design = normalized.includes("signed")
    ? "Positive"
    : normalized.includes("expired") || normalized.includes("rejected")
      ? "Negative"
      : normalized.includes("pending")
        ? "Critical"
        : "Information";
  return badge;
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

function buildWorkflowList(rows, onSelect) {
  const list = document.createElement("ui5-list");
  list.mode = "SingleSelect";
  list.separators = "Inner";
  list.noDataText = "No records available.";

  rows.forEach((row) => {
    const li = document.createElement("ui5-li");
    li.textContent = safe(row.documentName);
    li.description = `${safe(row.counterparty)} • Expiration ${safe(row.expirationDate)}`;
    li.type = "Navigation";
    li.addEventListener("click", () => onSelect(row));
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

export class SignaturesPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.state = {
      filters: {
        status: "",
        counterparty: "",
      },
      asOf: "—",
    };
    this.rows = [];
    this.selectedDocument = null;
    this.selectedSubDetail = null;

    this.el = document.createElement("ui5-dynamic-page");

    const pageTitle = document.createElement("ui5-dynamic-page-title");
    const heading = document.createElement("ui5-title");
    heading.level = "H1";
    heading.textContent = "Signatures";
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
    this.beginTitle.textContent = "Documents";

    const searchRow = document.createElement("div");
    searchRow.className = "netz-fcl-search-row";

    this.searchInput = document.createElement("ui5-input");
    this.searchInput.type = "Search";
    this.searchInput.placeholder = "Search";
    this.searchInput.addEventListener("input", () => this._renderRows());

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

    this.statusSelect = document.createElement("ui5-select");
    this.statusSelect.accessibleName = "Status";

    this.counterpartySelect = document.createElement("ui5-select");
    this.counterpartySelect.accessibleName = "Counterparty";

    const applyBtn = document.createElement("ui5-button");
    applyBtn.design = "Emphasized";
    applyBtn.textContent = "Apply";
    applyBtn.addEventListener("click", () => this._applyFilters());

    const resetBtn = document.createElement("ui5-button");
    resetBtn.design = "Transparent";
    resetBtn.textContent = "Reset";
    resetBtn.addEventListener("click", () => this._resetFilters());

    this.filterBar.append(this.statusSelect, this.counterpartySelect, applyBtn, resetBtn);
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
    this.objectAvatar.initials = "S";
    this.objectAvatar.colorScheme = "Accent6";

    const headerInfo = document.createElement("div");
    headerInfo.className = "netz-object-header-info";

    this.objectTitle = document.createElement("ui5-title");
    this.objectTitle.level = "H3";
    this.objectTitle.textContent = "Document";

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
    this.tabTimeline = this._createTab("Signature Timeline");
    this.tabObligations = this._createTab("Related Obligations");
    this.tabDocuments = this._createTab("Documents");

    this.tabs.append(this.tabOverview, this.tabTimeline, this.tabObligations, this.tabDocuments);
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
    msg.textContent = "Select a timeline event, obligation, or document attachment.";
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
      status: this.statusSelect.selectedOption?.value || "",
      counterparty: this.counterpartySelect.selectedOption?.value || "",
    };
    this._renderRows();
  }

  _resetFilters() {
    this.state.filters = { status: "", counterparty: "" };
    this._renderRows();
  }

  _filteredRows() {
    return this.rows.filter((row) => {
      const statusOk = !this.state.filters.status || String(row.status) === this.state.filters.status;
      const counterpartyOk = !this.state.filters.counterparty || String(row.counterparty) === this.state.filters.counterparty;
      return statusOk && counterpartyOk;
    });
  }

  _renderRows() {
    const rows = this._filteredRows();
    const searchTerm = (this.searchInput?.value || "").toLowerCase();
    const searched = searchTerm
      ? rows.filter((row) => {
          const name = String(row.documentName || "").toLowerCase();
          return name.includes(searchTerm);
        })
      : rows;
    this.beginTitle.textContent = `Documents (${searched.length})`;
    this.listHost.replaceChildren(buildWorkflowList(searched, (row) => this._selectDocument(row)));
    this.leftMeta.textContent = `As of: ${safe(this.state.asOf)} • Fund: ${safe(this.fundId)}`;

    if (!this.selectedDocument && rows.length) {
      this._selectDocument(rows[0]);
      return;
    }

    if (this.selectedDocument) {
      const current = rows.find((row) => String(row.id) === String(this.selectedDocument.id));
      if (current) {
        this._selectDocument(current);
        return;
      }
    }

    if (!rows.length) {
      this._selectDocument({
        documentName: "Signatures",
        counterparty: "—",
        status: "—",
        initiatedDate: "—",
        expirationDate: "—",
      });
    }
  }

  _selectDocument(row) {
    this.selectedDocument = row;
    const displayName = safe(row.documentName, "Document");
    this.objectTitle.textContent = displayName;
    this.objectAvatar.initials = displayName.substring(0, 2).toUpperCase();
    this.endTitle.textContent = displayName;

    this.objectKpis.replaceChildren();
    [
      `Counterparty: ${safe(row.counterparty)}`,
      "Status:",
      `Initiated Date: ${safe(row.initiatedDate)}`,
      `Expiration Date: ${safe(row.expirationDate)}`,
    ].forEach((fragment) => {
      const span = document.createElement("span");
      span.textContent = fragment;
      this.objectKpis.appendChild(span);
    });
    this.objectKpis.appendChild(statusBadge(row.status));

    const timelineItems = row.timelineItems?.length
      ? row.timelineItems
      : [
          { text: "Initiated", description: safe(row.initiatedDate), preview: `Counterparty: ${safe(row.counterparty)}` },
          { text: "Expiration", description: safe(row.expirationDate), preview: `Status: ${safe(row.status)}` },
        ];

    const obligationItems = row.obligationItems?.length
      ? row.obligationItems
      : [{ text: "Related Obligation", description: safe(row.relatedObligations, "No records available"), preview: "Obligation workflow context." }];

    const attachmentItems = row.attachmentItems?.length
      ? row.attachmentItems
      : [{ text: "Document Package", description: safe(row.documentPackage, "Available"), preview: "Attachment metadata and preview context." }];

    this.tabOverview.firstElementChild.replaceChildren(
      buildList([
        { text: "Document Name", description: safe(row.documentName) },
        { text: "Counterparty", description: safe(row.counterparty) },
        { text: "Status", description: safe(row.status) },
      ]),
    );

    this.tabTimeline.firstElementChild.replaceChildren(
      buildSelectableList(timelineItems, (item) => this._renderSubDetail(item, "Timeline Event")),
    );

    this.tabObligations.firstElementChild.replaceChildren(
      buildSelectableList(obligationItems, (item) => this._renderSubDetail(item, "Obligation")),
    );

    this.tabDocuments.firstElementChild.replaceChildren(
      buildSelectableList(attachmentItems, (item) => this._renderSubDetail(item, "Attachment")),
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
      const payload = await signaturesApi.listSignatureRequests(this.fundId, { limit: 200, offset: 0 });

      this.rows = toItems(payload).map((row) => ({
        id: firstDefined(row.id, row.request_id, row.transfer_id),
        documentName: firstDefined(row.document_name, row.document, row.title, row.id),
        counterparty: firstDefined(row.counterparty, row.signer_name, row.signer),
        status: firstDefined(row.signature_status, row.status),
        initiatedDate: formatDate(firstDefined(row.initiated_date, row.created_at, row.started_at)),
        expirationDate: formatDate(firstDefined(row.expiration_date, row.expires_at, row.deadline_at, row.due_date)),
        relatedObligations: firstDefined(row.related_obligations, row.obligations_count),
        documentPackage: firstDefined(row.package_name, row.execution_pack_status),
        timelineItems: Array.isArray(row.timeline)
          ? row.timeline.map((item) => ({
              text: safe(firstDefined(item.step, item.event, item.title), "Timeline Event"),
              description: safe(firstDefined(item.timestamp, item.status, item.actor)),
              preview: safe(firstDefined(item.detail, item.notes, item.metadata)),
            }))
          : null,
        obligationItems: Array.isArray(row.obligations)
          ? row.obligations.map((item) => ({
              text: safe(firstDefined(item.title, item.name), "Obligation"),
              description: safe(firstDefined(item.status, item.due_date, item.owner)),
              preview: safe(firstDefined(item.detail, item.description, item.notes)),
            }))
          : null,
        attachmentItems: Array.isArray(row.attachments)
          ? row.attachments.map((item) => ({
              text: safe(firstDefined(item.name, item.file_name, item.title), "Attachment"),
              description: safe(firstDefined(item.type, item.status, item.updated_at)),
              preview: safe(firstDefined(item.preview, item.metadata, item.description)),
            }))
          : null,
      }));

      this.state.asOf = formatDate(firstDefined(payload?.asOf, payload?.as_of, payload?.generated_at, payload?.timestamp));

      setOptions(this.statusSelect, [...new Set(this.rows.map((row) => row.status).filter(Boolean))], this.state.filters.status);
      setOptions(this.counterpartySelect, [...new Set(this.rows.map((row) => row.counterparty).filter(Boolean))], this.state.filters.counterparty);

      this._renderRows();
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to load signatures data");
    } finally {
      this.busy.active = false;
    }
  }
}
