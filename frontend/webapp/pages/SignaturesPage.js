import * as signaturesApi from "../api/signatures.js";

function pretty(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

function firstRequestId(payload) {
  const items = payload?.items;
  if (Array.isArray(items) && items[0]?.id) return String(items[0].id);
  return "";
}

export class SignaturesPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.selectedRequestId = "";

    this.el = document.createElement("ui5-dynamic-page");

    const title = document.createElement("ui5-dynamic-page-title");
    const h = document.createElement("ui5-title");
    h.level = "H1";
    h.textContent = "Signatures";
    title.appendChild(h);
    this.el.appendChild(title);

    const header = document.createElement("ui5-dynamic-page-header");
    const strip = document.createElement("ui5-message-strip");
    strip.design = "Information";
    strip.hideCloseButton = true;
    strip.textContent = "Wave 4 placeholder: list signature requests, fetch detail, and execute sign/reject/execution-pack actions.";
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

    this.requestIdInput = document.createElement("ui5-input");
    this.requestIdInput.placeholder = "Signature Request ID";
    this.requestIdInput.style.minWidth = "28rem";

    this.refreshButton = document.createElement("ui5-button");
    this.refreshButton.design = "Emphasized";
    this.refreshButton.textContent = "Refresh Signatures";
    this.refreshButton.addEventListener("click", () => this.onShow());

    this.signButton = document.createElement("ui5-button");
    this.signButton.textContent = "Sign";
    this.signButton.addEventListener("click", () => this.signSelected());

    this.rejectButton = document.createElement("ui5-button");
    this.rejectButton.textContent = "Reject";
    this.rejectButton.addEventListener("click", () => this.rejectSelected());

    this.executionPackButton = document.createElement("ui5-button");
    this.executionPackButton.textContent = "Export Execution Pack";
    this.executionPackButton.addEventListener("click", () => this.exportExecutionPack());

    controls.append(this.requestIdInput, this.refreshButton, this.signButton, this.rejectButton, this.executionPackButton);

    this.listPre = document.createElement("pre");
    this.listPre.style.padding = "0.75rem";
    this.listPre.style.border = "1px solid var(--sapList_BorderColor)";

    this.detailPre = document.createElement("pre");
    this.detailPre.style.padding = "0.75rem";
    this.detailPre.style.border = "1px solid var(--sapList_BorderColor)";

    content.append(controls, this.listPre, this.detailPre);
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

  _effectiveRequestId() {
    return String(this.requestIdInput.value || this.selectedRequestId || "").trim();
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
      const list = await signaturesApi.listSignatureRequests(this.fundId, { limit: 10, offset: 0 });
      this.selectedRequestId = this._effectiveRequestId() || firstRequestId(list);
      if (!this.requestIdInput.value && this.selectedRequestId) {
        this.requestIdInput.value = this.selectedRequestId;
      }

      let detail = null;
      if (this.selectedRequestId) {
        detail = await signaturesApi.getSignatureRequest(this.fundId, this.selectedRequestId);
      }

      this.listPre.textContent = pretty(list);
      this.detailPre.textContent = pretty(detail);
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to load signature requests");
    } finally {
      this.busy.active = false;
    }
  }

  async signSelected() {
    const requestId = this._effectiveRequestId();
    if (!requestId) {
      this._setError("Provide a signature request id.");
      return;
    }
    this.busy.active = true;
    this._clearError();
    try {
      await signaturesApi.signSignatureRequest(this.fundId, requestId, { comment: "Wave 4 placeholder sign" });
      await this.onShow();
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to sign request");
    } finally {
      this.busy.active = false;
    }
  }

  async rejectSelected() {
    const requestId = this._effectiveRequestId();
    if (!requestId) {
      this._setError("Provide a signature request id.");
      return;
    }
    this.busy.active = true;
    this._clearError();
    try {
      await signaturesApi.rejectSignatureRequest(this.fundId, requestId, { reason: "Wave 4 placeholder reject" });
      await this.onShow();
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to reject request");
    } finally {
      this.busy.active = false;
    }
  }

  async exportExecutionPack() {
    const requestId = this._effectiveRequestId();
    if (!requestId) {
      this._setError("Provide a signature request id.");
      return;
    }
    this.busy.active = true;
    this._clearError();
    try {
      const result = await signaturesApi.exportExecutionPack(this.fundId, requestId);
      this.detailPre.textContent = pretty(result);
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to export execution pack");
    } finally {
      this.busy.active = false;
    }
  }
}
