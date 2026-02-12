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
    bar.className = "netz-action-bar";
    bar.accessibleName = "Signature workflow actions";
    const back = document.createElement("ui5-button");
    back.slot = "endContent";
    back.className = "netz-action-btn";
    back.design = "Transparent";
    back.icon = "nav-back";
    back.textContent = "Back to Cash Management";
    back.addEventListener("click", () => this.onNavigate("/cash"));
    bar.appendChild(back);
    header.appendChild(bar);
    this.el.appendChild(header);

    this.busy = document.createElement("ui5-busy-indicator");
    this.busy.active = true;
    this.busy.style.width = "100%";

    this.body = document.createElement("div");
    this.body.className = "netz-page-content";
    this.busy.appendChild(this.body);
    this.el.appendChild(this.busy);
  }

  async onShow() {
    this.body.replaceChildren();
    this.busy.active = true;

    if (!this.fundId) {
      const s = document.createElement("ui5-message-strip");
      s.design = "Negative";
      s.textContent = "No fund scope. Provide ?fundId= in the URL.";
      this.body.appendChild(s);
      this.busy.active = false;
      return;
    }

    try {
      const detail = await signaturesApi.getSignatureRequest(this.fundId, this.transferId);

      const pre = document.createElement("pre");
      pre.style.margin = "0";
      pre.style.padding = "0.75rem";
      pre.style.border = "1px solid var(--sapField_BorderColor)";
      pre.style.borderRadius = "0.25rem";
      pre.textContent = JSON.stringify(detail, null, 2);
      this.body.appendChild(pre);

      const exportBtn = document.createElement("ui5-button");
      exportBtn.design = "Default";
      exportBtn.icon = "download";
      exportBtn.textContent = "Export Execution Pack (JSON)";
      exportBtn.addEventListener("click", async () => {
        const pack = await signaturesApi.exportExecutionPack(this.fundId, this.transferId);
        downloadJson(`execution-pack_${this.transferId}.json`, pack);
      });
      this.body.appendChild(exportBtn);
    } catch (e) {
      const s = document.createElement("ui5-message-strip");
      s.design = "Negative";
      s.textContent = e?.message ? String(e.message) : "Failed to load";
      this.body.appendChild(s);
    } finally {
      this.busy.active = false;
    }
  }
}
