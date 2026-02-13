import * as documentsApi from "../api/documents.js";

function pretty(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

export class DocumentsPage {
  constructor({ fundId }) {
    this.fundId = fundId;

    this.el = document.createElement("ui5-dynamic-page");

    const title = document.createElement("ui5-dynamic-page-title");
    const h = document.createElement("ui5-title");
    h.level = "H1";
    h.textContent = "Documents";
    title.appendChild(h);
    this.el.appendChild(title);

    const header = document.createElement("ui5-dynamic-page-header");
    const strip = document.createElement("ui5-message-strip");
    strip.design = "Information";
    strip.hideCloseButton = true;
    strip.textContent = "Wave 4 placeholder: list documents, list root folders, and trigger pending ingestion processing.";
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

    this.refreshButton = document.createElement("ui5-button");
    this.refreshButton.design = "Emphasized";
    this.refreshButton.textContent = "Refresh Documents";
    this.refreshButton.addEventListener("click", () => this.onShow());

    this.processPendingButton = document.createElement("ui5-button");
    this.processPendingButton.textContent = "Process Pending Ingestion";
    this.processPendingButton.addEventListener("click", () => this.processPending());

    controls.append(this.refreshButton, this.processPendingButton);

    this.documentsPre = document.createElement("pre");
    this.documentsPre.style.padding = "0.75rem";
    this.documentsPre.style.border = "1px solid var(--sapList_BorderColor)";

    this.rootFoldersPre = document.createElement("pre");
    this.rootFoldersPre.style.padding = "0.75rem";
    this.rootFoldersPre.style.border = "1px solid var(--sapList_BorderColor)";

    content.append(controls, this.documentsPre, this.rootFoldersPre);
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

  async onShow() {
    this.busy.active = true;
    this._clearError();

    if (!this.fundId) {
      this._setError("No fund scope. Provide ?fundId= in the URL.");
      this.busy.active = false;
      return;
    }

    try {
      const [documents, rootFolders] = await Promise.all([
        documentsApi.listDocuments(this.fundId, { limit: 20, offset: 0 }),
        documentsApi.listRootFolders(this.fundId),
      ]);

      this.documentsPre.textContent = pretty(documents);
      this.rootFoldersPre.textContent = pretty(rootFolders);
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to load documents");
    } finally {
      this.busy.active = false;
    }
  }

  async processPending() {
    this.busy.active = true;
    this._clearError();
    try {
      await documentsApi.processPendingIngestion(this.fundId);
      await this.onShow();
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to process pending ingestion");
    } finally {
      this.busy.active = false;
    }
  }
}
