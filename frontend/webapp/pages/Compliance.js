import * as complianceApi from "../api/compliance.js";

export class CompliancePage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.el = document.createElement("ui5-dynamic-page");

    const title = document.createElement("ui5-dynamic-page-title");
    const h = document.createElement("ui5-title");
    h.level = "H1";
    h.textContent = "Compliance";
    title.appendChild(h);
    this.el.appendChild(title);

    const header = document.createElement("ui5-dynamic-page-header");
    const strip = document.createElement("ui5-message-strip");
    strip.design = "Information";
    strip.hideCloseButton = true;
    strip.textContent = "Obligations are evidence-gap driven and can only be closed via governed evidence actions.";
    header.appendChild(strip);
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

    this.table = document.createElement("ui5-table");
    this.table.className = "netz-table";
    this.table.accessibleName = "Compliance obligations";
    this.table.overflowMode = "Scroll";
    this.table.loading = false;
    this.table.noDataText = "No obligations";
    ["Obligation ID", "Name", "Regulator", "Workflow Status", "Updated At"].forEach((c) => {
      const col = document.createElement("ui5-table-column");
      col.textContent = c;
      this.table.appendChild(col);
    });
    content.appendChild(this.table);

    this.busy.appendChild(content);
    this.el.appendChild(this.busy);
  }

  async onShow() {
    this.busy.active = true;
    this.table.loading = true;
    this.error.style.display = "none";
    Array.from(this.table.querySelectorAll("ui5-table-row")).forEach((r) => r.remove());

    if (!this.fundId) {
      this.error.textContent = "No fund scope. Provide ?fundId= in the URL.";
      this.error.style.display = "block";
      this.busy.active = false;
      this.table.loading = false;
      return;
    }

    try {
      const page = await complianceApi.listObligations(this.fundId);
      const items = page?.items ?? page ?? [];
      (Array.isArray(items) ? items : []).forEach((o) => {
        const row = document.createElement("ui5-table-row");
        const cells = [
          o.id ?? "",
          o.name ?? o.title ?? "",
          o.regulator ?? "",
          o.workflow_status ?? o.status ?? "",
          o.updated_at ?? ""
        ];
        cells.forEach((v) => {
          const cell = document.createElement("ui5-table-cell");
          cell.textContent = String(v ?? "");
          row.appendChild(cell);
        });
        this.table.appendChild(row);
      });
    } catch (e) {
      this.error.textContent = e?.message ? String(e.message) : "Failed to load";
      this.error.style.display = "block";
    } finally {
      this.busy.active = false;
      this.table.loading = false;
    }
  }
}
