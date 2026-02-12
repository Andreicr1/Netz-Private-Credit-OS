import * as signaturesApi from "../api/signatures.js";
import { downloadJson } from "../services/http.js";

export class SignatureDetailView {
  constructor({ fundId, transferId, onNavigate }) {
    this.fundId = fundId;
    this.transferId = transferId;
    this.onNavigate = onNavigate;

    this.el = document.createElement("ui5-dynamic-page");
    const title = document.createElement("ui5-dynamic-page-title");
    const h = document.createElement("ui5-title");
    h.level = "H1";
    h.textContent = "Signature Workflow";
    title.appendChild(h);
    this.el.appendChild(title);

    const header = document.createElement("ui5-dynamic-page-header");
    const bar = document.createElement("ui5-bar");
    const back = document.createElement("ui5-button");
    back.design = "Transparent";
    back.textContent = "Back to Cash Management";
    back.addEventListener("click", () => this.onNavigate("/cash"));
    bar.appendChild(back);
    header.appendChild(bar);
    this.el.appendChild(header);

    this._busy = document.createElement("ui5-busy-indicator");
    this._busy.active = true;
    this._busy.style.width = "100%";
    this._content = document.createElement("div");
    this._content.style.padding = "1rem";
    this._content.style.display = "grid";
    this._content.style.gap = "1rem";
    this._busy.appendChild(this._content);
    this.el.appendChild(this._busy);
  }

  async onShow() {
    this._content.replaceChildren();
    this._busy.active = true;
    if (!this.fundId) {
      const strip = document.createElement("ui5-message-strip");
      strip.design = "Negative";
      strip.textContent = "No fund scope. Provide ?fundId= in the URL.";
      this._content.appendChild(strip);
      this._busy.active = false;
      return;
    }

    try {
      const detail = await signaturesApi.getSignatureRequest(this.fundId, this.transferId);

      const strip = document.createElement("ui5-message-strip");
      strip.design = "Information";
      strip.hideCloseButton = true;
      strip.textContent = `Request ${this.transferId}`;
      this._content.appendChild(strip);

      const pre = document.createElement("pre");
      pre.style.margin = "0";
      pre.style.padding = "0.75rem";
      pre.style.border = "1px solid var(--sapField_BorderColor)";
      pre.style.borderRadius = "0.25rem";
      pre.textContent = JSON.stringify(detail, null, 2);
      this._content.appendChild(pre);

      const exportBtn = document.createElement("ui5-button");
      exportBtn.design = "Emphasized";
      exportBtn.textContent = "Export Execution Pack (JSON)";
      exportBtn.addEventListener("click", async () => {
        const pack = await signaturesApi.exportExecutionPack(this.fundId, this.transferId);
        downloadJson(`execution-pack_${this.transferId}.json`, pack);
      });
      this._content.appendChild(exportBtn);
    } catch (e) {
      const strip = document.createElement("ui5-message-strip");
      strip.design = "Negative";
      strip.textContent = e?.message ? String(e.message) : "Failed to load signature request";
      this._content.appendChild(strip);
    } finally {
      this._busy.active = false;
    }
  }
}
