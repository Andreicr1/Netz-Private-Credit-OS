import * as complianceApi from "../api/compliance.js";
import * as evidenceApi from "../api/evidence.js";
import * as auditorEvidenceApi from "../api/auditorEvidence.js";
import * as documentsApi from "../api/documents.js";

function pretty(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

function firstItemId(page) {
  const items = page?.items;
  if (Array.isArray(items) && items.length > 0 && items[0]?.id) {
    return String(items[0].id);
  }
  return "";
}

/**
 * CompliancePage — tab container for compliance sub-domains.
 *
 * Tabs: Snapshot | Obligations | Evidence | Auditor Evidence | Gaps | Audit Trail
 */
export class CompliancePage {
  constructor({ fundId }) {
    this.fundId = fundId;
    this._activeTab = "snapshot";
    this.selectedObligationId = "";

    this.el = document.createElement("ui5-dynamic-page");

    const pageTitle = document.createElement("ui5-dynamic-page-title");
    const h = document.createElement("ui5-title");
    h.level = "H1";
    h.textContent = "Compliance";
    pageTitle.appendChild(h);
    this.el.appendChild(pageTitle);

    // Tab container
    this.tabContainer = document.createElement("ui5-tabcontainer");
    this.tabContainer.className = "netz-compliance-tabs";
    this.tabContainer.addEventListener("tab-select", (e) => {
      const key = e.detail?.tab?.dataset?.key;
      if (key) {
        this._activeTab = key;
        this._loadTabData(key);
      }
    });

    const tabDefs = [
      { key: "snapshot", text: "Snapshot", icon: "bar-chart" },
      { key: "obligations", text: "Obligations", icon: "task" },
      { key: "evidence", text: "Evidence", icon: "document-text" },
      { key: "auditor-evidence", text: "Auditor Evidence", icon: "inspection" },
      { key: "gaps", text: "Gaps", icon: "warning" },
      { key: "audit-trail", text: "Audit Trail", icon: "history" },
    ];

    this._tabPanels = {};
    tabDefs.forEach((def, idx) => {
      const tab = document.createElement("ui5-tab");
      tab.text = def.text;
      tab.icon = def.icon;
      tab.dataset.key = def.key;
      if (idx === 0) tab.selected = true;

      const panel = document.createElement("div");
      panel.className = "netz-tab-panel";

      // For obligations tab: add controls
      if (def.key === "obligations") {
        const controls = document.createElement("div");
        controls.style.display = "flex";
        controls.style.flexWrap = "wrap";
        controls.style.gap = "0.5rem";
        controls.style.marginBottom = "0.75rem";

        this.obligationIdInput = document.createElement("ui5-input");
        this.obligationIdInput.placeholder = "Obligation ID";
        this.obligationIdInput.style.minWidth = "24rem";

        const loadDetail = document.createElement("ui5-button");
        loadDetail.textContent = "Open Obligation Detail";
        loadDetail.addEventListener("click", () => this.loadObligationDetail());

        const markInProgress = document.createElement("ui5-button");
        markInProgress.textContent = "Mark In Progress";
        markInProgress.addEventListener("click", () => this.markObligationInProgress());

        const closeObl = document.createElement("ui5-button");
        closeObl.textContent = "Close Obligation";
        closeObl.addEventListener("click", () => this.closeObligation());

        const recomputeStatus = document.createElement("ui5-button");
        recomputeStatus.textContent = "Recompute Status";
        recomputeStatus.addEventListener("click", () => this.recomputeStatus());

        const recomputeGaps = document.createElement("ui5-button");
        recomputeGaps.textContent = "Recompute Gaps";
        recomputeGaps.addEventListener("click", () => this.recomputeGaps());

        controls.append(this.obligationIdInput, loadDetail, markInProgress, closeObl, recomputeStatus, recomputeGaps);
        panel.appendChild(controls);
      }

      // For evidence tab: add controls
      if (def.key === "evidence") {
        const controls = document.createElement("div");
        controls.style.display = "flex";
        controls.style.flexWrap = "wrap";
        controls.style.gap = "0.5rem";
        controls.style.marginBottom = "0.75rem";

        this.evidenceIdInput = document.createElement("ui5-input");
        this.evidenceIdInput.placeholder = "Evidence ID";

        const createUpload = document.createElement("ui5-button");
        createUpload.design = "Emphasized";
        createUpload.textContent = "Create Upload Request";
        createUpload.addEventListener("click", () => this.createUploadRequest());

        const complete = document.createElement("ui5-button");
        complete.textContent = "Complete Evidence";
        complete.addEventListener("click", () => this.completeEvidence());

        controls.append(this.evidenceIdInput, createUpload, complete);
        panel.appendChild(controls);
      }

      const output = document.createElement("pre");
      output.className = "netz-tab-output";
      output.style.padding = "0.75rem";
      output.style.border = "1px solid var(--sapList_BorderColor)";
      output.style.whiteSpace = "pre-wrap";
      panel.appendChild(output);
      tab.appendChild(panel);

      this._tabPanels[def.key] = { tab, output };
      this.tabContainer.appendChild(tab);
    });

    // Error strip
    this.error = document.createElement("ui5-message-strip");
    this.error.design = "Negative";
    this.error.style.display = "none";

    // Busy indicator
    this.busy = document.createElement("ui5-busy-indicator");
    this.busy.active = false;
    this.busy.style.width = "100%";

    const content = document.createElement("div");
    content.className = "netz-page-content";
    content.append(this.error, this.tabContainer);
    this.busy.appendChild(content);
    this.el.appendChild(this.busy);
  }

  _effectiveObligationId() {
    return String(this.obligationIdInput?.value || this.selectedObligationId || "").trim();
  }

  _setError(msg) {
    this.error.textContent = msg;
    this.error.style.display = "block";
  }

  _clearError() {
    this.error.style.display = "none";
    this.error.textContent = "";
  }

  async onShow() {
    this._clearError();
    if (!this.fundId) {
      this._setError("No fund scope. Provide ?fundId= in the URL.");
      return;
    }
    await this._loadTabData(this._activeTab);
  }

  async _loadTabData(key) {
    this.busy.active = true;
    this._clearError();
    const out = this._tabPanels[key]?.output;
    try {
      let data;
      switch (key) {
        case "snapshot":
          data = await complianceApi.getComplianceSnapshot(this.fundId);
          break;
        case "obligations": {
          const obligations = await complianceApi.listComplianceObligations(this.fundId, { limit: 20, offset: 0, view: "all" });
          this.selectedObligationId = firstItemId(obligations);
          if (this.obligationIdInput && !this.obligationIdInput.value && this.selectedObligationId) {
            this.obligationIdInput.value = this.selectedObligationId;
          }
          data = obligations;
          break;
        }
        case "evidence": {
          const obligations = await complianceApi.listComplianceObligations(this.fundId, { limit: 5, offset: 0 });
          data = { message: "Use controls above to create upload requests or complete evidence.", obligations };
          break;
        }
        case "auditor-evidence": {
          const [auditorEvidence, documents] = await Promise.all([
            auditorEvidenceApi.listAuditorEvidence(this.fundId),
            documentsApi.listDocuments(this.fundId, { limit: 10, offset: 0 }),
          ]);
          data = { auditorEvidence, documents };
          break;
        }
        case "gaps":
          data = await complianceApi.listComplianceGaps(this.fundId, { limit: 20, offset: 0 });
          break;
        case "audit-trail": {
          const obligationId = this._effectiveObligationId();
          if (obligationId) {
            data = await complianceApi.listComplianceObligationAudit(this.fundId, obligationId);
          } else {
            data = { message: "Select an obligation first to view its audit trail." };
          }
          break;
        }
        default:
          data = {};
      }
      if (out) out.textContent = pretty(data);
    } catch (error) {
      this._setError(error?.message ? String(error.message) : `Failed to load ${key}`);
      if (out) out.textContent = "{}";
    } finally {
      this.busy.active = false;
    }
  }

  async loadObligationDetail() {
    const obligationId = this._effectiveObligationId();
    if (!obligationId) {
      this._setError("Provide an obligation id to load detail.");
      return;
    }
    this.busy.active = true;
    this._clearError();
    try {
      const [detail, evidence, audit] = await Promise.all([
        complianceApi.getComplianceObligation(this.fundId, obligationId),
        complianceApi.listComplianceObligationEvidence(this.fundId, obligationId),
        complianceApi.listComplianceObligationAudit(this.fundId, obligationId),
      ]);
      const out = this._tabPanels["obligations"]?.output;
      if (out) out.textContent = pretty({ detail, evidence, audit });
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to load obligation detail");
    } finally {
      this.busy.active = false;
    }
  }

  async markObligationInProgress() {
    const obligationId = this._effectiveObligationId();
    if (!obligationId) {
      this._setError("Provide an obligation id to mark in progress.");
      return;
    }
    this.busy.active = true;
    this._clearError();
    try {
      await complianceApi.markComplianceObligationInProgress(this.fundId, obligationId);
      await this.loadObligationDetail();
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to mark obligation in progress");
    } finally {
      this.busy.active = false;
    }
  }

  async closeObligation() {
    const obligationId = this._effectiveObligationId();
    if (!obligationId) {
      this._setError("Provide an obligation id to close.");
      return;
    }
    this.busy.active = true;
    this._clearError();
    try {
      await complianceApi.closeComplianceObligation(this.fundId, obligationId);
      await this.loadObligationDetail();
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to close obligation");
    } finally {
      this.busy.active = false;
    }
  }

  async recomputeStatus() {
    this.busy.active = true;
    this._clearError();
    try {
      const result = await complianceApi.recomputeComplianceObligationStatus(this.fundId);
      const out = this._tabPanels["snapshot"]?.output;
      if (out) out.textContent = pretty({ recomputed_status: result });
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to recompute obligation status");
    } finally {
      this.busy.active = false;
    }
  }

  async recomputeGaps() {
    this.busy.active = true;
    this._clearError();
    try {
      const result = await complianceApi.recomputeComplianceGaps(this.fundId);
      const out = this._tabPanels["gaps"]?.output;
      if (out) out.textContent = pretty({ recomputed_gaps: result });
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to recompute gaps");
    } finally {
      this.busy.active = false;
    }
  }

  async createUploadRequest() {
    this.busy.active = true;
    this._clearError();
    try {
      const request = await evidenceApi.createEvidenceUploadRequest(this.fundId, { filename: `evidence-${Date.now()}.pdf` });
      const out = this._tabPanels["evidence"]?.output;
      if (out) out.textContent = pretty({ request });
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to create upload request");
    } finally {
      this.busy.active = false;
    }
  }

  async completeEvidence() {
    const evidenceId = String(this.evidenceIdInput?.value || "").trim();
    if (!evidenceId) {
      this._setError("Provide an evidence ID to complete.");
      return;
    }
    this.busy.active = true;
    this._clearError();
    try {
      const completed = await evidenceApi.completeEvidence(this.fundId, evidenceId, { status: "complete" });
      const out = this._tabPanels["evidence"]?.output;
      if (out) out.textContent = pretty({ completed });
    } catch (error) {
      this._setError(error?.message ? String(error.message) : "Failed to complete evidence");
    } finally {
      this.busy.active = false;
    }
  }
}
