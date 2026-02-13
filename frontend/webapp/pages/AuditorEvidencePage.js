import * as auditorEvidenceApi from "../api/auditorEvidence.js";
import * as documentsApi from "../api/documents.js";

function pretty(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

export class AuditorEvidencePage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.el = document.createElement("ui5-dynamic-page");

    const wrap = document.createElement("div");
    wrap.className = "netz-page-content";
    const load = document.createElement("ui5-button");
    load.design = "Emphasized";
    load.textContent = "Load Auditor Evidence";
    load.addEventListener("click", () => this.onShow());

    this.out = document.createElement("pre");
    this.out.style.border = "1px solid var(--sapList_BorderColor)";
    this.out.style.padding = "0.75rem";
    wrap.append(load, this.out);
    this.el.appendChild(wrap);
  }

  async onShow() {
    const [auditorEvidence, documents] = await Promise.all([
      auditorEvidenceApi.listAuditorEvidence(this.fundId),
      documentsApi.listDocuments(this.fundId, { limit: 10, offset: 0 }),
    ]);
    this.out.textContent = pretty({ auditorEvidence, documents });
  }
}
