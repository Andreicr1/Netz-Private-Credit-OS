import * as evidenceApi from "../api/evidence.js";
import * as complianceApi from "../api/compliance.js";

function pretty(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

export class EvidencePage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this.el = document.createElement("ui5-dynamic-page");

    const wrap = document.createElement("div");
    wrap.className = "netz-page-content";
    this.evidenceId = document.createElement("ui5-input");
    this.evidenceId.placeholder = "Evidence ID";

    const create = document.createElement("ui5-button");
    create.design = "Emphasized";
    create.textContent = "Create Upload Request";
    create.addEventListener("click", () => this.createUploadRequest());

    const complete = document.createElement("ui5-button");
    complete.design = "Transparent";
    complete.textContent = "Complete Evidence";
    complete.addEventListener("click", () => this.complete());

    this.out = document.createElement("pre");
    this.out.style.border = "1px solid var(--sapList_BorderColor)";
    this.out.style.padding = "0.75rem";

    wrap.append(this.evidenceId, create, complete, this.out);
    this.el.appendChild(wrap);
  }

  async createUploadRequest() {
    const request = await evidenceApi.createEvidenceUploadRequest(this.fundId, { filename: `evidence-${Date.now()}.pdf` });
    const obligations = await complianceApi.listComplianceObligations(this.fundId, { limit: 5, offset: 0 });
    this.out.textContent = pretty({ request, obligations });
  }

  async complete() {
    const evidenceId = String(this.evidenceId.value || "").trim();
    if (!evidenceId) return;
    const completed = await evidenceApi.completeEvidence(this.fundId, evidenceId, { status: "complete" });
    const obligations = await complianceApi.listComplianceObligations(this.fundId, { limit: 5, offset: 0 });
    this.out.textContent = pretty({ completed, obligations });
  }
}
