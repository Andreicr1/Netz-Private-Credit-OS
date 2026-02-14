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
    title.textContent = safe(row.documentName);

    const meta = document.createElement("div");
    meta.className = "netz-fcl-list-meta";
    meta.textContent = `${safe(row.counterparty)} • Expiration ${safe(row.expirationDate)}`;

    const badgeWrap = document.createElement("div");
    badgeWrap.className = "netz-fcl-list-badge";
    badgeWrap.appendChild(statusBadge(row.status));

    wrap.append(title, meta, badgeWrap);
    item.appendChild(wrap);
    item.addEventListener("click", () => onSelect(row));
    list.appendChild(item);
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
    header.titleText = "Signature Workflow";
    header.subtitleText = "Documents by status";
    header.setAttribute("slot", "header");
    column.appendChild(header);

    const body = document.createElement("div");
    body.className = "netz-fcl-column-body";

    const controls = document.createElement("div");
    controls.className = "netz-fcl-controls";

    this.statusSelect = document.createElement("ui5-select");
    this.statusSelect.accessibleName = "Status";

    this.counterpartySelect = document.createElement("ui5-select");
    this.counterpartySelect.accessibleName = "Counterparty";

    const applyBtn = document.createElement("ui5-button");
    applyBtn.design = "Emphasized";
    applyBtn.textContent = "Apply";
    applyBtn.addEventListener("click", () => this._applyFilters());

    const resetBtn = document.createElement("ui5-button");
    resetBtn.design = "Default";
    resetBtn.textContent = "Reset";
    resetBtn.addEventListener("click", () => this._resetFilters());

    controls.append(this.statusSelect, this.counterpartySelect, applyBtn, resetBtn);

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
    header.titleText = "Document Detail";
    header.setAttribute("slot", "header");
    this.detailHeader = header;
    column.appendChild(header);

    const body = document.createElement("div");
    body.className = "netz-fcl-column-body";

    this.detailMeta = document.createElement("div");
    this.detailMeta.className = "netz-fcl-detail-meta";

    this.tabs = document.createElement("ui5-tabcontainer");
    this.tabOverview = this._createTab("Overview");
    this.tabTimeline = this._createTab("Signature Timeline");
    this.tabObligations = this._createTab("Related Obligations");
    this.tabDocuments = this._createTab("Documents");

    this.tabs.append(this.tabOverview, this.tabTimeline, this.tabObligations, this.tabDocuments);

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
    this.detailHeader.titleText = safe(row.documentName, "Document Detail");

    this.detailMeta.replaceChildren();
    const summary = document.createElement("span");
    summary.textContent = [
      `Counterparty: ${safe(row.counterparty)}`,
      `Initiated Date: ${safe(row.initiatedDate)}`,
      `Expiration Date: ${safe(row.expirationDate)}`,
    ].join(" • ");

    this.detailMeta.append(summary, statusBadge(row.status));

    this.tabOverview.firstElementChild.replaceChildren(
      buildList([
        { text: "Document Name", description: safe(row.documentName) },
        { text: "Counterparty", description: safe(row.counterparty) },
        { text: "Status", description: safe(row.status) },
      ]),
    );

    this.tabTimeline.firstElementChild.replaceChildren(
      buildList([
        { text: "Initiated", description: safe(row.initiatedDate) },
        { text: "Expiration", description: safe(row.expirationDate) },
      ]),
    );

    this.tabObligations.firstElementChild.replaceChildren(
      buildList([{ text: "Related Obligations", description: safe(row.relatedObligations, "No records available") }]),
    );

    this.tabDocuments.firstElementChild.replaceChildren(
      buildList([{ text: "Document Package", description: safe(row.documentPackage, "Available") }]),
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
