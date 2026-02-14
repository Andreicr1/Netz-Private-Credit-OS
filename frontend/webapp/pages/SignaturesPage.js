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
    item.style.width = "100%";
    item.style.textAlign = "left";
    item.style.background = "transparent";
    item.style.border = "none";
    item.style.cursor = "pointer";
    item.style.fontFamily = "inherit";

    const title = document.createElement("div");
    title.className = "netz-entity-title";
    title.textContent = safe(row.documentName);

    const meta = document.createElement("div");
    meta.className = "netz-entity-meta";
    meta.textContent = `${safe(row.counterparty)} • Expiration ${safe(row.expirationDate)}`;

    const badgeWrap = document.createElement("div");
    badgeWrap.className = "netz-entity-badge";
    badgeWrap.appendChild(statusBadge(row.status));
    meta.appendChild(badgeWrap);

    item.append(title, meta);
    item.addEventListener("click", () => onSelect(row));
    list.appendChild(item);
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
    row.style.width = "100%";
    row.style.textAlign = "left";
    row.style.background = "transparent";
    row.style.border = "none";
    row.style.cursor = "pointer";
    row.style.fontFamily = "inherit";

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
    column.className = "netz-fcl-col begin netz-fcl-col--begin";

    const header = document.createElement("div");
    header.className = "netz-fcl-header";
    const title = document.createElement("div");
    title.className = "netz-title-strong";
    title.textContent = "Documents";
    const subtitle = document.createElement("div");
    subtitle.className = "netz-meta-text";
    subtitle.textContent = "Signature Workflow";
    header.append(title, subtitle);
    column.appendChild(header);

    const body = document.createElement("div");
    body.className = "netz-fcl-body";

    const controls = document.createElement("div");
    controls.className = "netz-multi";
    controls.style.padding = "0 0 0.75rem 0";

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

    controls.append(this.statusSelect, this.counterpartySelect, applyBtn, resetBtn);

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
    this.objectTitle.textContent = "Document";

    this.objectKpis = document.createElement("div");
    this.objectKpis.className = "netz-object-kpis";

    this.objectHeader.append(this.objectTitle, this.objectKpis);

    this.tabs = document.createElement("ui5-tabcontainer");
    this.tabs.className = "netz-object-tabs";
    this.tabOverview = this._createTab("Overview");
    this.tabTimeline = this._createTab("Signature Timeline");
    this.tabObligations = this._createTab("Related Obligations");
    this.tabDocuments = this._createTab("Documents");

    this.tabs.append(this.tabOverview, this.tabTimeline, this.tabObligations, this.tabDocuments);

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
    msg.textContent = "Select a timeline event, obligation, or document attachment.";
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
      preview.className = "netz-meta-text";
      preview.style.marginTop = "0.75rem";
      preview.textContent = safe(item.preview);
      this.subDetailBody.appendChild(preview);
    }
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
    this.listHost.replaceChildren(buildWorkflowList(rows, (row) => this._selectDocument(row)));
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
    this.objectTitle.textContent = safe(row.documentName, "Document");

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
