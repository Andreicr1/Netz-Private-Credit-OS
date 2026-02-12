import * as copilotApi from "../api/copilot.js";
import { downloadJson } from "../services/http.js";

export class FundCopilotPage {
  constructor({ fundId }) {
    this.fundId = fundId;

    this.el = document.createElement("ui5-dynamic-page");
    const title = document.createElement("ui5-dynamic-page-title");
    const t = document.createElement("ui5-title");
    t.level = "H1";
    t.textContent = "Fund Copilot";
    title.appendChild(t);
    this.el.appendChild(title);

    const header = document.createElement("ui5-dynamic-page-header");
    const strip = document.createElement("ui5-message-strip");
    strip.design = "Information";
    strip.hideCloseButton = true;
    strip.textContent = "Evidence-first: answers must include citations. When evidence is insufficient, the system must say so deterministically.";
    header.appendChild(strip);
    this.el.appendChild(header);

    this._busy = document.createElement("ui5-busy-indicator");
    this._busy.active = false;
    this._busy.style.width = "100%";

    const content = document.createElement("div");
    content.style.padding = "1rem";
    content.style.display = "grid";
    content.style.gridTemplateColumns = "2fr 1fr";
    content.style.gap = "1rem";

    // Left: question + answer
    const left = document.createElement("ui5-panel");
    left.headerText = "Query";
    const leftBody = document.createElement("div");
    leftBody.style.padding = "1rem";
    leftBody.style.display = "grid";
    leftBody.style.gap = "0.5rem";

    this.question = document.createElement("ui5-textarea");
    this.question.placeholder = "Enter your question (citations are mandatory).";
    this.question.rows = 4;

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "0.5rem";

    this.submit = document.createElement("ui5-button");
    this.submit.design = "Emphasized";
    this.submit.textContent = "Submit";
    this.submit.addEventListener("click", () => this._onSubmit());

    this.export = document.createElement("ui5-button");
    this.export.design = "Default";
    this.export.textContent = "Export Evidence Pack";
    this.export.addEventListener("click", () => this._onExport());

    actions.append(this.submit, this.export);

    this.answerStrip = document.createElement("ui5-message-strip");
    this.answerStrip.design = "Information";
    this.answerStrip.hideCloseButton = false;
    this.answerStrip.style.display = "none";

    this.answer = document.createElement("ui5-textarea");
    this.answer.rows = 12;
    this.answer.readonly = true;
    this.answer.placeholder = "Answer will appear here";

    leftBody.append(this.question, actions, this.answerStrip, this.answer);
    left.appendChild(leftBody);

    // Right: evidence panel always visible
    const right = document.createElement("ui5-panel");
    right.headerText = "Evidence & Citations";
    const rightBody = document.createElement("div");
    rightBody.style.padding = "1rem";
    rightBody.style.display = "grid";
    rightBody.style.gap = "0.5rem";

    this.citations = document.createElement("ui5-table");
    this.citations.noDataText = "No citations";
    ["Root Folder", "Document", "Pages", "Blob"].forEach((c) => {
      const col = document.createElement("ui5-table-column");
      col.textContent = c;
      this.citations.appendChild(col);
    });

    rightBody.appendChild(this.citations);
    right.appendChild(rightBody);

    content.append(left, right);
    this._busy.appendChild(content);
    this.el.appendChild(this._busy);
  }

  onShow() {
    // no-op
  }

  async _onSubmit() {
    if (!this.fundId) {
      this.answerStrip.design = "Negative";
      this.answerStrip.textContent = "No fund scope. Provide ?fundId= in the URL.";
      this.answerStrip.style.display = "block";
      return;
    }
    const q = this.question.value?.trim();
    if (!q) {
      return;
    }

    this._busy.active = true;
    this.answerStrip.style.display = "none";
    this.answer.value = "";
    Array.from(this.citations.querySelectorAll("ui5-table-row")).forEach((r) => r.remove());

    try {
      const retrieveRes = await copilotApi.retrieve(this.fundId, { question: q, top_k: 8 });
      const evidenceMap = new Map();
      const retrieved = retrieveRes?.results || retrieveRes?.hits || [];
      for (const r of retrieved) {
        evidenceMap.set(String(r.chunk_id), r);
      }

      const ans = await copilotApi.answer(this.fundId, { question: q, require_citations: true });

      const answerText = ans?.answer || ans?.answer_text || "";
      const citations = ans?.citations || [];

      this.answer.value = String(answerText || "");

      if (String(answerText) === "Insufficient evidence in the Data Room") {
        this.answerStrip.design = "Warning";
        this.answerStrip.textContent = "Insufficient evidence.";
        this.answerStrip.style.display = "block";
      }

      // Render citations (always visible panel)
      for (const c of citations) {
        const meta = evidenceMap.get(String(c.chunk_id)) || {};
        const row = document.createElement("ui5-table-row");
        const cells = [
          c.root_folder ?? meta.root_folder ?? "",
          c.document_title ?? meta.document_title ?? "",
          (c.page_start != null || c.page_end != null) ? `${c.page_start ?? ""}-${c.page_end ?? ""}` : "",
          c.source_blob ?? meta.source_blob ?? "",
        ];
        cells.forEach((v) => {
          const cell = document.createElement("ui5-table-cell");
          if (String(v || "").startsWith("http")) {
            const link = document.createElement("ui5-link");
            link.href = String(v);
            link.target = "_blank";
            link.textContent = "Open";
            cell.appendChild(link);
          } else {
            cell.textContent = v;
          }
          row.appendChild(cell);
        });
        this.citations.appendChild(row);
      }

      // Hard governance UX: if backend returned no citations, surface it.
      if (citations.length === 0 && answerText && answerText !== "Insufficient evidence in the Data Room") {
        this.answerStrip.design = "Negative";
        this.answerStrip.textContent = "Backend returned an answer without citations. This is a governance violation.";
        this.answerStrip.style.display = "block";
      }
    } catch (e) {
      this.answerStrip.design = "Negative";
      this.answerStrip.textContent = e?.message ? String(e.message) : "Request failed";
      this.answerStrip.style.display = "block";
    } finally {
      this._busy.active = false;
    }
  }

  async _onExport() {
    if (!this.fundId) {
      return;
    }
    try {
      // Reuse reporting evidence pack endpoint (auditor binder export)
      const res = await fetch(`/api/funds/${encodeURIComponent(this.fundId)}/reports/evidence-pack`, {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 20 }),
      }).then((r) => r.json());
      downloadJson(`evidence-pack_${this.fundId}.json`, res);
    } catch {
      // best effort: deterministic error shown via strip is handled in main submit flow
    }
  }
}
