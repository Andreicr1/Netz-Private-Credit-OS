import * as dataroomApi from "../api/dataroom.js";
import * as documentsApi from "../api/documents.js";

function pretty(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

function firstDocumentId(payload) {
  const items = payload?.items;
  if (Array.isArray(items) && items[0]?.id) return String(items[0].id);
  return "";
}

export class DataroomPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.selectedDocumentId = "";

    this.el = document.createElement("ui5-dynamic-page");

    const title = document.createElement("ui5-dynamic-page-title");
    const h = document.createElement("ui5-title");
    h.level = "H1";
    h.textContent = "Dataroom";
    title.appendChild(h);
    this.el.appendChild(title);

    const header = document.createElement("ui5-dynamic-page-header");
    const strip = document.createElement("ui5-message-strip");
    strip.design = "Information";
    strip.hideCloseButton = true;
    strip.textContent = "Wave 4 placeholder: dataroom search and ingestion endpoints with document context.";
    header.appendChild(strip);
    this.el.appendChild(header);

    this.busy = document.createElement("ui5-busy-indicator");
    this.busy.active = false;
    this.busy.style.width = "100%";

    const content = document.createElement("div");
    content.className = "netz-page-content";

    this.error = document.createElement("ui5-message-strip");
    this.error.design = "Negative";
    this.error.style.display = "none";
    content.appendChild(this.error);

    const controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.flexWrap = "wrap";
    controls.style.gap = "0.5rem";
    controls.style.marginBottom = "0.75rem";

    this.searchInput = document.createElement("ui5-input");
    this.searchInput.placeholder = "Search query";
    this.searchInput.value = "portfolio";
    this.searchInput.style.minWidth = "20rem";

    this.documentIdInput = document.createElement("ui5-input");
    this.documentIdInput.placeholder = "Document ID (for ingest)";
    this.documentIdInput.style.minWidth = "24rem";

    this.refreshButton = document.createElement("ui5-button");
    this.refreshButton.design = "Emphasized";
    this.refreshButton.textContent = "Refresh Dataroom";
    this.refreshButton.addEventListener("click", () => this.onShow());

    this.ingestButton = document.createElement("ui5-button");
    this.ingestButton.textContent = "Ingest Document";
    this.ingestButton.addEventListener("click", () => this.ingestSelected());

    controls.append(this.searchInput, this.documentIdInput, this.refreshButton, this.ingestButton);

    this.searchPre = document.createElement("pre");
    this.searchPre.style.padding = "0.75rem";
    this.searchPre.style.border = "1px solid var(--sapList_BorderColor)";

    this.documentsPre = document.createElement("pre");
    this.documentsPre.style.padding = "0.75rem";
    this.documentsPre.style.border = "1px solid var(--sapList_BorderColor)";

    content.append(controls, this.searchPre, this.documentsPre);
    this.busy.appendChild(content);
    this.el.appendChild(this.busy);
  }

  _setError(message) {
    this.error.textContent = message;
    this.error.style.display = "block";
  }

  _clearError() {
    this.error.style.display = "none";
    this.error.textContent = "";
  }

  _effectiveDocumentId() {
    return String(this.documentIdInput.value || this.selectedDocumentId || "").trim();
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
      const queryText = String(this.searchInput.value || "portfolio").trim() || "portfolio";
      const [searchResult, documents] = await Promise.all([
        dataroomApi.searchDataroom({ fund_id: this.fundId, q: queryText, top: 5 }),
        documentsApi.listDocuments(this.fundId, { limit: 20, offset: 0 }),
      ]);

      this.selectedDocumentId = this._effectiveDocumentId() || firstDocumentId(documents);
      if (!this.documentIdInput.value && this.selectedDocumentId) {
        this.documentIdInput.value = this.selectedDocumentId;
      }

      this.searchPre.textContent = pretty(searchResult);
      this.documentsPre.textContent = pretty(documents);
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to load dataroom data");
    } finally {
      this.busy.active = false;
    }
  }

  async ingestSelected() {
    const documentId = this._effectiveDocumentId();
    if (!documentId) {
      this._setError("Provide a document id to ingest.");
      return;
    }

    this.busy.active = true;
    this._clearError();
    try {
      await dataroomApi.ingestDataroomDocument(documentId, {
        fund_id: this.fundId,
        store_artifacts_in_evidence: true,
      });
      await this.onShow();
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to ingest dataroom document");
    } finally {
      this.busy.active = false;
    }
  }
}
