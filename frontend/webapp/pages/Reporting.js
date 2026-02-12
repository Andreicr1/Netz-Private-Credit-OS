import * as reportingApi from "../api/reporting.js";
import * as copilotApi from "../api/copilot.js";
import { downloadJson } from "../services/http.js";

export class ReportingPage {
  constructor({ fundId }) {
    this.fundId = fundId;

    this.el = document.createElement("ui5-dynamic-page");
    const title = document.createElement("ui5-dynamic-page-title");
    const t = document.createElement("ui5-title");
    t.level = "H1";
    t.textContent = "Reporting";
    title.appendChild(t);
    this.el.appendChild(title);

    const header = document.createElement("ui5-dynamic-page-header");
    const bar = document.createElement("ui5-bar");
    this.exportBtn = document.createElement("ui5-button");
    this.exportBtn.design = "Emphasized";
    this.exportBtn.textContent = "Evidence Pack Export";
    this.exportBtn.addEventListener("click", () => this._exportEvidencePack());
    bar.appendChild(this.exportBtn);
    header.appendChild(bar);
    this.el.appendChild(header);

    this._busy = document.createElement("ui5-busy-indicator");
    this._busy.active = true;
    this._busy.style.width = "100%";

    const content = document.createElement("div");
    content.style.padding = "1rem";
    content.style.display = "grid";
    content.style.gap = "1rem";

    this._error = document.createElement("ui5-message-strip");
    this._error.design = "Negative";
    this._error.style.display = "none";
    content.appendChild(this._error);

    this.aiTable = document.createElement("ui5-table");
    this.aiTable.noDataText = "No AI activity";
    ["At", "Question", "Insufficient Evidence"].forEach((c) => {
      const col = document.createElement("ui5-table-column");
      col.textContent = c;
      this.aiTable.appendChild(col);
    });
    content.appendChild(this.aiTable);

    this._busy.appendChild(content);
    this.el.appendChild(this._busy);
  }

  async onShow() {
    this._busy.active = true;
    this._error.style.display = "none";
    Array.from(this.aiTable.querySelectorAll("ui5-table-row")).forEach((r) => r.remove());

    if (!this.fundId) {
      this._error.textContent = "No fund scope. Provide ?fundId= in the URL.";
      this._error.style.display = "block";
      this._busy.active = false;
      return;
    }

    try {
      const activity = await copilotApi.getAIActivity(this.fundId, { limit: 20, offset: 0 });
      const items = activity?.items ?? [];
      for (const it of items) {
        const row = document.createElement("ui5-table-row");
        const cells = [
          it.created_at_utc ?? it.created_at ?? "",
          it.question_text ?? it.question ?? "",
          it.insufficient_evidence ? "Yes" : "No",
        ];
        cells.forEach((v) => {
          const cell = document.createElement("ui5-table-cell");
          cell.textContent = String(v ?? "");
          row.appendChild(cell);
        });
        this.aiTable.appendChild(row);
      }
    } catch (e) {
      this._error.textContent = e?.message ? String(e.message) : "Failed to load reporting";
      this._error.style.display = "block";
    } finally {
      this._busy.active = false;
    }
  }

  async _exportEvidencePack() {
    if (!this.fundId) {
      return;
    }
    this.exportBtn.disabled = true;
    try {
      const pack = await reportingApi.exportEvidencePack(this.fundId, { limit: 50 });
      downloadJson(`evidence-pack_${this.fundId}.json`, pack);
    } catch (e) {
      this._error.textContent = e?.message ? String(e.message) : "Export failed";
      this._error.style.display = "block";
    } finally {
      this.exportBtn.disabled = false;
    }
  }
}
