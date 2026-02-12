import * as complianceApi from "../api/compliance.js";

export class CompliancePage {
  constructor({ fundId }) {
    this.fundId = fundId;

    this.el = document.createElement("ui5-dynamic-page");
    const title = document.createElement("ui5-dynamic-page-title");
    const t = document.createElement("ui5-title");
    t.level = "H1";
    t.textContent = "Compliance";
    title.appendChild(t);
    this.el.appendChild(title);

    const header = document.createElement("ui5-dynamic-page-header");
    const strip = document.createElement("ui5-message-strip");
    strip.design = "Information";
    strip.hideCloseButton = true;
    strip.textContent = "Obligations are created by AI evidence gaps and can only be closed with evidence document linkage.";
    header.appendChild(strip);
    this.el.appendChild(header);

    this._busy = document.createElement("ui5-busy-indicator");
    this._busy.active = true;
    this._busy.style.width = "100%";

    const content = document.createElement("div");
    content.style.padding = "1rem";
    content.style.display = "grid";
    content.style.gap = "0.75rem";

    this._error = document.createElement("ui5-message-strip");
    this._error.design = "Negative";
    this._error.style.display = "none";
    content.appendChild(this._error);

    this.table = document.createElement("ui5-table");
    this.table.noDataText = "No obligations";
    const cols = ["Obligation ID", "Name", "Regulator", "Workflow Status", "Updated At"];
    cols.forEach((c) => {
      const col = document.createElement("ui5-table-column");
      col.textContent = c;
      this.table.appendChild(col);
    });
    content.appendChild(this.table);

    this._busy.appendChild(content);
    this.el.appendChild(this._busy);
  }

  async onShow() {
    this._busy.active = true;
    this._error.style.display = "none";
    Array.from(this.table.querySelectorAll("ui5-table-row")).forEach((r) => r.remove());

    if (!this.fundId) {
      this._error.textContent = "No fund scope. Provide ?fundId= in the URL.";
      this._error.style.display = "block";
      this._busy.active = false;
      return;
    }

    try {
      const page = await complianceApi.listObligations(this.fundId, {});
      const items = page?.items ?? page ?? [];
      (Array.isArray(items) ? items : []).forEach((o) => {
        const row = document.createElement("ui5-table-row");
        const cells = [
          o.id ?? "",
          o.name ?? o.title ?? "",
          o.regulator ?? "",
          o.workflow_status ?? o.status ?? "",
          o.updated_at ?? "",
        ];
        cells.forEach((v) => {
          const cell = document.createElement("ui5-table-cell");
          cell.textContent = v;
          row.appendChild(cell);
        });
        this.table.appendChild(row);
      });
    } catch (e) {
      this._error.textContent = e?.message ? String(e.message) : "Failed to load obligations";
      this._error.style.display = "block";
    } finally {
      this._busy.active = false;
    }
  }
}
