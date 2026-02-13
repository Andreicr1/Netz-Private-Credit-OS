import * as copilotApi from "../api/copilot.js";

export class FundCopilotPage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.el = document.createElement("ui5-dynamic-page");

    const title = document.createElement("ui5-dynamic-page-title");
    const h = document.createElement("ui5-title");
    h.level = "H1";
    h.textContent = "Fund Copilot";
    title.appendChild(h);
    this.el.appendChild(title);

    const header = document.createElement("ui5-dynamic-page-header");
    const strip = document.createElement("ui5-message-strip");
    strip.design = "Information";
    strip.hideCloseButton = true;
    strip.textContent = "Evidence-first: citations are mandatory. If evidence is insufficient, the system must say so.";
    header.appendChild(strip);
    this.el.appendChild(header);

    this.busy = document.createElement("ui5-busy-indicator");
    this.busy.active = false;
    this.busy.style.width = "100%";

    const grid = document.createElement("div");
    grid.className = "netz-page-content";
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "2fr 1fr";
    grid.style.gap = "1rem";

    const left = document.createElement("ui5-panel");
    left.headerText = "Question / Answer";
    const leftBody = document.createElement("div");
    leftBody.className = "netz-dialog-content netz-form-grid";

    this.q = document.createElement("ui5-textarea");
    this.q.rows = 4;
    this.q.placeholder = "Enter your question";

    const btnRow = document.createElement("div");
    btnRow.style.display = "flex";
    btnRow.style.gap = "0.5rem";

    this.submit = document.createElement("ui5-button");
    this.submit.design = "Emphasized";
    this.submit.icon = "paper-plane";
    this.submit.textContent = "Submit";
    this.submit.addEventListener("click", () => this._submit());

    btnRow.appendChild(this.submit);

    this.msg = document.createElement("ui5-message-strip");
    this.msg.design = "Information";
    this.msg.style.display = "none";

    this.a = document.createElement("ui5-textarea");
    this.a.rows = 10;
    this.a.readonly = true;

    leftBody.append(this.q, btnRow, this.msg, this.a);
    left.appendChild(leftBody);

    const right = document.createElement("ui5-panel");
    right.headerText = "Evidence & Citations";
    const rightBody = document.createElement("div");
    rightBody.className = "netz-dialog-content";

    this.citations = document.createElement("ui5-table");
    this.citations.className = "netz-table";
    this.citations.accessibleName = "Evidence citations";
    this.citations.overflowMode = "Scroll";
    this.citations.loading = false;
    this.citations.noDataText = "No citations";
    ["Root Folder", "Document", "Pages", "Blob"].forEach((c) => {
      const col = document.createElement("ui5-table-column");
      col.textContent = c;
      this.citations.appendChild(col);
    });
    rightBody.appendChild(this.citations);
    right.appendChild(rightBody);

    grid.append(left, right);
    this.busy.appendChild(grid);
    this.el.appendChild(this.busy);
  }

  async _submit() {
    if (!this.fundId) {
      this.msg.design = "Negative";
      this.msg.textContent = "No fund scope. Provide ?fundId= in the URL.";
      this.msg.style.display = "block";
      return;
    }
    const question = this.q.value?.trim();
    if (!question) return;

    this.busy.active = true;
    this.citations.loading = true;
    this.msg.style.display = "none";
    this.a.value = "";
    Array.from(this.citations.querySelectorAll("ui5-table-row")).forEach((r) => r.remove());

    try {
      const retrieved = await copilotApi.retrieve(this.fundId, { query: question, top_k: 8 });
      const evidenceMap = new Map();
      for (const r of (retrieved?.results || retrieved?.hits || [])) {
        evidenceMap.set(String(r.chunk_id), r);
      }

      const ans = await copilotApi.answer(this.fundId, { question, require_citations: true });
      const answerText = ans?.answer || ans?.answer_text || "";
      const citations = ans?.citations || [];
      this.a.value = String(answerText || "");

      if (String(answerText) === "Insufficient evidence in the Data Room") {
        this.msg.design = "Warning";
        this.msg.textContent = "Insufficient evidence.";
        this.msg.style.display = "block";
      }

      for (const c of citations) {
        const meta = evidenceMap.get(String(c.chunk_id)) || {};
        const row = document.createElement("ui5-table-row");
        const vals = [
          c.root_folder ?? meta.root_folder ?? "",
          c.document_title ?? meta.document_title ?? "",
          (c.page_start != null || c.page_end != null) ? `${c.page_start ?? ""}-${c.page_end ?? ""}` : "",
          c.source_blob ?? meta.source_blob ?? ""
        ];
        vals.forEach((v) => {
          const cell = document.createElement("ui5-table-cell");
          if (String(v || "").startsWith("http")) {
            const link = document.createElement("ui5-link");
            link.href = String(v);
            link.target = "_blank";
            link.textContent = "Open";
            cell.appendChild(link);
          } else {
            cell.textContent = String(v ?? "");
          }
          row.appendChild(cell);
        });
        this.citations.appendChild(row);
      }

      if (citations.length === 0 && answerText && answerText !== "Insufficient evidence in the Data Room") {
        this.msg.design = "Negative";
        this.msg.textContent = "Backend returned an answer without citations. Governance violation.";
        this.msg.style.display = "block";
      }
    } catch (e) {
      this.msg.design = "Negative";
      this.msg.textContent = e?.message ? String(e.message) : "Request failed";
      this.msg.style.display = "block";
    } finally {
      this.busy.active = false;
      this.citations.loading = false;
    }
  }
}
