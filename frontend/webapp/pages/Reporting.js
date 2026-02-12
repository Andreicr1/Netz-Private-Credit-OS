import * as reportingApi from "../api/reporting.js";
import * as copilotApi from "../api/copilot.js";
import { downloadJson } from "../services/http.js";

export class ReportingPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.el = document.createElement("ui5-dynamic-page");

    const title = document.createElement("ui5-dynamic-page-title");
    const h = document.createElement("ui5-title");
    h.level = "H1";
    h.textContent = "Reporting";
    title.appendChild(h);
    this.el.appendChild(title);

    const header = document.createElement("ui5-dynamic-page-header");
    const bar = document.createElement("ui5-bar");
    bar.className = "netz-action-bar";
    bar.accessibleName = "Reporting actions";
    this.exportBtn = document.createElement("ui5-button");
    this.exportBtn.slot = "endContent";
    this.exportBtn.className = "netz-action-btn";
    this.exportBtn.design = "Emphasized";
    this.exportBtn.icon = "download";
    this.exportBtn.textContent = "Evidence Pack Export";
    this.exportBtn.addEventListener("click", () => this._export());
    bar.appendChild(this.exportBtn);
    header.appendChild(bar);
    this.el.appendChild(header);

    this.busy = document.createElement("ui5-busy-indicator");
    this.busy.active = true;
    this.busy.style.width = "100%";

    const content = document.createElement("div");
    content.className = "netz-page-content";

    this.error = document.createElement("ui5-message-strip");
    this.error.design = "Negative";
    this.error.style.display = "none";
    content.appendChild(this.error);

    this.aiTable = document.createElement("ui5-table");
    this.aiTable.className = "netz-table";
    this.aiTable.accessibleName = "AI activity records";
    this.aiTable.overflowMode = "Scroll";
    this.aiTable.loading = false;
    this.aiTable.noDataText = "No AI activity";
    ["At", "Question", "Insufficient Evidence"].forEach((c) => {
      const col = document.createElement("ui5-table-column");
      col.textContent = c;
      this.aiTable.appendChild(col);
    });
    content.appendChild(this.aiTable);

    this.busy.appendChild(content);
    this.el.appendChild(this.busy);
  }

  async onShow() {
    this.busy.active = true;
    this.aiTable.loading = true;
    this.error.style.display = "none";
    Array.from(this.aiTable.querySelectorAll("ui5-table-row")).forEach((r) => r.remove());

    if (!this.fundId) {
      this.error.textContent = "No fund scope. Provide ?fundId= in the URL.";
      this.error.style.display = "block";
      this.busy.active = false;
      this.aiTable.loading = false;
      return;
    }

    try {
      const activity = await copilotApi.getAIActivity(this.fundId, { limit: 20, offset: 0 });
      for (const it of (activity?.items || [])) {
        const row = document.createElement("ui5-table-row");
        const cells = [it.created_at_utc ?? "", it.question_text ?? "", it.insufficient_evidence ? "Yes" : "No"];
        cells.forEach((v) => {
          const cell = document.createElement("ui5-table-cell");
          cell.textContent = String(v ?? "");
          row.appendChild(cell);
        });
        this.aiTable.appendChild(row);
      }
    } catch (e) {
      this.error.textContent = e?.message ? String(e.message) : "Failed to load";
      this.error.style.display = "block";
    } finally {
      this.busy.active = false;
      this.aiTable.loading = false;
    }
  }

  async _export() {
    if (!this.fundId) return;
    this.exportBtn.disabled = true;
    try {
      const pack = await reportingApi.exportEvidencePack(this.fundId, { limit: 50 });
      downloadJson(`evidence-pack_${this.fundId}.json`, pack);
    } catch (e) {
      this.error.textContent = e?.message ? String(e.message) : "Export failed";
      this.error.style.display = "block";
    } finally {
      this.exportBtn.disabled = false;
    }
  }
}
